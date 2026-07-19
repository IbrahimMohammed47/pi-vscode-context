# pi-vscode-context

[![CI](https://github.com/IbrahimMohammed47/pi-vscode-context/actions/workflows/ci.yml/badge.svg)](https://github.com/IbrahimMohammed47/pi-vscode-context/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/pi-vscode-context)](https://www.npmjs.com/package/pi-vscode-context)
[![VS Code Marketplace](https://img.shields.io/visual-studio-marketplace/v/IbrahimMohammed.pi-vscode-context-vscode)](https://marketplace.visualstudio.com/items?itemName=IbrahimMohammed.pi-vscode-context-vscode)

Read the active local VS Code editor and its Problems diagnostics from Pi, only when the model requests them. The integration is read-only: it does not inject context automatically or mutate the editor.

## Why this exists

AI coding has two camps. One wants to fire the editor and let the agent drive. The other wants AI on the team, not holding the steering wheel.

`pi-vscode-context` is for the second camp. You keep VS Code, Pi gets the editor context it actually needs, and nobody has to paste the same code into chat for the hundredth time.

## Install

1. Install **pi-vscode-context** from the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=IbrahimMohammed.pi-vscode-context-vscode), or download the VSIX from [GitHub Releases](https://github.com/IbrahimMohammed47/pi-vscode-context/releases) and run **Extensions: Install from VSIX…** in VS Code.
2. Install the Pi package:

   ```sh
   pi install npm:pi-vscode-context
   ```

3. Open your project in local desktop VS Code, then start Pi with its `cwd` inside that project.

The model can now call:

```ts
vscode_context()
vscode_diagnostics({ scope: "active" | "workspace" })
```

## Usage

To check that the connection is working, add this intentionally broken function to a file:

```js
function factorial(n) {
  if (n === 0) return 0;
  return n * factorial(n - 1);
}
```

1. Select the entire function in VS Code.
2. Ask Pi:

   ```text
   Fix the bug in this selected code.
   ```

Pi should use `vscode_context`, spot the incorrect factorial base case, and fix it using its normal editing tools. The bridge itself remains read-only; it only gives Pi the live editor context needed to understand your request.

▶️ [Watch the full demo on Loom](https://www.loom.com/share/a5127e8752b34280b1d28ed6fdf29324)

## Example prompts

Use natural language—Pi decides when the editor context is relevant and calls the appropriate tool.

| User message | Tool and behavior |
|---|---|
| “What code am I selecting in VS Code?” | `vscode_context()` returns the current selection. |
| “Explain this highlighted function.” | `vscode_context()` supplies the selected code, including unsaved edits. |
| “Explain the code at my cursor.” | `vscode_context()` identifies the path and cursor; Pi can then use its normal file-reading tools for the surrounding code. |
| “Explain the red squiggles in this file.” | `vscode_diagnostics({ scope: "active" })` returns errors and warnings reported by VS Code language tooling. |
| “Are there any VS Code errors or warnings across this workspace?” | `vscode_diagnostics({ scope: "workspace" })` checks diagnostics under the matched workspace roots. |

The bridge also supports multiple local VS Code windows and multi-root workspaces, works whether Pi runs in an integrated or external terminal, and reflects unsaved selections and diagnostics. Context is fetched only on demand and the bridge never edits the editor.

## Behavior

- `vscode_context` returns absolute active-editor path, language, dirty state, cursor, and nullable `selectedCode`. It never reads generic file content.
- `vscode_diagnostics` returns current VS Code diagnostics with absolute file paths for the active document or matched workspace roots.
- Results are compact and bounded. Selected code and diagnostics reflect unsaved editor state.
- Positions are zero-based and range ends are exclusive.

Each VS Code window exposes an authenticated HTTP server on a random `127.0.0.1` port. Private records under `<os.tmpdir>/pi-vscode-context-<user-id>/instances` let Pi select the best matching window by workspace root and focus recency. Records track live multi-root folder changes. Malformed and dead records are removed opportunistically; records never contain editor contents or diagnostics.

Any process running as the same OS user can generally access user-owned files and processes. The bearer token protects against other users and unauthenticated local or browser requests, not malicious same-user software.

## Architecture

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the process model, authenticated loopback transport, workspace discovery, security boundary, tool-routing decisions, and rejected alternatives.

## Troubleshooting

- **No VS Code server found:** install and enable the VS Code extension, open the same project in local desktop VS Code, and reload the window.
- **No active editor:** focus a file in the matching VS Code window.
- **Dirty file:** save it before filesystem reads, or select relevant unsaved code so `selectedCode` can carry it.
- **Stale or unavailable connection:** reload the matching VS Code window and retry once.
- **Wrong window:** focus the intended VS Code window; Pi prefers the most recently focused matching workspace.
- Remote SSH, WSL, Dev Containers, Codespaces, and browser-based VS Code are intentionally unsupported.

## Development

Requires Node.js 22 or newer.

```sh
npm ci
npm test
npm run check
npm run package:vscode
npm run pack:pi:dry-run
```

See [CONTRIBUTING.md](CONTRIBUTING.md) and [CHANGELOG.md](CHANGELOG.md).

## License

[MIT](LICENSE) © 2026 Ibrahim Mohammed
