# pi-vscode-context

Pi package providing read-only `vscode_context` and `vscode_diagnostics` tools for the companion **pi-vscode-context** extension.

## Install

First install the companion extension from the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=IbrahimMohammed.pi-vscode-context-vscode). Then run:

```sh
pi install npm:pi-vscode-context
```

Start Pi with its `cwd` inside a project open in local desktop VS Code.

## Tools

```ts
vscode_context()
```

Returns absolute active-editor path, language, dirty state, cursor, and nullable `selectedCode`. Selected code includes unsaved text and remains available when focus moves to the terminal. Generic file reading stays with Pi's normal `read`, `grep`, and edit tools.

```ts
vscode_diagnostics({ scope: "active" | "workspace" })
```

`active` returns diagnostics for the active document. `workspace` returns bounded diagnostics under matched workspace roots. File paths are absolute. Positions are zero-based and range ends are exclusive. Requests honor the Pi tool abort signal and have a three-second timeout.

No automatic context injection, editor writes, content logging, or separate content persistence occurs. Returned tool results follow normal Pi session behavior.

## Troubleshooting

- Ensure the companion extension is enabled in local desktop VS Code.
- Open the same project in VS Code and start Pi inside that project.
- Focus an editor before requesting active context or diagnostics.
- Reload the matching VS Code window if discovery becomes stale.

Remote VS Code environments are not supported.

## Source and license

[GitHub](https://github.com/IbrahimMohammed47/pi-vscode-context) · [MIT](LICENSE)
