const MAX_SELECTION_BYTES = 48 * 1024;
const MAX_RESPONSE_BYTES = 64 * 1024;

function position(value) {
  return { line: value.line, character: value.character };
}

function range(value) {
  return { start: position(value.start), end: position(value.end) };
}

function selectedCode(document, selection) {
  if (selection.isEmpty) return null;

  const text = document.getText(selection);
  const bytes = Buffer.from(text);
  return {
    range: range(selection),
    text: bytes.length <= MAX_SELECTION_BYTES
      ? text
      : new TextDecoder().decode(bytes.subarray(0, MAX_SELECTION_BYTES)),
    ...(bytes.length > MAX_SELECTION_BYTES
      ? { truncated: true, originalBytes: bytes.length }
      : {}),
  };
}

function fitSerializedSelection(result, originalBytes) {
  if (!result.selectedCode || Buffer.byteLength(JSON.stringify(result)) <= MAX_RESPONSE_BYTES) return result;

  const characters = [...result.selectedCode.text];
  let low = 0;
  let high = characters.length;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    const candidate = {
      ...result,
      selectedCode: {
        ...result.selectedCode,
        text: characters.slice(0, middle).join(''),
        truncated: true,
        originalBytes,
      },
    };
    if (Buffer.byteLength(JSON.stringify(candidate)) <= MAX_RESPONSE_BYTES) low = middle;
    else high = middle - 1;
  }

  return {
    ...result,
    selectedCode: {
      ...result.selectedCode,
      text: characters.slice(0, low).join(''),
      truncated: true,
      originalBytes,
    },
  };
}

function buildContext(vscode, editor) {
  if (!editor) {
    return {
      error: {
        code: 'NO_ACTIVE_EDITOR',
        message: 'No active text editor exists. Open or focus a file in the matching VS Code window, then retry.',
      },
    };
  }

  const { document } = editor;
  const code = selectedCode(document, editor.selection);
  return fitSerializedSelection({
    path: document.uri.scheme === 'file' ? document.uri.fsPath : document.uri.toString(),
    languageId: document.languageId,
    isDirty: document.isDirty,
    cursor: position(editor.selection.active),
    selectedCode: code,
  }, code?.originalBytes ?? (code ? Buffer.byteLength(code.text) : 0));
}

module.exports = { buildContext, MAX_SELECTION_BYTES };
