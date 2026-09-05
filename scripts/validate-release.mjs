import { readFileSync } from "node:fs";

const rootPackage = readJson("package.json");
const workspacePackageFiles = [
  "apps/api/package.json",
  "apps/web/package.json",
  "packages/db/package.json",
  "packages/domain/package.json",
  "packages/shared/package.json",
  "packages/validators/package.json",
];
const changelog = readFileSync("CHANGELOG.md", "utf8");
const readme = readFileSync("README.md", "utf8");
const version = rootPackage.version;
const tagArgumentIndex = process.argv.indexOf("--tag");
const tag = tagArgumentIndex >= 0 ? process.argv[tagArgumentIndex + 1] : undefined;

assertSemanticVersion(version, "package.json");

for (const file of workspacePackageFiles) {
  const packageContents = readJson(file);
  if (packageContents.version !== version) {
    fail(`${file} usa ${packageContents.version}; esperado ${version}.`);
  }
}

if (!new RegExp(`^## \\[${escapeRegex(version)}\\] - \\d{4}-\\d{2}-\\d{2}$`, "m").test(changelog)) {
  fail(`CHANGELOG.md não possui uma entrada datada para ${version}.`);
}

const firstReleasedVersion = changelog.match(
  /^## \[((?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*))\] - \d{4}-\d{2}-\d{2}$/m,
)?.[1];
if (firstReleasedVersion !== version) {
  fail(`A versão mais recente do CHANGELOG.md deve ser ${version}.`);
}

const releaseBody = changelog.match(
  new RegExp(
    `^## \\[${escapeRegex(version)}\\] - \\d{4}-\\d{2}-\\d{2}\\n+([\\s\\S]*?)(?=^## \\[|^\\[(?:Unreleased|\\d)|$)`,
    "m",
  ),
)?.[1];
const releaseSummary = releaseBody?.split(/^### /m)[0]?.trim();
if (!releaseSummary) {
  fail(`A versão ${version} precisa de um resumo antes das seções.`);
}

if (!readme.includes(`version-${version}-`)) {
  fail(`O badge de versão do README.md não usa ${version}.`);
}

if (tag !== undefined) {
  if (!/^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(tag)) {
    fail(`A tag ${tag} não segue o formato vX.Y.Z.`);
  }
  if (tag !== `v${version}`) {
    fail(`A tag ${tag} não corresponde à versão ${version}.`);
  }
}

console.log(`Metadados da versão ${version} estão consistentes.`);

function readJson(file) {
  return JSON.parse(readFileSync(file, "utf8"));
}

function assertSemanticVersion(value, file) {
  if (typeof value !== "string" || !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(value)) {
    fail(`${file} deve usar uma versão SemVer estável.`);
  }
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
