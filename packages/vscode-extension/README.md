# pi-vscode-context

Companion VS Code extension that exposes active editor context and Problems diagnostics to local Pi sessions on demand.

## Install

Install **pi-vscode-context** from the VS Code Marketplace. Then install the Pi package:

```sh
pi install npm:pi-vscode-context
```

Open your project in desktop VS Code (local or Remote SSH) and start Pi on the workspace host with its `cwd` inside that project. There are no commands or settings to configure.

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
- **No active editor:** open or focus a file. When focus leaves the editor, the extension uses the last active editor if it is still visible, or the sole visible editor. It reads the live selection on demand; it never caches selected text or uses closed/hidden editors. Multiple visible editors without a known last active editor remain ambiguous.
- **Multiple windows:** focus the intended matching workspace before retrying.
- Remote SSH is supported when this extension is installed on the SSH host. Run Pi as the same remote OS user, inside a folder open in that window. Reload the window after installation. The server and private discovery files stay on the remote host; no port forwarding is needed.
- WSL, Dev Containers, Codespaces, and browser-based VS Code remain unsupported.
- If an older local copy activates instead, set `"remote.extensionKind": { "IbrahimMohammed.pi-vscode-context-vscode": ["workspace"] }` in local User Settings and reload the window.

## Source and license

[GitHub](https://github.com/IbrahimMohammed47/pi-vscode-context) · [MIT](LICENSE)
