import assert from "node:assert/strict";
import test from "node:test";
import { aiProviderLoginMethodByProvider, aiProviders } from "@openmonetis/domain/ai-providers";
import { createAntigravityProvider } from "./antigravity";
import { createClaudeProvider } from "./claude";
import { createCodexProvider } from "./codex";

test("each adapter signs in with the method the domain assigns to its provider", () => {
  const adapters = [createClaudeProvider(), createCodexProvider(), createAntigravityProvider()];
  assert.deepEqual(adapters.map((adapter) => adapter.provider).sort(), [...aiProviders].sort());
  for (const adapter of adapters) {
    assert.equal(adapter.loginMethod, aiProviderLoginMethodByProvider[adapter.provider]);
  }
  assert.equal(aiProviderLoginMethodByProvider.codex, "deviceCode");
  assert.equal(aiProviderLoginMethodByProvider.claude, "authorizationCode");
  assert.equal(aiProviderLoginMethodByProvider.antigravity, "authorizationCode");
});
