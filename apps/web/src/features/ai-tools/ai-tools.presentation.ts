import type {
  AiToolEventAction,
  AiToolEventStatus,
  AiToolFailureCode,
  AiToolInstallStep,
} from "@openmonetis/domain/ai-tools";
import { formatDateInBrazil } from "@openmonetis/shared/date-time";
import type { AiToolOutput } from "@openmonetis/validators/ai-tools";
import { AiToolsApiError } from "./ai-tools.api";

export const aiToolInstallStepLabels: Record<AiToolInstallStep, string> = {
  download: "Baixando",
  verify: "Verificando assinatura",
  test: "Testando",
  activate: "Ativando",
};

export const aiToolFailureMessages: Record<AiToolFailureCode, string> = {
  tooRecent: "A versão ainda não completou 3 dias de publicação.",
  notNewer: "Esta versão não é mais nova que a atual.",
  unknownVersion: "A versão não está mais disponível na origem oficial.",
  downloadFailed: "Não foi possível baixar a versão. Tente mais tarde.",
  integrityMismatch: "O arquivo baixado não confere com o publicado e foi descartado.",
  signatureInvalid: "A assinatura da versão não pôde ser confirmada e ela foi descartada.",
  smokeTestFailed: "A versão não passou no teste e não foi ativada.",
  canaryFailed: "O teste com a sua conta falhou; a versão não foi ativada.",
  busy: "Outra atualização está em andamento.",
  installFailed: "Não foi possível instalar a versão.",
};

export const aiToolEventLabels: Record<AiToolEventAction, string> = {
  install: "Atualização",
  activate: "Troca de versão",
  restoreBundled: "Volta para a versão original",
};

export const aiToolEventStatusLabels: Record<AiToolEventStatus, string> = {
  pending: "Em andamento",
  failed: "Falhou",
  completed: "Concluída",
};

/** The version in use, whether installed here or shipped with the image. */
export function formatAiToolActiveVersion(tool: AiToolOutput) {
  return tool.activeVersion ?? tool.bundledVersion ?? "Versão original";
}

/** Short status of the newest official release, shown beside the version in use. */
export function formatAiToolReleaseStatus(tool: AiToolOutput) {
  const latest = tool.latest;
  if (!latest) return "não foi possível consultar a mais recente";
  if (latest.blocker === "notNewer") return "atualizado";
  if (latest.blocker === "tooRecent") {
    return `${latest.version} disponível a partir de ${formatAiToolDate(latest.eligibleAt)}`;
  }
  if (latest.blocker) return `${latest.version}: ${aiToolFailureMessages[latest.blocker]}`;
  return `${latest.version} disponível`;
}

/** Where "Voltar" goes: the previous installed version, else the image's. */
export function aiToolRollbackTarget(tool: AiToolOutput) {
  if (!tool.activeVersion) return null;
  return tool.previousVersion
    ? { version: tool.previousVersion, label: tool.previousVersion }
    : { version: null, label: tool.bundledVersion ?? "versão original" };
}

export function formatAiToolDate(value: string) {
  return formatDateInBrazil(new Date(value), { day: "2-digit", month: "short" });
}

export function formatAiToolEventDate(value: string) {
  return formatDateInBrazil(new Date(value), {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function aiToolErrorMessage(error: unknown) {
  if (error instanceof AiToolsApiError) {
    if (error.code === "ai_tools_forbidden")
      return "Só quem administra a instalação pode fazer isso.";
    if (error.code === "ai_tool_busy") return aiToolFailureMessages.busy;
    if (error.code === "ai_tool_unknown_version") return "Esta versão não está instalada.";
    if (error.code === "ai_service_unavailable" || error.code === "ai_disabled") {
      return "O serviço de IA não respondeu. Tente novamente em instantes.";
    }
    if (error.status === 429) return "Muitas tentativas. Aguarde um minuto.";
  }
  return "Não foi possível concluir a ação. Tente novamente.";
}
