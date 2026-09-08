# Architecture and Tool Decisions

This document records current product, tool, transport, security, and scope decisions for `pi-vscode-context`.

## Purpose

Expose IDE-only state to Pi without replacing Pi's normal repository tools.

The integration answers questions that filesystem tools cannot answer reliably:

- Which editor/file is active?
- Where is the cursor?
- What code is currently selected, including unsaved selection?
- What diagnostics are currently reported by VS Code language extensions?
- Which rendered element did the user explicitly pick in VS Code's Integrated Browser?

Normal Pi tools remain responsible for reading files, searching, editing, Git, and tests.

## Packages

```text
packages/vscode-extension
  VS Code APIs, local HTTP server, discovery, context, browser element capture, diagnostics

packages/pi-vscode-context
  Pi tool definitions, discovery client, authenticated requests
```

No shared package exists. Small duplicated constants are cheaper than another package and release boundary.

## Process model

Each VS Code window runs a separate extension-host process and therefore starts its own server.

```text
VS Code window A ── authenticated HTTP server A ── discovery record A
VS Code window B ── authenticated HTTP server B ── discovery record B
                                      ▲
                                      │ workspace/focus selection
                                      │
                                     Pi
```

Pi does not need to run in VS Code's integrated terminal. It may run in any terminal under the same OS user on the workspace host. The extension uses `extensionKind: ["workspace"]`; in Remote SSH, both the server and Pi run remotely, with unchanged loopback transport and private discovery. No SSH port forwarding is needed.

## Communication technology

Communication uses Node's `node:http` server and standard `fetch`:

- Bind only to `127.0.0.1`
- Ask OS for random available port
- Use short request/response calls
- Return compact JSON
- Authenticate every request with bearer token
- Apply three-second client timeout and Pi execution abort signal
- Bound responses before returning them to model

### Why HTTP

HTTP is built into both runtimes, cross-platform, easy to test, and appropriate for infrequent read requests. No transport dependency or framework is needed.

### Rejected alternatives

- **VS Code terminal injection:** couples Pi to integrated terminal, cannot support external terminals, and risks accidental submission.
- **stdio:** requires VS Code to launch and own Pi process.
- **WebSocket/SSE:** no streaming or server-pushed events exist.
- **Files as request transport:** polling, races, cleanup, and content persistence.
- **Unix sockets/named pipes:** platform-specific complexity without meaningful same-user security improvement.
- **MCP/JSON-RPC:** protocol and dependency overhead for two small endpoints.
- **HTTPS:** no useful protection against same-user software that can read discovery token.

Reconsider transport only if product adds continuous events, remote support, high-frequency updates, or large binary payloads.

## Discovery and window selection

Discovery records live at:

```text
<os.tmpdir>/pi-vscode-context-<user-id>/instances/*.json
```

Each record contains endpoint, token, process metadata, workspace roots, focus state, focus timestamp, and creation time. Records never contain editor contents or diagnostics.

Both packages derive the same runtime path from `os.tmpdir()` and numeric user ID on Unix. Platforms without `getuid()` use a short SHA-256 hash of home directory so records remain separated by user.

Permissions and lifecycle:

- User runtime and `instances` directories: `0700`
- Record: `0600`
- Writes: temporary file plus atomic rename
- Focus updates: serialized to avoid stale write ordering
- Deactivation: close server and remove record
- Malformed records: removed during discovery
- Dead/auth-invalid records: removed after failed request
- Crash leftovers: harmless until Pi removes them; OS temp cleanup provides final fallback

One record belongs to one editor window and advertises all its current workspace roots. Workspace-folder changes atomically rewrite the record. Records are intentionally not grouped by normalized project path: Pi `cwd` may be below a workspace root, windows may be multi-root, normalized paths can collide, and duplicate per-project records make focus updates and cleanup less reliable. Scanning live per-window records is bounded by number of open editor windows and preserves current focus routing without a shared lock or registry file.

Pi ranks matching records by:

1. Longest workspace-root match for Pi `cwd`
2. Currently focused VS Code window
3. Most recently focused matching window
4. Most recently started server

If preferred record is stale, unreachable, or rejects authentication, Pi tries next match. A valid response such as `NO_ACTIVE_EDITOR` does not fall through to another window.

## Security model

Each activation generates fresh 256-bit bearer token. Client accepts only `http://127.0.0.1` discovery endpoints. Server sends `Cache-Control: no-store`, does not enable CORS, and does not log request or response content.

Threat boundary is local OS user. Token and file permissions protect against other users and unauthenticated browser/local requests. Malicious software running as same user is out of scope because it can generally inspect user-owned files and processes regardless of local transport.

## Tool boundary

Tools expose only transient IDE state. They must not become alternative implementations of `read`, `grep`, `edit`, language-server navigation, or Git.

### `vscode_context()`

No arguments.

Use only when user refers to selected/highlighted/"this" code, current file, or cursor location. Do not use for named files or generic repository exploration.

Response:

```json
{
  "path": "/workspace/src/app.ts",
  "languageId": "typescript",
  "isDirty": false,
  "cursor": { "line": 42, "character": 8 },
  "selectedCode": null
}
```

When selection exists:

```json
{
  "path": "/workspace/src/app.ts",
  "languageId": "typescript",
  "isDirty": true,
  "cursor": { "line": 14, "character": 8 },
  "selectedCode": {
    "range": {
      "start": { "line": 10, "character": 2 },
      "end": { "line": 14, "character": 8 }
    },
    "text": "..."
  }
}
```

