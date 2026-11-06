import { serve } from "@hono/node-server";
import { type AiProvider, aiProviders } from "@openmonetis/domain/ai-providers";
import { createAiServiceApp } from "./app";
import { createAntigravityProvider } from "./providers/antigravity";
import { createClaudeProvider } from "./providers/claude";
import { createCodexProvider } from "./providers/codex";
import type { CommandSource, ProviderAdapter } from "./providers/provider";
import { createToolManager } from "./tools/manager";
import { createToolSources, currentToolPlatform } from "./tools/sources";
import { requireEnv } from "./utils/env";

const unsafeSecrets = ["development-ai-service-secret-change-me"];
const production = process.env.NODE_ENV === "production";
const secret = requireEnv(
  "AI_SERVICE_SECRET",
  production ? undefined : "development-ai-service-secret-change-me",
);
if (production && unsafeSecrets.includes(secret)) {
  throw new Error("AI_SERVICE_SECRET uses an unsafe production value");
}

const bundled = {
  claude: process.env.CLAUDE_BIN || "claude",
  codex: process.env.CODEX_BIN || "codex",
  antigravity: process.env.ANTIGRAVITY_BIN || "agy",
} as const;
const adapterFactories = {
  claude: createClaudeProvider,
  codex: createCodexProvider,
  antigravity: createAntigravityProvider,
} satisfies Record<AiProvider, (command: CommandSource) => ProviderAdapter>;
const platform = currentToolPlatform();
const tools = platform
  ? createToolManager({
      directory: requireEnv("AI_TOOLS_DIR", production ? "/data/tools" : ".ai-tools"),
      bundled,
      sources: createToolSources({ platform }),
      createAdapter: (provider, command) => adapterFactories[provider](command),
    })
  : undefined;
await tools?.load();
tools?.startBackgroundChecks();

const app = createAiServiceApp({
  secret,
  homesDirectory: requireEnv("AI_HOMES_DIR", production ? "/data/homes" : ".ai-homes"),
  // Each call reads the active build, so an update applies from the next run on.
  providers: aiProviders.map((provider) =>
    adapterFactories[provider](() => tools?.command(provider) ?? bundled[provider]),
  ),
  tools,
});
const port = Number(process.env.AI_PORT ?? 7003);

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`OpenMonetis AI service listening on http://localhost:${info.port}`);
});
