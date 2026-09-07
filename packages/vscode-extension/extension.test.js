const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { test } = require('node:test');
const { runInNewContext } = require('node:vm');

for (const remoteName of [undefined, 'ssh-remote', 'dev-container']) {
  test(`activation supports only local and SSH hosts: ${remoteName}`, async () => {
    let options;
    const warnings = [];
    const vscode = {
      env: { remoteName },
      workspace: {
        workspaceFolders: [{ uri: { scheme: 'file', fsPath: '/workspace/project' } }],
        onDidChangeWorkspaceFolders: () => ({ dispose() {} }),
      },
      window: {
        state: { focused: true },
        onDidChangeWindowState: () => ({ dispose() {} }),
        onDidChangeActiveTextEditor: () => ({ dispose() {} }),
        onDidChangeVisibleTextEditors: () => ({ dispose() {} }),
        visibleTextEditors: [],
        showWarningMessage: (message) => warnings.push(message),
        showErrorMessage: (message) => assert.fail(message),
      },
    };
    const service = { updateFocus: async () => {}, updateWorkspaceFolders: async () => {}, stop: async () => {} };
    const module = { exports: {} };
    runInNewContext(readFileSync(join(__dirname, 'extension.js'), 'utf8'), {
      module,
      require: (name) => name === 'vscode' ? vscode
        : name === './server' ? { startServer: async (value) => { options = value; return service; } }
        : name === './editor' ? require('./editor') : {},
    });
    await module.exports.activate({ subscriptions: [] });
    if (remoteName === 'dev-container') {
      assert.equal(options, undefined);
      assert.equal(warnings.length, 1);
    } else {
      assert.equal(options.workspaceFolders[0], '/workspace/project');
      assert.equal(warnings.length, 0);
    }
    await module.exports.deactivate();
  });
}

test('extension runs on the workspace host', () => {
  assert.deepEqual(require('./package.json').extensionKind, ['workspace']);
});
