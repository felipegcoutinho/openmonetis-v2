import assert from "node:assert/strict";
import test from "node:test";
import { aiDiagnosisVoices } from "@openmonetis/domain/ai-diagnoses";
import { aiVoiceInstructions } from "./ai-voices";

test("every voice covers the whole text, critical points included", () => {
  for (const voice of aiDiagnosisVoices) {
    const text = aiVoiceInstructions(voice).join("\n");
    assert.match(text, /Keep the voice in the whole text/);
    assert.match(text, /critical ones included/);
  }
});

test("sarcasm targets habits and numbers, never the person, and keeps the facts clear", () => {
  const text = aiVoiceInstructions("sarcastic").join("\n");
  assert.match(text, /dry, good-humored irony/);
  assert.match(text, /never at the person/);
  assert.match(text, /state the fact plainly/);
  assert.match(aiVoiceInstructions("stern").join("\n"), /firm, serious reprimand/);
});
