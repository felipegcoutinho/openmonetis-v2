import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";

const journalPath = "packages/db/drizzle/meta/_journal.json";
const migrationsDirectory = "packages/db/drizzle";
const baseline = {
  tag: "0000_initial_schema",
  when: 1786211980467,
  sha256: "a9d16e9566f46a0bc505232eda5d0514b0ba30eb180c228e7c35a734e046e83e",
};
const lastLegacyMigrationTimestamp = 1788557150383;
const journal = JSON.parse(readFileSync(journalPath, "utf8"));

if (journal.version !== "7" || journal.dialect !== "postgresql") {
  fail(`${journalPath} deve continuar usando o journal PostgreSQL versão 7.`);
}

if (!Array.isArray(journal.entries) || journal.entries.length === 0) {
  fail(`${journalPath} não possui migrations.`);
}

for (const [index, entry] of journal.entries.entries()) {
  if (entry.idx !== index) {
    fail(`A migration ${entry.tag ?? index} usa idx ${entry.idx}; esperado ${index}.`);
  }

  if (index > 0 && entry.when <= journal.entries[index - 1].when) {
    fail(`A migration ${entry.tag} não possui timestamp crescente.`);
  }

  const migrationPath = `${migrationsDirectory}/${entry.tag}.sql`;
  if (!existsSync(migrationPath)) {
    fail(`A migration registrada ${migrationPath} não existe.`);
  }
}

const [baselineEntry, compatibilityEntry] = journal.entries;

if (baselineEntry.tag !== baseline.tag || baselineEntry.when !== baseline.when) {
  fail(
    `A baseline ${baseline.tag} é imutável e deve manter o timestamp ${baseline.when} para upgrades legados.`,
  );
}

const baselineContents = readFileSync(`${migrationsDirectory}/${baseline.tag}.sql`);
const baselineHash = createHash("sha256").update(baselineContents).digest("hex");
if (baselineHash !== baseline.sha256) {
  fail(`A migration publicada ${baseline.tag} foi alterada; crie uma nova migration incremental.`);
}

if (!compatibilityEntry || compatibilityEntry.when <= lastLegacyMigrationTimestamp) {
  fail(
    `A migration de compatibilidade deve ser posterior ao histórico legado (${lastLegacyMigrationTimestamp}).`,
  );
}

console.log(
  `${journal.entries.length} migrations validadas; baseline publicada permanece imutável.`,
);

function fail(message) {
  console.error(message);
  process.exit(1);
}
