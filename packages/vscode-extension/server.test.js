const assert = require('node:assert/strict');
const { mkdtemp, readFile } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const test = require('node:test');
const { defaultDiscoveryDir, startServer } = require('./server');
const { defaultDiscoveryDir: clientDiscoveryDir } = require('../pi-extension/client');

const context = { path: 'src/app.ts', selectedCode: null };

test('server and Pi client derive the same user-specific runtime directory', () => {
  assert.equal(defaultDiscoveryDir, clientDiscoveryDir);
  assert.equal(defaultDiscoveryDir.startsWith(tmpdir()), true);
  assert.equal(defaultDiscoveryDir.endsWith('instances'), true);
});

test('server rejects requests without discovery bearer token', async () => {
  const discoveryDir = await mkdtemp(join(tmpdir(), 'pi-vscode-server-'));
  const service = await startServer({
    discoveryDir,
    workspaceFolders: ['/workspace'],
    getContext: async () => context,
  });

  try {
    const record = JSON.parse(await readFile(service.discoveryFile, 'utf8'));
    const response = await fetch(`${record.endpoint}/context`);
    assert.equal(response.status, 401);
    assert.equal((await response.json()).error.code, 'UNAUTHORIZED');
  } finally {
    await service.stop();
  }
  await assert.rejects(readFile(service.discoveryFile, 'utf8'), { code: 'ENOENT' });
});

test('server routes authenticated context, diagnostics, and browser-selection requests', async () => {
  const discoveryDir = await mkdtemp(join(tmpdir(), 'pi-vscode-diagnostics-'));
  const service = await startServer({
    discoveryDir,
    workspaceFolders: ['/workspace'],
    getContext: async () => context,
    getDiagnostics: async (scope) => ({ diagnostics: [{ scope }] }),
    getBrowserSelection: async () => ({ selectedElement: { selector: 'button#save' } }),
  });

  try {
    const record = JSON.parse(await readFile(service.discoveryFile, 'utf8'));
    const headers = { authorization: `Bearer ${record.token}` };
    const contextResponse = await fetch(`${record.endpoint}/context`, { headers });
    assert.equal(contextResponse.status, 200);
    assert.deepEqual(await contextResponse.json(), context);

    const diagnosticsResponse = await fetch(`${record.endpoint}/diagnostics?scope=workspace`, { headers });
    assert.equal(diagnosticsResponse.status, 200);
    assert.deepEqual(await diagnosticsResponse.json(), { diagnostics: [{ scope: 'workspace' }] });

    const browserResponse = await fetch(`${record.endpoint}/browser-selection`, { headers });
    assert.equal(browserResponse.status, 200);
    assert.deepEqual(await browserResponse.json(), { selectedElement: { selector: 'button#save' } });
  } finally {
    await service.stop();
  }
});

test('workspace-folder updates rewrite discovery state', async () => {
  const discoveryDir = await mkdtemp(join(tmpdir(), 'pi-vscode-workspaces-'));
  const service = await startServer({
    discoveryDir,
    workspaceFolders: ['/workspace/old'],
    getContext: async () => context,
  });

  try {
    await service.updateWorkspaceFolders(['/workspace/new', '/workspace/other']);
    const record = JSON.parse(await readFile(service.discoveryFile, 'utf8'));
    assert.deepEqual(record.workspaceFolders, ['/workspace/new', '/workspace/other']);
  } finally {
    await service.stop();
  }
});

test('serialized focus updates leave newest state in discovery', async () => {
  const discoveryDir = await mkdtemp(join(tmpdir(), 'pi-vscode-focus-'));
  const service = await startServer({
    discoveryDir,
    workspaceFolders: ['/workspace'],
    focused: false,
    getContext: async () => context,
  });

  try {
    await Promise.all([
      service.updateFocus(true),
      service.updateFocus(false),
      service.updateFocus(true),
    ]);
    const record = JSON.parse(await readFile(service.discoveryFile, 'utf8'));
    assert.equal(record.focused, true);
    assert.ok(record.lastFocusedAt > 0);
  } finally {
    await service.stop();
  }
});
