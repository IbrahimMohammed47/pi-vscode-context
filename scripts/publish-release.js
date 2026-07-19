const { existsSync } = require('node:fs');
const { spawnSync } = require('node:child_process');
const { resolve } = require('node:path');

const version = process.argv[2];
if (!/^\d+\.\d+\.\d+$/.test(version ?? '')) {
  console.error('Usage: node scripts/publish-release.js <version>');
  process.exit(1);
}

if (!process.env.VSCE_PAT) {
  console.error('VSCE_PAT is required to publish the VS Code extension.');
  process.exit(1);
}

if (!process.env.NODE_AUTH_TOKEN && !process.env.ACTIONS_ID_TOKEN_REQUEST_URL) {
  console.error('npm publishing requires NPM_TOKEN or GitHub OIDC trusted publishing.');
  process.exit(1);
}

const root = resolve(__dirname, '..');
const npmPackage = resolve(root, `pi-vscode-context-${version}.tgz`);
const vsixPackage = resolve(
  root,
  'packages/vscode-extension',
  `pi-vscode-context-vscode-${version}.vsix`,
);

for (const artifact of [npmPackage, vsixPackage]) {
  if (!existsSync(artifact)) {
    console.error(`Missing release artifact: ${artifact}`);
    process.exit(1);
  }
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: 'inherit',
    ...options,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const published = spawnSync(
  'npm',
  ['view', `pi-vscode-context@${version}`, 'version'],
  { cwd: root, encoding: 'utf8' },
);

if (published.status === 0 && published.stdout.trim() === version) {
  console.log(`pi-vscode-context@${version} is already on npm; skipping.`);
} else {
  run('npm', ['publish', npmPackage, '--access', 'public']);
}

run('npx', [
  '--no-install',
  'vsce',
  'publish',
  '--packagePath',
  vsixPackage,
  '--skip-duplicate',
]);
