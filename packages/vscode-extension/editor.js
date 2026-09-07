// Keep only a live editor reference, never a copy of document or selection text.
function trackEditor(window, subscriptions) {
  let lastEditor = window.activeTextEditor;
  subscriptions.push(window.onDidChangeActiveTextEditor((editor) => {
    if (editor) lastEditor = editor;
  }));
  subscriptions.push(window.onDidChangeVisibleTextEditors((editors) => {
    if (!editors.includes(lastEditor)) lastEditor = undefined;
  }));
  subscriptions.push({ dispose() { lastEditor = undefined; } });

  return () => {
    if (window.activeTextEditor) return window.activeTextEditor;
    const visible = window.visibleTextEditors.filter((editor) => !editor.document.isClosed);
    if (visible.includes(lastEditor)) return lastEditor;
    // At activation there may already be a single visible, unfocused editor.
    // Never guess between multiple editors without a known active editor.
    return visible.length === 1 ? visible[0] : undefined;
  };
}

module.exports = { trackEditor };
