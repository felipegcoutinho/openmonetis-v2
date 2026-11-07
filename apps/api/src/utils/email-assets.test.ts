import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createEmailAssetReader, isEmailImagePath } from "./email-assets";

test("only bundled logos and the app icon can be embedded", () => {
  assert.equal(isEmailImagePath("/logos/nubank.png"), true);
  assert.equal(isEmailImagePath("/icon-192.png"), true);
  assert.equal(isEmailImagePath("/logos/../../etc/passwd.png"), false);
  assert.equal(isEmailImagePath("/logos/.hidden.png"), false);
  assert.equal(isEmailImagePath("/logos/nubank.svg"), false);
  assert.equal(isEmailImagePath("https://example.com/logo.png"), false);
});

test("reads bundled images as base64 and ignores missing ones", async () => {
  const root = await mkdtemp(join(tmpdir(), "email-assets-"));
  await mkdir(join(root, "logos"));
  await writeFile(join(root, "logos", "nubank.png"), Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  const reader = createEmailAssetReader(root);

  assert.deepEqual(await reader.readImage("/logos/nubank.png"), {
    contentBase64: "iVBORw==",
    contentType: "image/png",
  });
  assert.equal(await reader.readImage("/logos/missing.png"), null);
  assert.equal(await reader.readImage("https://example.com/logo.png"), null);
});
