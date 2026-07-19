# Prefer most recently focused matching VS Code window

**Status:** Done

## Problem

Each VS Code window publishes an independent context server. When multiple windows open same workspace, Pi currently chooses most recently started server rather than window user most recently focused.

Different and nested projects already match by Pi `cwd`; longest matching workspace root wins.

## Proposed change

- Add `focused` and `lastFocusedAt` to discovery records.
- Track focus with `vscode.window.onDidChangeWindowState`.
- Atomically rewrite discovery record with mode `0600`.
- Serialize record updates to prevent stale writes during rapid focus changes.
- Order matching servers by:
  1. Longest matching workspace root
  2. Currently focused window
  3. Most recently focused window
  4. Most recently started server
- Fall back to next candidate only when preferred server is stale, unreachable, or rejects authentication.
- Do not fall back when selected live window returns `NO_ACTIVE_EDITOR`.
- Persist no editor contents or active-file metadata in discovery.

## Acceptance criteria

- Same project in multiple windows selects most recently focused window.
- Different projects remain isolated by Pi `cwd`.
- Nested workspace specificity wins over focus recency.
- Pi running in external terminal selects last-focused VS Code window.
- Stale preferred record falls back to next live match.
- Rapid focus changes preserve newest focus state.
- Discovery cleanup and existing authentication behavior remain intact.
