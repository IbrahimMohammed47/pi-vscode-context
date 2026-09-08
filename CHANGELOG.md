# Changelog

All notable changes to this project will be documented here.

## Unreleased

### Added

- Remote SSH support with the companion extension and Pi running on the same workspace host.
- User-initiated Integrated Browser element picker and `vscode_browser_selection` tool, returning bounded DOM, selector, layout, and computed-style context.

### Fixed

- Resolve a live visible editor when active editor focus is lost, without caching selected text or retaining hidden/closed editors.

## [0.1.1] - 2026-07-19

## [0.1.1](https://github.com/IbrahimMohammed47/pi-vscode-context/compare/v0.1.0...v0.1.1) (2026-07-19)

### Bug Fixes

- **package:** Improve discovery metadata and documentation ([691c716](https://github.com/IbrahimMohammed47/pi-vscode-context/commit/691c716a8a0ff438a5d03dc57640779ac555f84b))

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

[0.1.1]: https://github.com/IbrahimMohammed47/pi-vscode-context/releases/tag/v0.1.1
