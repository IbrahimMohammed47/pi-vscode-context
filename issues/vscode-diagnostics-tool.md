# Add on-demand VS Code diagnostics tool

**Status:** Done

## Goal

Register read-only Pi tool that retrieves VS Code language-server diagnostics on demand:

```ts
vscode_diagnostics({
  scope: "active" | "workspace"
})
```

This lets Pi verify edits against errors and warnings already available in VS Code Problems, including diagnostics based on unsaved editor state.

No diagnostics should be injected automatically.

## Behavior

### `scope: "active"`

Return diagnostics for active text document.

If no active text editor exists, return compact structured `NO_ACTIVE_EDITOR` error.

### `scope: "workspace"`

Return diagnostics whose URI belongs to workspace matched to Pi `cwd`.

Results must be bounded and sorted:

1. Errors before warnings, information, and hints
2. Path
3. Start position

If bounded, return truncation metadata without malformed JSON.

## Compact result shape

Positions are zero-based and range ends are exclusive, documented once in tool description.

```json
{"diagnostics":[{"path":"src/app.ts","range":{"start":{"line":8,"character":2},"end":{"line":8,"character":15}},"severity":"error","code":"TS2322","source":"ts","message":"Type 'undefined' is not assignable to type 'string'."}]}
```

Omit optional `code` and `source` when unavailable. Omit success boilerplate and empty optional fields.

## Implementation

- Extend existing authenticated VS Code loopback server with diagnostics request.
- Read diagnostics on demand through `vscode.languages.getDiagnostics()`.
- Keep VS Code extension read-only.
- Reuse existing workspace discovery, authentication, timeout, abort, output bounds, and stale-server handling.
- Register `vscode_diagnostics` in Pi extension using current Pi tool APIs.
- Return compact JSON, not pretty-printed JSON.
- Do not log or separately persist diagnostic messages.

## Complications

- Workspace diagnostics can be large; enforce line/byte/item limits and report truncation.
- Some language extensions publish diagnostics asynchronously. Tool returns current VS Code snapshot and must not wait indefinitely for language servers.
- Diagnostics can become stale immediately after edits; include no false freshness guarantee.
- Diagnostic codes may be strings, numbers, or structured values; normalize compactly and safely.
- Messages may contain multiline text; preserve valid JSON while bounding output.
- Non-file URIs need stable URI fallback when no workspace-relative path exists.
- Multi-root windows must filter diagnostics to roots associated with matched server.
- Multiple VS Code windows follow existing server-selection behavior; same-project focus routing remains separate pending issue.
- Authentication failures and stale discovery records must not leak diagnostics.

## Acceptance criteria

- Pi exposes `vscode_diagnostics` with `active` and `workspace` scopes.
- Active scope returns current document errors and warnings with path, range, severity, code/source when present, and message.
- Workspace scope excludes diagnostics outside matched workspace roots.
- Unsaved-buffer diagnostics are returned.
- No active editor produces clear structured error.
- Empty diagnostics return `{"diagnostics":[]}`.
- Large output remains valid compact JSON and reports truncation.
- Tool request honors Pi execution abort signal and bounded timeout.
- Existing authentication and workspace matching remain intact.
- Focused tests cover active diagnostics, workspace filtering, empty results, output bounding, and malformed/optional diagnostic fields.

## Out of scope

Automatic diagnostic injection, automatic post-edit checks, code actions, quick fixes, symbol/definition/reference tools, LSP implementation, editor mutations, navigation, remote VS Code, and diagnostic history.
