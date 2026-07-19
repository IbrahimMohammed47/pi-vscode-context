const assert = require('node:assert/strict');
const test = require('node:test');
const { buildContext, MAX_SELECTION_BYTES } = require('./context');
const { MAX_RESPONSE_BYTES } = require('./server');

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
}

const vscode = {
  workspace: { asRelativePath: () => 'workspace/src/example.js' },
};

function fakeEditor(text, { start, end = start, active = end, dirty = true }) {
  const lines = text.split('\n');
  const offset = ({ line, character }) => lines.slice(0, line)
    .reduce((total, value) => total + value.length + 1, 0) + character;
  const selection = new Range(start, end);
  selection.active = active;
  selection.isEmpty = start.line === end.line && start.character === end.character;

  return {
    selection,
    document: {
      uri: { scheme: 'file', fsPath: '/workspace/src/example.js', toString: () => 'file:///workspace/src/example.js' },
      languageId: 'javascript',
      isDirty: dirty,
      getText: (range) => text.slice(offset(range.start), offset(range.end)),
    },
  };
}

test('missing active editor returns actionable error', () => {
  assert.deepEqual(buildContext(vscode, undefined), {
    error: {
      code: 'NO_ACTIVE_EDITOR',
      message: 'No active text editor exists. Open or focus a file in the matching VS Code window, then retry.',
    },
  });
});

test('returns absolute file path and selected code', () => {
  const editor = fakeEditor('zero\nconst value = 1;\ntwo', {
    start: new Position(1, 0),
    end: new Position(1, 16),
    dirty: true,
  });
  const value = buildContext(vscode, editor);

  assert.deepEqual(value, {
    path: '/workspace/src/example.js',
    languageId: 'javascript',
    isDirty: true,
    cursor: { line: 1, character: 16 },
    selectedCode: {
      range: { start: { line: 1, character: 0 }, end: { line: 1, character: 16 } },
      text: 'const value = 1;',
    },
  });
});

test('returns null selectedCode after selection collapses', () => {
  const cursor = new Position(1, 3);
  const value = buildContext(vscode, fakeEditor('zero\none', {
    start: cursor,
    dirty: false,
  }));

  assert.deepEqual(value, {
    path: '/workspace/src/example.js',
    languageId: 'javascript',
    isDirty: false,
    cursor: { line: 1, character: 3 },
    selectedCode: null,
  });
});

test('bounds large selected code without malformed output', () => {
  const text = 'x'.repeat(MAX_SELECTION_BYTES + 1);
  const value = buildContext(vscode, fakeEditor(text, {
    start: new Position(0, 0),
    end: new Position(0, text.length),
  }));

  assert.equal(value.selectedCode.truncated, true);
  assert.equal(value.selectedCode.originalBytes, MAX_SELECTION_BYTES + 1);
  assert.equal(Buffer.byteLength(value.selectedCode.text), MAX_SELECTION_BYTES);
  assert.doesNotThrow(() => JSON.stringify(value));
});

test('bounds serialized context when selected text expands during JSON encoding', () => {
  const text = '\\'.repeat(MAX_SELECTION_BYTES);
  const value = buildContext(vscode, fakeEditor(text, {
    start: new Position(0, 0),
    end: new Position(0, text.length),
  }));

  assert.ok(Buffer.byteLength(JSON.stringify(value)) <= MAX_RESPONSE_BYTES);
  assert.equal(value.selectedCode.truncated, true);
  assert.equal(value.selectedCode.originalBytes, MAX_SELECTION_BYTES);
});
