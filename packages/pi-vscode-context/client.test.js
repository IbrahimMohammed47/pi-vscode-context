const assert = require("node:assert/strict");
const { mkdtemp, readFile, writeFile } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const test = require("node:test");
const {
  findDiscovery,
  requestBrowserSelection,
  requestContext,
  requestDiagnostics,
} = require("./client");

async function record(
  directory,
  name,
  workspaceFolders,
  endpoint = "http://127.0.0.1:9",
  metadata = {},
) {
  await writeFile(
    join(directory, `${name}.json`),
    JSON.stringify({
      version: 1,
      id: name,
      endpoint,
      token: "token",
      workspaceFolders,
      createdAt: Date.now(),
      ...metadata,
    }),
  );
}

test("discovery selects the most specific server matching Pi cwd", async () => {
  const directory = await mkdtemp(join(tmpdir(), "pi-vscode-discovery-"));
  await record(directory, "root", ["/workspace"], undefined, {
    focused: true,
    lastFocusedAt: 300,
  });
  await record(directory, "nested", ["/workspace/project"], undefined, {
    focused: false,
    lastFocusedAt: 100,
  });
  await record(directory, "other", ["/other"]);

  const matches = await findDiscovery("/workspace/project/src", directory);
  assert.deepEqual(
    matches.map(({ id }) => id),
    ["nested", "root"],
  );
});

test("discovery prefers focused then most recently focused matching window", async () => {
  const directory = await mkdtemp(join(tmpdir(), "pi-vscode-focus-"));
  await record(directory, "old", ["/workspace"], undefined, {
    focused: false,
    lastFocusedAt: 100,
  });
  await record(directory, "recent", ["/workspace"], undefined, {
    focused: false,
    lastFocusedAt: 300,
  });
  await record(directory, "focused", ["/workspace"], undefined, {
    focused: true,
    lastFocusedAt: 200,
  });

  const matches = await findDiscovery("/workspace/src", directory);
  assert.deepEqual(
    matches.map(({ id }) => id),
    ["focused", "recent", "old"],
  );
});

test("stale preferred window falls back to next live match", async () => {
  const directory = await mkdtemp(join(tmpdir(), "pi-vscode-fallback-"));
  await record(
    directory,
    "fallback",
    ["/workspace"],
    "http://127.0.0.1:10002",
    { lastFocusedAt: 100 },
  );
  await record(
    directory,
    "preferred",
    ["/workspace"],
    "http://127.0.0.1:10001",
    { focused: true, lastFocusedAt: 200 },
  );
  const requests = [];

  const value = await requestContext({
    cwd: "/workspace",
    discoveryDir: directory,
    fetchImpl: async (url) => {
      requests.push(url);
      if (url.includes(":10001")) throw new TypeError("stale");
      return new Response('{"path":"src/app.ts","selectedCode":null}', {
        status: 200,
      });
    },
  });

  assert.equal(value.path, "src/app.ts");
  assert.deepEqual(
    requests.map((url) => new URL(url).port),
    ["10001", "10002"],
  );
  await assert.rejects(readFile(join(directory, "preferred.json"), "utf8"), {
    code: "ENOENT",
  });
});

test("discovery removes malformed records opportunistically", async () => {
  const directory = await mkdtemp(join(tmpdir(), "pi-vscode-malformed-"));
  const malformed = join(directory, "malformed.json");
  await writeFile(malformed, "{");

  assert.deepEqual(await findDiscovery("/workspace", directory), []);
  await assert.rejects(readFile(malformed, "utf8"), { code: "ENOENT" });
});

test("diagnostics requests use shared authenticated client path", async () => {
  const directory = await mkdtemp(join(tmpdir(), "pi-vscode-diagnostics-"));
  await record(directory, "server", ["/workspace"], "http://127.0.0.1:10003");
  let requested;

  const value = await requestDiagnostics({
    cwd: "/workspace",
    scope: "active",
    discoveryDir: directory,
    fetchImpl: async (url, options) => {
      requested = { url, authorization: options.headers.authorization };
      return new Response('{"diagnostics":[]}', { status: 200 });
    },
  });

  assert.deepEqual(value, { diagnostics: [] });
  assert.equal(new URL(requested.url).pathname, "/diagnostics");
  assert.equal(new URL(requested.url).searchParams.get("scope"), "active");
  assert.equal(requested.authorization, "Bearer token");
});

test("browser selection requests use shared authenticated client path", async () => {
  const directory = await mkdtemp(join(tmpdir(), "pi-vscode-browser-"));
  await record(directory, "server", ["/workspace"], "http://127.0.0.1:10004");
  let requested;

  const value = await requestBrowserSelection({
    cwd: "/workspace",
    discoveryDir: directory,
    fetchImpl: async (url, options) => {
      requested = { url, authorization: options.headers.authorization };
      return new Response('{"selectedElement":{"selector":"button#save"}}', {
        status: 200,
      });
    },
  });

  assert.deepEqual(value, { selectedElement: { selector: "button#save" } });
  assert.equal(new URL(requested.url).pathname, "/browser-selection");
  assert.equal(requested.authorization, "Bearer token");
});

test("missing and stale VS Code servers report clear failures", async () => {
  const missing = await mkdtemp(join(tmpdir(), "pi-vscode-missing-"));
  await assert.rejects(
    requestContext({
      cwd: "/workspace",
      discoveryDir: missing,
      timeoutMs: 100,
    }),
    /No VS Code server found/,
  );

  const stale = await mkdtemp(join(tmpdir(), "pi-vscode-stale-"));
  await record(stale, "stale", ["/workspace"]);
  await assert.rejects(
    requestContext({ cwd: "/workspace", discoveryDir: stale, timeoutMs: 100 }),
    /stale or unavailable|timed out/,
  );
});
