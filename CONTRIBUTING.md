# Contributing

Thanks for helping improve `pi-vscode-context`.

## Development

Use Node.js 22 or newer and npm 11.

```sh
npm ci
npm test
npm run check
```

To exercise the extension locally, open this repository in desktop VS Code and run **Run VS Code Context Extension** from **Run and Debug**. Install the Pi package from the workspace with:

```sh
pi install ./packages/pi-vscode-context
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

Merges to `main` release automatically after CI passes. `semantic-release` derives the next lockstep package version from Conventional Commit messages:

- `fix:` creates a patch release.
- `feat:` creates a minor release.
- `BREAKING CHANGE:` in the commit footer creates a major release.
- Other commit types do not release by default.

The release job publishes the Pi package to npm, uploads the VSIX to the Visual Studio Marketplace, creates the version tag, updates `CHANGELOG.md` and package manifests, and attaches both archives to the GitHub Release. Open VSX publishing is currently deferred.

The GitHub repository must provide `NPM_TOKEN` and `VSCE_PAT` Actions secrets. Authentication is verified before semantic-release creates a tag.
