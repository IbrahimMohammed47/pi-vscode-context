# Security policy

## Supported versions

Security fixes are provided for the latest published version.

## Reporting a vulnerability

Please do not open a public issue for a suspected vulnerability. Use [GitHub private vulnerability reporting](https://github.com/IbrahimMohammed47/pi-vscode-context/security/advisories/new) and include reproduction steps, impact, and any suggested mitigation.

You should receive an initial response within seven days. Please allow time for a fix and coordinated release before public disclosure.

## Security model

The VS Code extension binds only to `127.0.0.1`, authenticates every request with a per-window bearer token, and stores private discovery records without editor contents or diagnostics. A malicious process already running as the same OS user is outside this trust boundary.
