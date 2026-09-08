const { readFileSync } = require("node:fs");
const { join } = require("node:path");

const root = join(__dirname, "..");
const tag = process.argv[2] ?? process.env.GITHUB_REF_NAME;

if (!tag || !/^v\d+\.\d+\.\d+$/.test(tag)) {
  throw new Error(
    `Expected a stable version tag such as v0.1.0; received ${tag ?? "nothing"}.`,
  );
}

const expected = tag.slice(1);
const manifests = [
  "package.json",
  "packages/pi-vscode-context/package.json",
  "packages/vscode-extension/package.json",
];

for (const manifest of manifests) {
  let version;
  try {
    ({ version } = JSON.parse(readFileSync(join(root, manifest), "utf8")));
  } catch (error) {
    throw new Error(`Failed to read or parse ${manifest}: ${error.message}`);
  }
  if (version !== expected) {
    throw new Error(
      `${manifest} has version ${version}; expected ${expected} from ${tag}.`,
    );
  }
}

console.log(`Verified lockstep version ${expected}.`);
