const { randomBytes, timingSafeEqual } = require('node:crypto');
const { mkdir, chmod, rename, rm, writeFile } = require('node:fs/promises');
const { createServer } = require('node:http');
const { homedir } = require('node:os');
const { join, resolve } = require('node:path');

const HOST = '127.0.0.1';
const MAX_RESPONSE_BYTES = 64 * 1024;
const defaultDiscoveryDir = join(homedir(), '.pi-vscode-context', 'instances');

function authorized(header, token) {
  if (typeof header !== 'string') return false;
  const actual = Buffer.from(header);
  const expected = Buffer.from(`Bearer ${token}`);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function sendJson(response, status, value) {
  let body = JSON.stringify(value);
  if (Buffer.byteLength(body) > MAX_RESPONSE_BYTES) {
    status = 413;
    body = JSON.stringify({
      error: { code: 'RESPONSE_TOO_LARGE', message: 'VS Code response exceeded safe output limit. Use a narrower scope and retry.' },
    });
  }
  response.writeHead(status, {
    'cache-control': 'no-store',
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
  });
  response.end(body);
}

async function startServer({
  getContext,
  getDiagnostics,
  workspaceFolders,
  focused = false,
  discoveryDir = defaultDiscoveryDir,
}) {
  const resolvedWorkspaceFolders = workspaceFolders.map((folder) => resolve(folder));
  const token = randomBytes(32).toString('base64url');
  const id = randomBytes(16).toString('hex');
  const routes = {
    '/context': { scopes: new Set(['current', 'document']), handle: getContext },
    '/diagnostics': { scopes: new Set(['active', 'workspace']), handle: getDiagnostics },
  };
  const server = createServer(async (request, response) => {
    let url;
    try {
      url = new URL(request.url, `http://${HOST}`);
    } catch {
      return sendJson(response, 400, { error: { code: 'BAD_REQUEST', message: 'Invalid request URL.' } });
    }

    const route = routes[url.pathname];
    if (request.method !== 'GET' || !route?.handle) {
      return sendJson(response, 404, { error: { code: 'NOT_FOUND', message: 'Not found.' } });
    }
    if (!authorized(request.headers.authorization, token)) {
      return sendJson(response, 401, {
        error: { code: 'UNAUTHORIZED', message: 'Missing or invalid bearer token.' },
      });
    }

    const scope = url.searchParams.get('scope');
    if (!route.scopes.has(scope)) {
      return sendJson(response, 400, {
        error: { code: 'INVALID_SCOPE', message: `Invalid ${url.pathname.slice(1)} scope.` },
      });
    }

    try {
      sendJson(response, 200, await route.handle(scope));
    } catch {
      sendJson(response, 500, {
        error: { code: 'VSCODE_REQUEST_ERROR', message: 'VS Code could not read requested data. Retry once; if it persists, reload the matching VS Code window.' },
      });
    }
  });

  await new Promise((accept, reject) => {
    server.once('error', reject);
    server.listen(0, HOST, accept);
  });

  const address = server.address();
  const endpoint = `http://${HOST}:${address.port}`;
  const discoveryFile = join(discoveryDir, `${id}.json`);
  const temporaryFile = `${discoveryFile}.${process.pid}.tmp`;
  const now = Date.now();
  const record = {
    version: 1,
    id,
    endpoint,
    token,
    workspaceFolders: resolvedWorkspaceFolders,
    focused,
    lastFocusedAt: focused ? now : 0,
    pid: process.pid,
    createdAt: now,
  };
  let writes = Promise.resolve();
  let closed = false;

  function writeDiscovery() {
    const body = JSON.stringify(record);
    writes = writes.catch(() => {}).then(async () => {
      await writeFile(temporaryFile, body, { encoding: 'utf8', mode: 0o600 });
      await rename(temporaryFile, discoveryFile);
    });
    return writes;
  }

  try {
    await mkdir(discoveryDir, { recursive: true, mode: 0o700 });
    await chmod(discoveryDir, 0o700);
    await writeDiscovery();
  } catch (error) {
    server.close();
    await rm(temporaryFile, { force: true });
    throw error;
  }

  let stopping;
  return {
    endpoint,
    discoveryFile,
    updateFocus(nextFocused) {
      if (closed) return Promise.resolve();
      record.focused = nextFocused;
      if (nextFocused) record.lastFocusedAt = Date.now();
      return writeDiscovery();
    },
    stop() {
      stopping ??= (async () => {
        closed = true;
        await writes.catch(() => {});
        await rm(discoveryFile, { force: true });
        await rm(temporaryFile, { force: true });
        server.closeAllConnections?.();
        await new Promise((accept) => server.close(accept));
      })();
      return stopping;
    },
  };
}

module.exports = { defaultDiscoveryDir, MAX_RESPONSE_BYTES, startServer };
