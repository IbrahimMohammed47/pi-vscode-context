const assert = require("node:assert/strict");
const { join } = require("node:path");
const test = require("node:test");
const { createBrowserSelectionCapture } = require("./browserSelection");

function event() {
  const listeners = new Set();
  return {
    fire(value) {
      for (const listener of listeners) listener(value);
    },
    subscribe(listener) {
      listeners.add(listener);
      return { dispose: () => listeners.delete(listener) };
    },
  };
}

function fakeVSCode() {
  const started = event();
  const terminated = event();
  let clipboard = "previous clipboard";
  let expression = "";
  const messages = [];
  const debug = {
    activeDebugSession: undefined,
    onDidStartDebugSession: (listener) => started.subscribe(listener),
    onDidTerminateDebugSession: (listener) => terminated.subscribe(listener),
    startDebugging: async (_folder, configuration) => {
      const parent = { name: configuration.name };
      const child = {
        type: "pwa-editor-browser",
        parentSession: parent,
        customRequest: async (_command, request) => {
          expression = request.expression;
          return { result: "PI_BROWSER_PICKER_ACTIVE" };
        },
      };
      started.fire(parent);
      started.fire(child);
      return true;
    },
    stopDebugging: async () => true,
  };
  return {
    vscode: {
      debug,
      env: {
        clipboard: {
          readText: async () => clipboard,
          writeText: async (value) => {
            clipboard = value;
          },
        },
      },
      Uri: {
        joinPath: (_root, file) => ({ fsPath: join(__dirname, file) }),
      },
      window: {
        showInformationMessage: (message) => messages.push(message),
      },
    },
    get clipboard() {
      return clipboard;
    },
    get expression() {
      return expression;
    },
    messages,
    set clipboard(value) {
      clipboard = value;
    },
  };
}

test("requires an explicit element capture", () => {
  const harness = fakeVSCode();
  const capture = createBrowserSelectionCapture(harness.vscode, {});

  assert.equal(capture.read().error.code, "NO_BROWSER_ELEMENT_CAPTURE");
  capture.dispose();
});

test("attaches to the integrated browser and captures picker payload", async () => {
  const harness = fakeVSCode();
  const capture = createBrowserSelectionCapture(
    harness.vscode,
    {},
    {
      watchIntervalMs: 1,
      watchTimeoutMs: 1000,
      now: () => new Date("2026-09-08T03:15:00.000Z"),
    },
  );

  const armed = await capture.capture();
  assert.equal(armed.armed, true);
  assert.match(harness.expression, /PI_BROWSER_PICKER_ACTIVE/);
  const marker = JSON.parse(
    harness.expression.match(
      /const marker = ("PI_VSCODE_BROWSER_ELEMENT:[^"]+:");/,
    )[1],
  );
  harness.clipboard = `${marker}${JSON.stringify({
    tagName: "button",
    selector: "button#save",
    outerHTML: '<button id="save">Save</button>',
  })}`;
  await new Promise((accept) => setTimeout(accept, 20));

  const value = capture.read();
  assert.equal(value.selectedElement.selector, "button#save");
  assert.equal(value.capturedAt, "2026-09-08T03:15:00.000Z");
  assert.equal(harness.clipboard, "previous clipboard");
  assert.match(harness.messages[0], /button#save/);
  capture.dispose();
});

test("reports unavailable debugger APIs", async () => {
  const capture = createBrowserSelectionCapture(
    { env: { clipboard: { readText: async () => "" } } },
    {},
  );

  assert.equal(
    (await capture.capture()).error.code,
    "BROWSER_PICKER_UNAVAILABLE",
  );
  capture.dispose();
});
