const { randomUUID } = require("node:crypto");
const { readFileSync } = require("node:fs");

const CAPTURE_COMMAND = "pi-vscode-context.captureBrowserSelection";
const SESSION_NAME = "Pi Browser Element Picker";
const WATCH_INTERVAL_MS = 250;
const WATCH_TIMEOUT_MS = 5 * 60 * 1000;

function delay(milliseconds) {
  return new Promise((accept) => setTimeout(accept, milliseconds));
}

function createBrowserSelectionCapture(vscode, extensionUri, options = {}) {
  const watchIntervalMs = options.watchIntervalMs ?? WATCH_INTERVAL_MS;
  const watchTimeoutMs = options.watchTimeoutMs ?? WATCH_TIMEOUT_MS;
  const now = options.now ?? (() => new Date());
  const subscriptions = [];
  let browserSession;
  let attachSession;
  let captured;
  let watcher;

  const isBrowserSession = (session) =>
    session?.type === "pwa-editor-browser" &&
    session.parentSession?.name === SESSION_NAME;
  const isAttachSession = (session) =>
    session?.name === SESSION_NAME && !session.parentSession;

  if (vscode.debug?.onDidStartDebugSession) {
    subscriptions.push(
      vscode.debug.onDidStartDebugSession((session) => {
        if (isBrowserSession(session)) browserSession = session;
        if (isAttachSession(session)) attachSession = session;
      }),
      vscode.debug.onDidTerminateDebugSession((session) => {
        if (session === browserSession || isBrowserSession(session)) {
          browserSession = undefined;
        }
        if (session === attachSession) attachSession = undefined;
      }),
    );
  }

  function stopWatcher() {
    if (watcher) clearInterval(watcher);
    watcher = undefined;
  }

  async function detach() {
    const sessions = new Set(
      [browserSession?.parentSession ?? browserSession, attachSession].filter(
        Boolean,
      ),
    );
    browserSession = undefined;
    attachSession = undefined;
    for (const session of sessions) {
      try {
        await Promise.race([vscode.debug.stopDebugging(session), delay(1500)]);
      } catch {
        // The short-lived attach may already have stopped.
      }
    }
  }

  function waitForBrowserSession(timeoutMs = 6000) {
    if (isBrowserSession(vscode.debug.activeDebugSession)) {
      return Promise.resolve(vscode.debug.activeDebugSession);
    }
    return new Promise((accept, reject) => {
      const finish = (settle, value) => {
        clearTimeout(timer);
        started.dispose();
        terminated.dispose();
        settle(value);
      };
      const timer = setTimeout(
        () =>
          finish(
            reject,
            new Error(
              "No loaded page was found in the active Integrated Browser.",
            ),
          ),
        timeoutMs,
      );
      const started = vscode.debug.onDidStartDebugSession((session) => {
        if (isBrowserSession(session)) finish(accept, session);
      });
      const terminated = vscode.debug.onDidTerminateDebugSession((session) => {
        if (isAttachSession(session)) {
          finish(
            reject,
            new Error(
              "The Integrated Browser debugger stopped before finding a page.",
            ),
          );
        }
      });
    });
  }

  async function getBrowserSession() {
    if (browserSession) return browserSession;
    const sessionPromise = waitForBrowserSession();
    const started = await vscode.debug.startDebugging(
      undefined,
      {
        type: "editor-browser",
        request: "attach",
        name: SESSION_NAME,
        urlFilter: "*",
        timeout: 4000,
        internalConsoleOptions: "neverOpen",
      },
      {
        suppressDebugToolbar: true,
        suppressDebugStatusbar: true,
        suppressDebugView: true,
        suppressSaveBeforeStart: true,
      },
    );
    if (!started) {
      sessionPromise.catch(() => {});
      throw new Error("Could not attach to the Integrated Browser.");
    }
    browserSession = await sessionPromise;
    return browserSession;
  }

  async function evaluatePicker(session, source) {
    let lastError;
    for (let attempt = 0; attempt < 20; attempt += 1) {
      try {
        const response = await session.customRequest("evaluate", {
          expression: source,
          context: "repl",
        });
        const result = String(response?.result ?? "");
        if (result.includes("PI_BROWSER_PICKER_ACTIVE")) return;
        if (result.includes("PI_BROWSER_PICKER_CANCELLED")) {
          throw new Error("The existing browser element picker was cancelled.");
        }
      } catch (error) {
        lastError = error;
      }
      await delay(250);
    }
    throw (
      lastError ?? new Error("The browser element picker did not activate.")
    );
  }

  function watchClipboard(marker, previousClipboard) {
    stopWatcher();
    const deadline = Date.now() + watchTimeoutMs;
    let busy = false;
    watcher = setInterval(async () => {
      if (busy) return;
      if (Date.now() > deadline) {
        stopWatcher();
        return;
      }
      busy = true;
      try {
        const text = await vscode.env.clipboard.readText();
        if (!text.startsWith(marker)) return;
        const selectedElement = JSON.parse(text.slice(marker.length));
        captured = {
          selectedElement,
          capturedAt: now().toISOString(),
          limitation:
            "Element data is captured by a user-initiated debugger picker in the active VS Code Integrated Browser.",
        };
        await vscode.env.clipboard.writeText(previousClipboard);
        stopWatcher();
        vscode.window.showInformationMessage(
          `Browser element captured for Pi: ${selectedElement.selector}`,
        );
      } catch {
        // Ignore transient clipboard reads and wait for a complete payload.
      } finally {
        busy = false;
      }
    }, watchIntervalMs);
  }

  async function capture() {
    if (!vscode.debug?.startDebugging || !vscode.env?.clipboard?.readText) {
      return {
        error: {
          code: "BROWSER_PICKER_UNAVAILABLE",
          message:
            "VS Code's debugger or clipboard API is unavailable for browser element capture.",
        },
      };
    }

    const previousClipboard = await vscode.env.clipboard.readText();
    const marker = `PI_VSCODE_BROWSER_ELEMENT:${randomUUID()}:`;
    try {
      const session = await getBrowserSession();
      const pickerUri = vscode.Uri.joinPath(extensionUri, "browserPicker.js");
      const template = readFileSync(pickerUri.fsPath, "utf8");
      const source = template.replace(
        "__PI_BROWSER_MARKER__",
        JSON.stringify(marker),
      );
      watchClipboard(marker, previousClipboard);
      await evaluatePicker(session, source);
      return {
        armed: true,
        message:
          "Element picker active. Hover over the page and click an element; press Escape to cancel.",
      };
    } catch (error) {
      stopWatcher();
      return {
        error: {
          code: "BROWSER_PICKER_ERROR",
          message: error instanceof Error ? error.message : String(error),
        },
      };
    } finally {
      await detach();
    }
  }

  function read() {
    if (captured) return captured;
    return {
      error: {
        code: "NO_BROWSER_ELEMENT_CAPTURE",
        message:
          "No browser element has been captured. Run 'Pi: Pick Integrated Browser Element', then hover and click an element in the active Integrated Browser.",
      },
    };
  }

  function dispose() {
    stopWatcher();
    for (const subscription of subscriptions) subscription.dispose();
    void detach();
  }

  return { capture, dispose, read };
}

module.exports = { CAPTURE_COMMAND, createBrowserSelectionCapture };
