# pi-vscode-context

Pi package providing read-only `vscode_context`, `vscode_browser_selection`, and `vscode_diagnostics` tools for the companion **pi-vscode-context** extension.

## Install

First install the companion extension from the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=IbrahimMohammed.pi-vscode-context-vscode). Then run:

```sh
pi install npm:pi-vscode-context
```

Start Pi with its `cwd` inside a project open in desktop VS Code. For Remote SSH, install the companion extension on the SSH host and run Pi there as the same OS user; no port forwarding is needed.

## Tools

```ts
vscode_context()
```

Returns absolute active-editor path, language, dirty state, cursor, and nullable `selectedCode`. Selected code includes unsaved text and remains available when focus moves to the terminal. Generic file reading stays with Pi's normal `read`, `grep`, and edit tools.

```ts
vscode_browser_selection()
```

Returns the latest Integrated Browser element snapshot, including URL, selector, outerHTML, text, attributes, bounds, and key computed styles. Run **Pi: Pick Integrated Browser Element**, then hover and click an element. The user-initiated picker briefly attaches VS Code's built-in `editor-browser` debugger and restores the previous clipboard.

```ts
vscode_diagnostics({ scope: "active" | "workspace" })
```

`active` returns diagnostics for the active document. `workspace` returns bounded diagnostics under matched workspace roots. File paths are absolute. Positions are zero-based and range ends are exclusive. Requests honor the Pi tool abort signal and have a three-second timeout.

No automatic context injection, editor writes, content logging, or separate content persistence occurs. Returned tool results follow normal Pi session behavior.

## Troubleshooting

- Ensure the companion extension is enabled in local desktop VS Code.
- Open the same project in VS Code and start Pi inside that project.
- Focus an editor before requesting active context or diagnostics.
- For browser element capture, run **Pi: Pick Integrated Browser Element**, hover and click the intended element, and then ask Pi.
- Reload the matching VS Code window if discovery becomes stale.

Remote SSH is supported with the companion extension running on the remote workspace host. Other remote environments remain unsupported.

## Source and license

[GitHub](https://github.com/IbrahimMohammed47/pi-vscode-context) · [MIT](LICENSE)
