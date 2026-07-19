const assert = require('node:assert/strict');
const test = require('node:test');
const { buildDiagnostics, MAX_DIAGNOSTICS } = require('./diagnostics');

function uri(fsPath) {
  return { scheme: 'file', fsPath, toString: () => `file://${fsPath}` };
}

function diagnostic(message, severity, line, options = {}) {
  return {
    message,
    severity,
    range: {
      start: { line, character: 1 },
      end: { line, character: 4 },
    },
    ...options,
  };
}

function fakeVSCode(entries) {
  return {
    workspace: { asRelativePath: (value) => `workspace/${value.fsPath.replace('/workspace/', '')}` },
    languages: {
      getDiagnostics: (activeUri) => activeUri
        ? entries.find(([value]) => value.fsPath === activeUri.fsPath)?.[1] ?? []
        : entries,
    },
  };
}

test('active diagnostics are compact, normalized, and severity-sorted', () => {
  const activeUri = uri('/workspace/src/app.ts');
  const vscode = fakeVSCode([[activeUri, [
    diagnostic('warning', 1, 2),
    diagnostic('error', 0, 5, { code: { value: 'TS2322' }, source: 'ts' }),
  ]]]);
  const value = buildDiagnostics(vscode, { document: { uri: activeUri } }, 'active', ['/workspace']);

  assert.deepEqual(value, { diagnostics: [
    {
      path: '/workspace/src/app.ts',
      range: { start: { line: 5, character: 1 }, end: { line: 5, character: 4 } },
      severity: 'error',
      code: 'TS2322',
      source: 'ts',
      message: 'error',
    },
    {
      path: '/workspace/src/app.ts',
      range: { start: { line: 2, character: 1 }, end: { line: 2, character: 4 } },
      severity: 'warning',
      message: 'warning',
    },
  ] });
});

test('workspace diagnostics exclude files outside matched roots', () => {
  const vscode = fakeVSCode([
    [uri('/workspace/src/app.ts'), [diagnostic('inside', 0, 1)]],
    [uri('/other/app.ts'), [diagnostic('outside', 0, 1)]],
  ]);
  const value = buildDiagnostics(vscode, undefined, 'workspace', ['/workspace']);

  assert.deepEqual(value.diagnostics.map(({ message }) => message), ['inside']);
});

test('diagnostics return clear empty and missing-editor results', () => {
  const vscode = fakeVSCode([]);
  assert.deepEqual(buildDiagnostics(vscode, undefined, 'workspace', ['/workspace']), { diagnostics: [] });
  assert.deepEqual(buildDiagnostics(vscode, undefined, 'active', ['/workspace']), {
    error: {
      code: 'NO_ACTIVE_EDITOR',
      message: 'No active text editor exists. Open or focus a file in the matching VS Code window, then retry.',
    },
  });
});

test('diagnostics bound output and tolerate malformed optional fields', () => {
  const activeUri = uri('/workspace/src/app.ts');
  const diagnostics = [
    diagnostic('x'.repeat(5000), 0, 0, { code: { unexpected: true }, source: '' }),
    ...Array.from({ length: MAX_DIAGNOSTICS }, (_, line) => diagnostic(`warning ${line}`, 1, line + 1)),
  ];
  const value = buildDiagnostics(fakeVSCode([[activeUri, diagnostics]]), { document: { uri: activeUri } }, 'active', ['/workspace']);

  assert.equal(value.truncated, true);
  assert.equal(value.total, MAX_DIAGNOSTICS + 1);
  assert.ok(value.diagnostics.length <= MAX_DIAGNOSTICS);
  assert.equal(value.diagnostics[0].messageTruncated, true);
  assert.equal('code' in value.diagnostics[0], false);
  assert.equal('source' in value.diagnostics[0], false);
  assert.doesNotThrow(() => JSON.stringify(value));
});
