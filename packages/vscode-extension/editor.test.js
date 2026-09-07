const assert = require('node:assert/strict');
const { test } = require('node:test');
const { trackEditor } = require('./editor');

function setup() {
  let activeChanged, visibleChanged;
  const a = { document: { isClosed: false }, selection: { isEmpty: false } };
  const b = { document: { isClosed: false } };
  const window = {
    activeTextEditor: a,
    visibleTextEditors: [a, b],
    onDidChangeActiveTextEditor(fn) { activeChanged = fn; return { dispose() {} }; },
    onDidChangeVisibleTextEditors(fn) { visibleChanged = fn; return { dispose() {} }; },
  };
  const get = trackEditor(window, []);
  return { a, b, window, get,
    activate(editor) { window.activeTextEditor = editor; activeChanged(editor); },
    show(editors) { window.visibleTextEditors = editors; visibleChanged(editors); },
  };
}

test('focus loss keeps the last visible editor and reads its live selection', () => {
  const s = setup();
  s.activate(undefined);
  assert.equal(s.get(), s.a);
  s.a.selection = { isEmpty: true };
  assert.equal(s.get().selection.isEmpty, true);
  s.activate(s.b);
  s.activate(undefined);
  assert.equal(s.get(), s.b);
});

test('hidden and closed editors are not retained', () => {
  const s = setup();
  s.activate(undefined);
  s.show([]);
  assert.equal(s.get(), undefined);
  s.show([s.a, s.b]);
  assert.equal(s.get(), undefined);
  s.show([s.a]);
  assert.equal(s.get(), s.a);
  s.a.document.isClosed = true;
  assert.equal(s.get(), undefined);
});

test('activation while unfocused uses a sole visible editor, not an arbitrary split', () => {
  const s = setup();
  s.window.activeTextEditor = undefined;
  const get = trackEditor(s.window, []);
  assert.equal(get(), undefined);
  s.window.visibleTextEditors = [s.b];
  assert.equal(get(), s.b);
});
