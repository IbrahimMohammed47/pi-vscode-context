# Pi ↔ VS Code Context

[![CI](https://github.com/IbrahimMohammed47/pi-vscode-context/actions/workflows/ci.yml/badge.svg)](https://github.com/IbrahimMohammed47/pi-vscode-context/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/pi-vscode-context)](https://www.npmjs.com/package/pi-vscode-context)
[![VS Code Marketplace](https://img.shields.io/visual-studio-marketplace/v/IbrahimMohammed.pi-vscode-context-vscode)](https://marketplace.visualstudio.com/items?itemName=IbrahimMohammed.pi-vscode-context-vscode)

Read the active local VS Code editor and its Problems diagnostics from Pi, only when the model requests them. The integration is read-only: it does not inject context automatically or mutate the editor.

## Install

1. Install **Pi VS Code Context** from the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=IbrahimMohammed.pi-vscode-context-vscode), or download the VSIX from [GitHub Releases](https://github.com/IbrahimMohammed47/pi-vscode-context/releases) and run **Extensions: Install from VSIX…** in VS Code.
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

## Behavior

- `vscode_context` returns absolute active-editor path, language, dirty state, cursor, and nullable `selectedCode`. It never reads generic file content.
- `vscode_diagnostics` returns current VS Code diagnostics with absolute file paths for the active document or matched workspace roots.
- Results are compact and bounded. Selected code and diagnostics reflect unsaved editor state.
- Positions are zero-based and range ends are exclusive.

Each VS Code window exposes an authenticated HTTP server on a random `127.0.0.1` port. Private records under `<os.tmpdir>/pi-vscode-context-<user-id>/instances` let Pi select the best matching window by workspace root and focus recency. Records track live multi-root folder changes. Malformed and dead records are removed opportunistically; records never contain editor contents or diagnostics.

Any process running as the same OS user can generally access user-owned files and processes. The bearer token protects against other users and unauthenticated local or browser requests, not malicious same-user software.

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

See [architecture and tool decisions](docs/ARCHITECTURE.md), [CONTRIBUTING.md](CONTRIBUTING.md), and [CHANGELOG.md](CHANGELOG.md).

## License

[MIT](LICENSE) © 2026 Ibrahim Mohammed
