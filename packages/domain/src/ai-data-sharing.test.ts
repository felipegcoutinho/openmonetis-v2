import assert from "node:assert/strict";
import test from "node:test";
import {
  aiDataScopes,
  createCategoryAliases,
  isFullAiDataSharing,
  normalizeAiDataScopes,
} from "./ai-data-sharing";

test("scopes are ordered, de-duplicated and drop transaction details without transactions", () => {
  assert.deepEqual(normalizeAiDataScopes(["notes", "people", "accounts", "accounts"]), [
    "accounts",
  ]);
  assert.deepEqual(normalizeAiDataScopes(["notes", "transactions"]), ["transactions", "notes"]);
  assert.equal(isFullAiDataSharing([...aiDataScopes].reverse()), true);
  assert.equal(isFullAiDataSharing(["transactions", "people", "notes"]), false);
});

test("hidden category names become stable placeholders that are restored in the answer", () => {
  const aliases = createCategoryAliases(false);
  assert.equal(aliases.name("c-1", "Saúde"), "Categoria 1");
  assert.equal(aliases.name("c-2", "Mercado"), "Categoria 2");
  assert.equal(aliases.name("c-1", "Saúde"), "Categoria 1");
  assert.equal(aliases.name(null, null), null);
  assert.equal(
    aliases.restore("A Categoria 2 cresceu; Categoria 1 e Categoria 9 seguem estáveis."),
    "A Mercado cresceu; Saúde e Categoria 9 seguem estáveis.",
  );

  const revealed = createCategoryAliases(true);
  assert.equal(revealed.name("c-1", "Saúde"), "Saúde");
  assert.equal(revealed.restore("Categoria 1"), "Categoria 1");
});

test("streamed chunks are restored even when a placeholder is split between them", () => {
  const aliases = createCategoryAliases(false);
  for (let index = 1; index <= 12; index += 1) {
    aliases.name(`c-${index}`, index === 1 ? "Saúde" : index === 12 ? "Lazer" : `Outra ${index}`);
  }
  const stream = aliases.createStream();
  const chunks = ["Sua Cat", "egoria 1 ", "subiu; a Categoria", " 1", "2 caiu. Casa"];
  const output = chunks.map((chunk) => stream.push(chunk)).join("") + stream.flush();
  assert.equal(output, "Sua Saúde subiu; a Lazer caiu. Casa");

  const revealed = createCategoryAliases(true).createStream();
  assert.equal(revealed.push("Categoria"), "Categoria");
});
