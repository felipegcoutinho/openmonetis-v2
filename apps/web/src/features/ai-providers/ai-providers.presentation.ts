import type { AiProvider, AiProviderStatus } from "@openmonetis/domain/ai-providers";
import { formatDateInBrazil } from "@openmonetis/shared/date-time";
import type { AiProviderModel } from "@openmonetis/validators/ai-providers";
import { AiProvidersApiError } from "./ai-providers.api";

export const aiProviderLabels: Record<AiProvider, string> = {
  claude: "Claude",
  codex: "Codex",
  antigravity: "Antigravity",
};

export const aiProviderPlanDescriptions: Record<AiProvider, string> = {
  claude: "Use sua assinatura Claude Pro ou Max.",
  codex: "Use sua assinatura ChatGPT Plus, Pro ou Business.",
  antigravity: "Use sua conta Google com Antigravity.",
};

export const aiProviderStatusLabels: Record<AiProviderStatus, string> = {
  connected: "Conectado",
  disconnected: "Desconectado",
  unavailable: "Indisponível",
};

export function aiProviderErrorMessage(error: unknown) {
  if (error instanceof AiProvidersApiError) {
    if (error.code === "ai_disabled") return "A IA não está habilitada nesta instalação.";
    if (error.code === "ai_service_unavailable") {
      return "O serviço de IA não respondeu. Tente novamente em instantes.";
    }
    if (error.code === "ai_model_unavailable") {
      return "Este modelo não está disponível na sua assinatura.";
    }
    if (error.code === "ai_provider_not_connected") return "Conecte o assistente primeiro.";
    if (error.code === "ai_login_not_found") return "O login expirou. Comece novamente.";
    if (error.status === 429) return "Muitas tentativas. Aguarde um minuto.";
  }
  return "Não foi possível concluir a ação. Tente novamente.";
}

/** Sentinel for the "plan default" option, since a select value cannot be null. */
export const aiProviderDefaultModelValue = "default";

export function formatAiModelLabel(models: readonly AiProviderModel[], modelId: string | null) {
  if (!modelId) return "Padrão do plano";
  return models.find((model) => model.id === modelId)?.name ?? modelId;
}

/** Brand marks bundled with the web app; Codex uses the OpenAI mark, with a variant per theme. */
export const aiProviderLogos: Record<AiProvider, { light: string; dark: string }> = {
  claude: { light: "/images/ai-providers/claude.svg", dark: "/images/ai-providers/claude.svg" },
  codex: {
    light: "/images/ai-providers/openai-light.svg",
    dark: "/images/ai-providers/openai-dark.svg",
  },
  antigravity: {
    light: "/images/ai-providers/antigravity.png",
    dark: "/images/ai-providers/antigravity.png",
  },
};

export function formatAiProviderConnectedAt(value: string) {
  return formatDateInBrazil(new Date(value), {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).replaceAll(".", "");
}

/** `75` → `1:15`, for the time left to finish a sign-in. */
export function formatAiLoginTimeLeft(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds));
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, "0")}`;
}
