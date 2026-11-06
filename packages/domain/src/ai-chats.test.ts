import assert from "node:assert/strict";
import test from "node:test";
import {
  aiChatHistoryLimit,
  deriveAiChatTitle,
  isAiChatStreamingExpired,
  selectAiChatHistory,
} from "./ai-chats";

test("chat titles come from the first line of the first question", () => {
  assert.equal(deriveAiChatTitle("  Onde gastei mais?\nDetalhe"), "Onde gastei mais?");
  assert.equal(deriveAiChatTitle("   "), "Nova conversa");
  const long = deriveAiChatTitle(`Quero entender ${"muito ".repeat(30)}bem`);
  assert.ok(long.length <= 80);
  assert.ok(long.endsWith("…"));
});

test("history keeps answered turns only, capped to the most recent ones", () => {
  const messages = [
    { role: "user", status: "completed", content: "a" },
    { role: "assistant", status: "failed", content: "" },
    { role: "assistant", status: "canceled", content: "parcial" },
    { role: "assistant", status: "completed", content: "  " },
  ] as const;
  assert.deepEqual(
    selectAiChatHistory(messages).map((message) => message.content),
    ["a", "parcial"],
  );
  const many = Array.from({ length: 30 }, (_, index) => ({
    role: "user" as const,
    status: "completed" as const,
    content: String(index),
  }));
  const selected = selectAiChatHistory(many);
  assert.equal(selected.length, aiChatHistoryLimit);
  assert.equal(selected.at(-1)?.content, "29");
});

test("a reply streaming for too long is expired", () => {
  const start = new Date("2026-06-15T12:00:00.000Z");
  assert.equal(isAiChatStreamingExpired(start, new Date("2026-06-15T12:04:00.000Z")), false);
  assert.equal(isAiChatStreamingExpired(start, new Date("2026-06-15T12:06:00.000Z")), true);
});
