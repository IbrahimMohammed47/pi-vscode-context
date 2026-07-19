# Contributing

Thanks for helping improve Pi VS Code Context.

## Development

Use Node.js 22 or newer and npm 11.

```sh
npm ci
npm test
npm run check
```

To exercise the extension locally, open this repository in desktop VS Code and run **Run VS Code Context Extension** from **Run and Debug**. Install the Pi package from the workspace with:

```sh
pi install ./packages/pi-extension
```

## Pull requests

- Keep changes small and focused.
- Preserve loopback-only binding, bearer authentication, private atomic discovery files, output limits, abort signals, and timeouts.
- Never log or separately persist editor contents or diagnostics.
- Add focused tests for behavior changes.
- Update the relevant README and changelog entry.

Run the full verification suite before opening a pull request:

```sh
npm test
npm run check
npm run package:vscode
npm run pack:pi:dry-run
```

## Releases

Both packages use the same version. Stable tags must use the exact `vMAJOR.MINOR.PATCH` form and match every package manifest. The protected `release` environment gates npm publication and GitHub Release creation.

The VSIX is attached to the GitHub Release and uploaded to the Visual Studio Marketplace after review. Open VSX publishing is currently deferred.
