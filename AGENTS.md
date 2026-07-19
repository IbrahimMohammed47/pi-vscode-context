# AGENTS.md

## Project

Local, read-only `pi-vscode-context` integration in npm workspaces:

- `packages/vscode-extension`: authenticated loopback server backed by VS Code APIs
- `packages/pi-extension`: Pi tools `vscode_context` and `vscode_diagnostics`

## Guidelines

- Keep changes small, dependency-free where Node standard library suffices, and compatible with local desktop VS Code only.
- Preserve loopback-only binding, bearer authentication, private atomic discovery files, output bounds, abort signals, and timeouts.
- Never log or separately persist editor contents or diagnostics.
- Keep tool descriptions and JSON responses compact, actionable, and clear to AI agents.
- Avoid terminal coupling, automatic context injection, editor mutation, MCP/LSP, and remote support unless explicitly requested.

## Verification

Run:

```sh
npm test
```

Update package READMEs and relevant issue status when behavior changes.
