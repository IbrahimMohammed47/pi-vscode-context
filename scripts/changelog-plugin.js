const { readFile, writeFile } = require('node:fs/promises');
const { resolve } = require('node:path');

const changelogPath = resolve(__dirname, '..', 'CHANGELOG.md');

async function prepare(_pluginConfig, { logger, nextRelease }) {
  const changelog = await readFile(changelogPath, 'utf8');
  const escapedVersion = nextRelease.version.replaceAll('.', '\\.');
  const existingHeading = new RegExp(`^## \\[?${escapedVersion}\\]?\\b`, 'm');

  if (existingHeading.test(changelog)) {
    logger.log(`CHANGELOG.md already documents ${nextRelease.version}; preserving it.`);
    return;
  }

  const date = new Date().toISOString().slice(0, 10);
  const notes = nextRelease.notes.trim().replace(/^# .+\n+/, '');
  const entry = `## [${nextRelease.version}] - ${date}\n\n${notes}\n\n`;
  const firstRelease = changelog.indexOf('\n## ');
  const withEntry = firstRelease === -1
    ? `${changelog.trimEnd()}\n\n${entry}`
    : `${changelog.slice(0, firstRelease + 1)}${entry}${changelog.slice(firstRelease + 1)}`;
  const releaseUrl = `https://github.com/IbrahimMohammed47/pi-vscode-context/releases/tag/v${nextRelease.version}`;

  await writeFile(
    changelogPath,
    `${withEntry.trimEnd()}\n\n[${nextRelease.version}]: ${releaseUrl}\n`,
  );
}

module.exports = { prepare };
