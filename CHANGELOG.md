# Changelog

All notable changes to this project will be documented here.

## [0.1.0] - 2026-07-19

### Added

- Read-only `vscode_context` tool for active-editor metadata and nullable selected code.
- Read-only `vscode_diagnostics` tool for active-file and workspace diagnostics.
- Authenticated loopback discovery in a user-specific OS temp runtime directory, with workspace/focus-aware selection and opportunistic stale-record cleanup.
- Bounded responses, abort handling, timeouts, and stale-window fallback.

### Fixed

- Return absolute file paths for reliable nested and multi-root workspace access.
- Refresh discovery roots when VS Code workspace folders change.
- Account for JSON escaping when bounding selected-code responses.

[0.1.0]: https://github.com/IbrahimMohammed47/pi-vscode-context/releases/tag/v0.1.0
