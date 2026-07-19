# pi-vscode-context

Companion VS Code extension that exposes active editor context and Problems diagnostics to local Pi sessions on demand.

## Install

Install **pi-vscode-context** from the VS Code Marketplace. Then install the Pi package:

```sh
pi install npm:pi-vscode-context
```

Open your project in local desktop VS Code and start Pi with its `cwd` inside that project. There are no commands or settings to configure.

## Privacy and security

- The extension is read-only and never changes editor state.
- Editor contents and diagnostics are returned only after an authenticated Pi tool request.
- It binds only to `127.0.0.1` on a random port.
- Private discovery records contain connection and current workspace metadata, never editor contents or diagnostics.
- Context and diagnostics use absolute file paths so Pi can address files from nested and multi-root working directories.
- Responses are bounded, are not cached, and are not logged.

Any process running as the same OS user can generally access user-owned files and processes. Authentication protects against other users and unauthenticated local or browser requests, not malicious same-user software.

## Troubleshooting

- **Pi cannot find VS Code:** ensure this extension is enabled and reload the VS Code window.
- **No active editor:** open or focus a file.
- **Multiple windows:** focus the intended matching workspace before retrying.
- Remote SSH, WSL, Dev Containers, Codespaces, and browser-based VS Code are intentionally unsupported.

## Source and license

[GitHub](https://github.com/IbrahimMohammed47/pi-vscode-context) · [MIT](LICENSE)
