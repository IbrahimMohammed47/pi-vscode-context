const MAX_TEXT_BYTES = 48 * 1024;
const CONTEXT_LINES = 40;

function position(value) {
  return { line: value.line, character: value.character };
}

function range(value) {
  return { start: position(value.start), end: position(value.end) };
}

function metadata(vscode, document) {
  return {
    path: document.uri.scheme === 'file'
      ? vscode.workspace.asRelativePath(document.uri)
      : document.uri.toString(),
    languageId: document.languageId,
    isDirty: document.isDirty,
  };
}

function boundedText(text) {
  const bytes = Buffer.from(text);
  if (bytes.length <= MAX_TEXT_BYTES) return { text };
  return {
    text: new TextDecoder().decode(bytes.subarray(0, MAX_TEXT_BYTES)),
    truncated: true,
    originalBytes: bytes.length,
  };
}

function result(vscode, source, document, cursor, textRange, text) {
  return {
    source,
    ...metadata(vscode, document),
    ...(source === 'visible_context' ? { cursor: position(cursor) } : {}),
    ...(source !== 'document' ? { range: range(textRange) } : {}),
    ...boundedText(text),
  };
}

function buildContext(vscode, editor, scope) {
  if (!editor) {
    return {
      error: {
        code: 'NO_ACTIVE_EDITOR',
        message: 'No active text editor exists. Open or focus a file in the matching VS Code window, then retry.',
      },
    };
  }

  const { document, selection } = editor;
  const cursor = selection.active;

  if (scope === 'document') {
    const text = document.getText();
    if (Buffer.byteLength(text) > MAX_TEXT_BYTES) {
      return {
        error: {
          code: 'DOCUMENT_TOO_LARGE',
          message: `Active document exceeds ${MAX_TEXT_BYTES} UTF-8 bytes. Select narrower code and use current, or read the saved file from disk.`,
        },
      };
    }
    return result(vscode, 'document', document, cursor, undefined, text);
  }

  if (!selection.isEmpty) {
    return result(vscode, 'selection', document, cursor, selection, document.getText(selection));
  }

  const visible = editor.visibleRanges.find((visibleRange) => visibleRange.contains(cursor));
  const firstVisibleLine = visible?.start.line ?? 0;
  const lastVisibleLine = visible?.end.line ?? document.lineCount - 1;
  const startLine = Math.max(firstVisibleLine, cursor.line - CONTEXT_LINES);
  const endLine = Math.min(lastVisibleLine, cursor.line + CONTEXT_LINES, document.lineCount - 1);
  const contextRange = new vscode.Range(
    new vscode.Position(startLine, 0),
    document.lineAt(endLine).range.end,
  );

  return result(vscode, 'visible_context', document, cursor, contextRange, document.getText(contextRange));
}

module.exports = { buildContext, CONTEXT_LINES, MAX_TEXT_BYTES };