`selectedCode` is current VS Code editor selection. It remains selected when focus moves from editor to terminal, though VS Code renders it as inactive selection. It becomes `null` when selection collapses. It is not selection history; no selected text is retained. If `activeTextEditor` becomes undefined, a live reference to the last active editor is used only while that editor remains visible. A sole visible editor is also an unambiguous fallback at activation. Hidden/closed editors and ambiguous splits do not supply fallback context. Active diagnostics use the same editor resolution.

Selected text is bounded to 48KB and may be shortened further when JSON escaping would exceed the 64KB response bound. Truncated selection adds:

```json
{"truncated":true,"originalBytes":123456}
```

When `isDirty` is true, normal filesystem reads may be stale. Agent should use selected unsaved text when relevant, or ask user to save before reading unselected content.

Removed intentionally:

- Scope argument
- Full-document mode
- Visible-context fallback
- Unsaved-diff mode
- Open-tab list
- Generic file content

These overlapped normal Pi tools, increased token use, or exposed incidental UI state.

### `vscode_browser_selection()`

No arguments.

Use only when the user asks about an element in VS Code's built-in Integrated Browser. The user runs **Pi: Pick Integrated Browser Element**, then hovers and clicks the intended element.

Capture implementation:

1. Briefly attach VS Code's built-in `editor-browser` debugger to the active browser tab.
2. Inject a bounded, user-initiated element picker and immediately detach the debugger.
3. Highlight the hovered element and intercept one click without activating the page control.
4. Collect URL, selector, outerHTML, text, attributes, bounds, and key computed styles.
5. Transfer the marked JSON payload through the clipboard, restore the previous clipboard, and retain the snapshot in extension memory.
6. Return the stored snapshot when Pi calls the authenticated endpoint.

Response:

```json
{
  "selectedElement": {
    "url": "http://localhost:3000/",
    "tagName": "button",
    "selector": "button#save",
    "outerHTML": "<button id=\"save\">Save</button>",
    "text": "Save",
    "attributes": { "id": "save" },
    "rect": { "x": 10, "y": 20, "width": 80, "height": 32 },
    "computedStyle": { "display": "inline-block" }
  },
  "capturedAt": "2026-09-08T03:15:00.000Z"
}
```

Payload fields are bounded before clipboard transfer and the server enforces its 64KB response limit. The in-memory snapshot is replaced on each capture and disappears when the VS Code extension host stops. Before the first capture, the endpoint returns `NO_BROWSER_ELEMENT_CAPTURE`. The picker targets the built-in Integrated Browser; legacy Simple Browser and arbitrary third-party webviews remain unsupported.

### `vscode_diagnostics({ scope })`

```ts
vscode_diagnostics({ scope: "active" | "workspace" })
```

Use when user asks about VS Code errors/warnings or when IDE language-service validation is relevant. Do not use for general code review.

- `active`: diagnostics for active document; preferred when task concerns current file.
- `workspace`: diagnostics under roots associated with matched VS Code window; use only for project-wide checks.

Each diagnostic may contain absolute file path, zero-based end-exclusive range, severity, optional code/source, message, and optional `messageTruncated`.

Ordering:

1. Error, warning, information, hint
2. Path
3. Start line and character

Bounds:

- Maximum 200 diagnostics
- Maximum 48KB diagnostic result
- Maximum 4KB per message
- Truncated result includes `truncated: true` and total count

An empty list means VS Code currently reports no matching diagnostics. Diagnostics are a snapshot and can briefly lag edits; retry once if result conflicts with fresh changes.

## Agent routing

| User intent | Correct behavior |
| --- | --- |
| "Explain selected code" | `vscode_context()`, use `selectedCode` |
| "What file am I looking at?" | `vscode_context()`, use metadata |
| "Explain code at cursor" | `vscode_context()`, then targeted normal `read` |
| "Read `src/app.ts`" | Normal `read`; do not call VS Code tool |
| "Find callers" | Normal search/symbol tools |
| "Edit this file" | Normal `edit`/`write` |
| "What error is VS Code showing?" | `vscode_diagnostics({scope:"active"})` |
| "Any VS Code errors in project?" | `vscode_diagnostics({scope:"workspace"})` |
| "What is selected in the VS Code browser?" | Run **Pi: Pick Integrated Browser Element**, click it, then `vscode_browser_selection()` |

## Errors

Errors use compact shape:

```json
{"error":{"code":"NO_ACTIVE_EDITOR","message":"Actionable recovery guidance."}}
```

Expected recovery:

- `NO_ACTIVE_EDITOR`: open or focus file in matching window, then retry.
- Missing server: open matching local workspace with extension enabled.
- Stale/unavailable server: reload matching VS Code window, then retry.
- Timeout: retry once; reload matching window if persistent.
- Oversized response: use narrower diagnostic scope or smaller selection.
- Cancellation: stop without automatic retry.

## Data handling

VS Code reads editor and diagnostic state only when an authenticated request arrives. A browser element is captured only through the explicit picker command, stored in extension memory, and returned on an authenticated request. Capture briefly attaches the built-in browser debugger, injects a one-shot picker, transfers a bounded payload through the clipboard, and restores the prior clipboard. No automatic context injection, continuous copying, content logging, or separate persistence occurs.

Tool results follow normal Pi session persistence behavior because model must receive them.

## Supported environment

Supported:

- Local desktop VS Code
- Pi process under the same OS user on the workspace host
- Remote SSH with the companion extension installed on the SSH host
- Pi in integrated or external terminal
- Multiple VS Code windows and multi-root workspaces

Deferred:

- WSL
- Dev Containers
- Codespaces
- Browser-based VS Code
- Editor mutation/navigation
- Code actions
- MCP/LSP implementation
- Automatic prompt injection
