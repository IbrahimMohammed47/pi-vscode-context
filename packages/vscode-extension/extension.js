const vscode = require('vscode');
const { buildContext } = require('./context');
const { buildDiagnostics } = require('./diagnostics');
const { startServer } = require('./server');

let service;

function fileWorkspaceFolders() {
  return (vscode.workspace.workspaceFolders ?? [])
    .filter((folder) => folder.uri.scheme === 'file')
    .map((folder) => folder.uri.fsPath);
}

async function activate(context) {
  if (vscode.env.remoteName) {
    vscode.window.showWarningMessage('Pi VS Code Context currently supports local desktop workspaces only.');
    return;
  }

  let workspaceFolders = fileWorkspaceFolders();
  let focused = vscode.window.state.focused;
  context.subscriptions.push(vscode.window.onDidChangeWindowState((state) => {
    focused = state.focused;
    void service?.updateFocus(focused).catch(() => {});
  }));
  context.subscriptions.push(vscode.workspace.onDidChangeWorkspaceFolders(() => {
    workspaceFolders = fileWorkspaceFolders();
    void service?.updateWorkspaceFolders(workspaceFolders).catch(() => {});
  }));

  try {
    service = await startServer({
      workspaceFolders,
      focused,
      getContext: () => buildContext(vscode, vscode.window.activeTextEditor),
      getDiagnostics: (scope) => buildDiagnostics(
        vscode,
        vscode.window.activeTextEditor,
        scope,
        workspaceFolders,
      ),
    });
    await service.updateFocus(focused);
    await service.updateWorkspaceFolders(workspaceFolders);
    context.subscriptions.push({ dispose: () => void service?.stop() });
  } catch {
    await service?.stop();
    service = undefined;
    vscode.window.showErrorMessage('Pi VS Code Context could not start its local context server.');
  }
}

async function deactivate() {
  await service?.stop();
  service = undefined;
}

module.exports = { activate, deactivate };
