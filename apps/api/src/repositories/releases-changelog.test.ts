import assert from "node:assert/strict";
import test from "node:test";
import { parseChangelog } from "./releases-changelog";

test("parseChangelog joins indented continuation lines in release items", () => {
  const releases = parseChangelog(`# Changelog

## [1.2.3] - 2026-09-07

Resumo da versão em
mais de uma linha.

### Corrigido

- O texto do item continua na
  linha seguinte sem ser cortado.
`);

  assert.deepEqual(releases, [
    {
      version: "1.2.3",
      date: "2026-09-07",
      summary: "Resumo da versão em mais de uma linha.",
      sections: [
        {
          type: "fixed",
          items: ["O texto do item continua na linha seguinte sem ser cortado."],
        },
      ],
    },
  ]);
});
