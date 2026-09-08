const { readFileSync, writeFileSync } = require("node:fs");
const { resolve } = require("node:path");

const version = process.argv[2];
if (
  !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(
    version ?? "",
  )
) {
  console.error("Usage: node scripts/set-version.js <semver>");
  process.exit(1);
}

const root = resolve(__dirname, "..");
const manifests = [
  "package.json",
  "packages/pi-vscode-context/package.json",
  "packages/vscode-extension/package.json",
];

function readJson(path) {
  try {
    return JSON.parse(readFileSync(resolve(root, path), "utf8"));
  } catch (error) {
    throw new Error(`Failed to read or parse ${path}: ${error.message}`);
  }
}

function writeJson(path, value) {
  writeFileSync(resolve(root, path), `${JSON.stringify(value, null, 2)}\n`);
}

for (const manifest of manifests) {
  const value = readJson(manifest);
  value.version = version;
  writeJson(manifest, value);
}

const lockfile = readJson("package-lock.json");
lockfile.version = version;
lockfile.packages[""].version = version;
lockfile.packages["packages/pi-vscode-context"].version = version;
lockfile.packages["packages/vscode-extension"].version = version;
writeJson("package-lock.json", lockfile);

console.log(`Set lockstep package version ${version}.`);
