const { createHash } = require("node:crypto");
const { readdir, readFile, rm } = require("node:fs/promises");
const { homedir, tmpdir } = require("node:os");
const { isAbsolute, join, relative, resolve } = require("node:path");

const MAX_RESPONSE_BYTES = 64 * 1024;
const REQUEST_TIMEOUT_MS = 3000;
const userId =
  typeof process.getuid === "function"
    ? String(process.getuid())
    : createHash("sha256").update(homedir()).digest("hex").slice(0, 12);
const defaultDiscoveryDir = join(
  tmpdir(),
  `pi-vscode-context-${userId}`,
  "instances",
);

function workspaceScore(record, cwd) {
  if (!Array.isArray(record.workspaceFolders)) return -1;
  const absoluteCwd = resolve(cwd);
  let score = -1;
  for (const folder of record.workspaceFolders) {
    if (typeof folder !== "string") continue;
    const root = resolve(folder);
    const child = relative(root, absoluteCwd);
    if (child === "" || (!child.startsWith("..") && !isAbsolute(child)))
      score = Math.max(score, root.length);
  }
  return score;
}

function timestamp(value) {
  if (typeof value === "number") return value;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function compareRecords(a, b) {
  return (
    b.score - a.score ||
    Number(Boolean(b.focused)) - Number(Boolean(a.focused)) ||
    timestamp(b.lastFocusedAt) - timestamp(a.lastFocusedAt) ||
    timestamp(b.createdAt) - timestamp(a.createdAt)
  );
}

function validRecord(record) {
  if (!record || record.version !== 1 || typeof record.token !== "string")
    return false;
  try {
    const endpoint = new URL(record.endpoint);
    return endpoint.protocol === "http:" && endpoint.hostname === "127.0.0.1";
  } catch {
    return false;
  }
}

async function findDiscovery(cwd, discoveryDir = defaultDiscoveryDir) {
  let files;
  try {
    files = await readdir(discoveryDir);
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }

  const matches = [];
  for (const file of files.filter((name) => name.endsWith(".json"))) {
    const discoveryFile = join(discoveryDir, file);
    try {
      const record = JSON.parse(await readFile(discoveryFile, "utf8"));
      if (!validRecord(record)) {
        await rm(discoveryFile, { force: true }).catch(() => {});
        continue;
      }
      const score = workspaceScore(record, cwd);
      if (score >= 0) matches.push({ ...record, score, discoveryFile });
    } catch {
      await rm(discoveryFile, { force: true }).catch(() => {});
    }
  }

  return matches.sort(compareRecords);
}

async function readBoundedBody(response) {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks = [];
  let bytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > MAX_RESPONSE_BYTES) {
      await reader.cancel();
      throw new Error("VS Code response exceeded safe output limit.");
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function requestVSCode({
  cwd,
  pathname,
  scope,
  signal,
  timeoutMs = REQUEST_TIMEOUT_MS,
  discoveryDir = defaultDiscoveryDir,
  fetchImpl = fetch,
}) {
  if (signal?.aborted) throw new Error("VS Code request was cancelled.");
  const records = await findDiscovery(cwd, discoveryDir);
  if (signal?.aborted) throw new Error("VS Code request was cancelled.");
  if (records.length === 0) {
    throw new Error(
      `No VS Code server found for Pi cwd: ${cwd}. Open this cwd in local VS Code with Pi VS Code Context enabled, then retry.`,
    );
  }

  const controller = new AbortController();
  let timedOut = false;
  const abort = () => controller.abort();
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  signal?.addEventListener("abort", abort, { once: true });

  try {
    for (const record of records) {
      try {
        const query =
          scope === undefined ? "" : `?scope=${encodeURIComponent(scope)}`;
        const response = await fetchImpl(
          `${record.endpoint}${pathname}${query}`,
          {
            headers: { authorization: `Bearer ${record.token}` },
            signal: controller.signal,
          },
        );
        const body = await readBoundedBody(response);
        const result = JSON.parse(body);
        if (response.status === 401 || response.status === 404) {
          throw new Error(`VS Code server returned HTTP ${response.status}.`);
        }
        return result;
      } catch {
        if (controller.signal.aborted) break;
        await rm(record.discoveryFile, { force: true }).catch(() => {});
      }
    }
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", abort);
  }

  if (signal?.aborted) throw new Error("VS Code request was cancelled.");
  if (timedOut) {
    throw new Error(
      `VS Code request timed out after ${timeoutMs}ms. Retry once; if it persists, reload the matching VS Code window.`,
    );
  }
  throw new Error(
    `VS Code connection for Pi cwd ${cwd} is stale or unavailable. Reload the matching VS Code window, then retry.`,
  );
}

function requestContext(options) {
  return requestVSCode({ ...options, pathname: "/context" });
}

function requestDiagnostics(options) {
  return requestVSCode({ ...options, pathname: "/diagnostics" });
}

function requestBrowserSelection(options) {
  return requestVSCode({ ...options, pathname: "/browser-selection" });
}

module.exports = {
  compareRecords,
  defaultDiscoveryDir,
  findDiscovery,
  MAX_RESPONSE_BYTES,
  requestBrowserSelection,
  requestContext,
  requestDiagnostics,
  workspaceScore,
};
