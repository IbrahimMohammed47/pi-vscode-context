const { isAbsolute, relative, resolve } = require('node:path');

const MAX_DIAGNOSTICS = 200;
const MAX_DIAGNOSTIC_BYTES = 48 * 1024;
const MAX_MESSAGE_BYTES = 4 * 1024;
const SEVERITIES = ['error', 'warning', 'information', 'hint'];

function position(value) {
  return { line: value.line, character: value.character };
}

function diagnosticPath(_vscode, uri) {
  return uri.scheme === 'file' ? uri.fsPath : uri.toString();
}

function belongsToWorkspace(uri, workspaceFolders) {
  if (uri.scheme !== 'file') return false;
  const file = resolve(uri.fsPath);
  return workspaceFolders.some((folder) => {
    const child = relative(resolve(folder), file);
    return child === '' || (!child.startsWith('..') && !isAbsolute(child));
  });
}

function truncate(text, maxBytes) {
  const bytes = Buffer.from(text);
  return bytes.length <= maxBytes
    ? { text, truncated: false }
    : { text: new TextDecoder().decode(bytes.subarray(0, maxBytes)), truncated: true };
}

function diagnosticCode(code) {
  const value = code && typeof code === 'object' ? code.value : code;
  return typeof value === 'string' || typeof value === 'number' ? value : undefined;
}

function formatDiagnostic(vscode, uri, diagnostic) {
  const code = diagnosticCode(diagnostic.code);
  const message = truncate(String(diagnostic.message), MAX_MESSAGE_BYTES);
  return {
    path: diagnosticPath(vscode, uri),
    range: {
      start: position(diagnostic.range.start),
      end: position(diagnostic.range.end),
    },
    severity: SEVERITIES[diagnostic.severity] ?? 'unknown',
    ...(code === undefined ? {} : { code }),
    ...(diagnostic.source ? { source: diagnostic.source } : {}),
    message: message.text,
    ...(message.truncated ? { messageTruncated: true } : {}),
  };
}

function bounded(items) {
  const diagnostics = [];
  let bytes = Buffer.byteLength('{"diagnostics":[]}');
  for (const item of items) {
    const itemBytes = Buffer.byteLength(JSON.stringify(item)) + 1;
    if (diagnostics.length === MAX_DIAGNOSTICS || bytes + itemBytes > MAX_DIAGNOSTIC_BYTES) break;
    diagnostics.push(item);
    bytes += itemBytes;
  }
  return diagnostics.length === items.length
    ? { diagnostics }
    : { diagnostics, truncated: true, total: items.length };
}

function buildDiagnostics(vscode, editor, scope, workspaceFolders) {
  if (scope === 'active' && !editor) {
    return {
      error: {
        code: 'NO_ACTIVE_EDITOR',
        message: 'No active text editor exists. Open or focus a file in the matching VS Code window, then retry.',
      },
    };
  }

  const entries = scope === 'active'
    ? [[editor.document.uri, vscode.languages.getDiagnostics(editor.document.uri)]]
    : vscode.languages.getDiagnostics().filter(([uri]) => belongsToWorkspace(uri, workspaceFolders));

  const items = entries.flatMap(([uri, diagnostics]) => diagnostics.map((diagnostic) => ({
    rank: diagnostic.severity >= 0 && diagnostic.severity < SEVERITIES.length ? diagnostic.severity : SEVERITIES.length,
    value: formatDiagnostic(vscode, uri, diagnostic),
  })));

  items.sort((a, b) => a.rank - b.rank
    || a.value.path.localeCompare(b.value.path)
    || a.value.range.start.line - b.value.range.start.line
    || a.value.range.start.character - b.value.range.start.character);

  return bounded(items.map(({ value }) => value));
}

module.exports = {
  buildDiagnostics,
  MAX_DIAGNOSTICS,
  MAX_DIAGNOSTIC_BYTES,
};
