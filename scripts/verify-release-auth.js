const { spawnSync } = require('node:child_process');
const { resolve } = require('node:path');

const root = resolve(__dirname, '..');

function requireEnvironment(name) {
  if (!process.env[name]) {
    console.error(`${name} is required for automated releases.`);
    process.exit(1);
  }
}

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

requireEnvironment('NODE_AUTH_TOKEN');
requireEnvironment('VSCE_PAT');

run('npm', ['whoami']);
run('npx', ['--no-install', 'vsce', 'verify-pat', 'IbrahimMohammed']);
