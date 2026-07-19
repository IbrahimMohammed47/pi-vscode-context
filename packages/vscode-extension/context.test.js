const assert = require('node:assert/strict');
const test = require('node:test');
const { buildContext, MAX_TEXT_BYTES } = require('./context');

class Position {
  constructor(line, character) {
    this.line = line;
    this.character = character;
  }
}

class Range {
  constructor(start, end) {
    this.start = start;
    this.end = end;
  }

  contains(value) {
    return (value.line > this.start.line || (value.line === this.start.line && value.character >= this.start.character))
      && (value.line < this.end.line || (value.line === this.end.line && value.character <= this.end.character));
  }
}

const vscode = {
  Position,
  Range,
  workspace: { asRelativePath: () => 'src/example.js' },
};

function fakeEditor(text, { start, end = start, active = end, visibleStart = 0, visibleEnd, dirty = true } = {}) {
  const lines = text.split('\n');
  const offset = ({ line, character }) => lines.slice(0, line).reduce((total, value) => total + value.length + 1, 0) + character;
  const selection = new Range(start, end);
  selection.active = active;
  selection.isEmpty = start.line === end.line && start.character === end.character;

  return {
    selection,
    visibleRanges: [new Range(new Position(visibleStart, 0), new Position(visibleEnd ?? lines.length - 1, lines.at(-1).length))],
    document: {
      uri: { scheme: 'file', fsPath: '/workspace/src/example.js', toString: () => 'file:///workspace/src/example.js' },
      languageId: 'javascript',
      version: 7,
      isDirty: dirty,
      lineCount: lines.length,
      lineAt(line) {
        return { range: new Range(new Position(line, 0), new Position(line, lines[line].length)) };
      },
      getText(range) {
        return range ? text.slice(offset(range.start), offset(range.end)) : text;
      },
    },
  };
}

test('missing active editor returns clear structured result', () => {
  assert.deepEqual(buildContext(vscode, undefined, 'current'), {
    error: {
      code: 'NO_ACTIVE_EDITOR',
      message: 'No active text editor exists. Open or focus a file in the matching VS Code window, then retry.',
    },
  });
});

test('current returns selected text and metadata', () => {
  const editor = fakeEditor('zero\nconst value = 1;\ntwo', {
    start: new Position(1, 0),
    end: new Position(1, 16),
  });
  const value = buildContext(vscode, editor, 'current');

  assert.equal(value.source, 'selection');
  assert.equal(value.text, 'const value = 1;');
  assert.deepEqual(value.range, { start: { line: 1, character: 0 }, end: { line: 1, character: 16 } });
  assert.equal(value.path, 'src/example.js');
  assert.equal('cursor' in value, false);
  assert.equal('truncated' in value, false);
});

test('current falls back to bounded visible context around cursor', () => {
  const text = Array.from({ length: 100 }, (_, line) => `line ${line}`).join('\n');
  const cursor = new Position(50, 3);
  const editor = fakeEditor(text, { start: cursor, visibleStart: 45, visibleEnd: 55 });
  const value = buildContext(vscode, editor, 'current');

  assert.equal(value.source, 'visible_context');
  assert.deepEqual(value.range.start, { line: 45, character: 0 });
  assert.deepEqual(value.range.end, { line: 55, character: 7 });
  assert.match(value.text, /^line 45\n/);
  assert.match(value.text, /line 55$/);
});

test('oversized document error tells agent how to recover', () => {
  const editor = fakeEditor('x'.repeat(MAX_TEXT_BYTES + 1), { start: new Position(0, 0) });
  const value = buildContext(vscode, editor, 'document');

  assert.equal(value.error.code, 'DOCUMENT_TOO_LARGE');
  assert.match(value.error.message, /use current|read the saved file/);
});

test('document returns complete unsaved in-memory text', () => {
  const text = 'const saved = false;\n// unsaved change';
  const editor = fakeEditor(text, { start: new Position(1, 3), dirty: true });
  const value = buildContext(vscode, editor, 'document');

  assert.equal(value.source, 'document');
  assert.equal(value.text, text);
  assert.equal(value.isDirty, true);
  assert.equal('range' in value, false);
  assert.equal('cursor' in value, false);
  assert.equal('truncated' in value, false);
});
