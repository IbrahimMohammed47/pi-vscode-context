const assert = require('node:assert/strict');
const { mkdtemp, readFile } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const test = require('node:test');
const { startServer } = require('./server');

test('server rejects requests without discovery bearer token', async () => {
  const discoveryDir = await mkdtemp(join(tmpdir(), 'pi-vscode-server-'));
  const service = await startServer({
    discoveryDir,
    workspaceFolders: ['/workspace'],
    getContext: async () => ({ source: 'selection' }),
  });

  try {
    const record = JSON.parse(await readFile(service.discoveryFile, 'utf8'));
    const response = await fetch(`${record.endpoint}/context?scope=current`);
    assert.equal(response.status, 401);
    assert.equal((await response.json()).error.code, 'UNAUTHORIZED');
  } finally {
    await service.stop();
  }
  await assert.rejects(readFile(service.discoveryFile, 'utf8'), { code: 'ENOENT' });
});

test('server routes authenticated diagnostics requests', async () => {
  const discoveryDir = await mkdtemp(join(tmpdir(), 'pi-vscode-diagnostics-'));
  const service = await startServer({
    discoveryDir,
    workspaceFolders: ['/workspace'],
    getContext: async () => ({ source: 'selection' }),
    getDiagnostics: async (scope) => ({ diagnostics: [{ scope }] }),
  });

  try {
    const record = JSON.parse(await readFile(service.discoveryFile, 'utf8'));
    const response = await fetch(`${record.endpoint}/diagnostics?scope=workspace`, {
      headers: { authorization: `Bearer ${record.token}` },
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { diagnostics: [{ scope: 'workspace' }] });
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
    getContext: async () => ({ source: 'selection' }),
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
