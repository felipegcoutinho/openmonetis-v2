import type {
  AiDiagnosisChartKind,
  AiDiagnosisFailureCode,
  AiDiagnosisSectionTone,
  AiDiagnosisStatus,
  AiDiagnosisVoice,
  FinancialHealthLevel,
} from "@openmonetis/domain/ai-diagnoses";
import type { AiProvider } from "@openmonetis/domain/ai-providers";
import { formatDateInBrazil, isCalendarPeriod } from "@openmonetis/shared/date-time";
import { z } from "zod";
import { aiProviderLabels } from "@/features/ai-providers/ai-providers.presentation";
import { AiDiagnosesApiError } from "./ai-diagnoses.api";

export const aiDiagnosesTabs = ["diagnosis", "chat"] as const;
export type AiDiagnosesTab = (typeof aiDiagnosesTabs)[number];

export type AiDiagnosesSearch = {
  period?: string;
  diagnosis?: string;
  tab?: AiDiagnosesTab;
  chat?: string;
};

export function validateAiDiagnosesSearch(search: Record<string, unknown>): AiDiagnosesSearch {
  const diagnosis = z.uuid().safeParse(search.diagnosis);
  const chat = z.uuid().safeParse(search.chat);
  const tab = z.enum(aiDiagnosesTabs).safeParse(search.tab);
  return {
    tab: tab.success && tab.data !== "diagnosis" ? tab.data : undefined,
    chat: chat.success ? chat.data : undefined,
    period:
      typeof search.period === "string" && isCalendarPeriod(search.period)
        ? search.period
        : undefined,
    diagnosis: diagnosis.success ? diagnosis.data : undefined,
  };
}

export const financialHealthLevelLabels: Record<FinancialHealthLevel, string> = {
  excellent: "Excelente",
  good: "Boa",
  fair: "Requer atenção",
  poor: "Crítica",
};

export const financialHealthLevelClassNames: Record<FinancialHealthLevel, string> = {
  excellent: "text-success",
  good: "text-success",
  fair: "text-warning",
  poor: "text-destructive",
};

export const aiDiagnosisToneClassNames: Record<AiDiagnosisSectionTone, string> = {
  positive: "text-success",
  neutral: "text-muted-foreground",
  attention: "text-warning",
  critical: "text-destructive",
};

export const aiDiagnosisToneLabels: Record<AiDiagnosisSectionTone, string> = {
  positive: "Ponto forte",
  neutral: "Observação",
  attention: "Atenção",
  critical: "Crítico",
};

export const aiDiagnosisVoiceLabels: Record<AiDiagnosisVoice, string> = {
  balanced: "Equilibrado",
  direct: "Direto",
  encouraging: "Motivador",
  sarcastic: "Sarcástico",
  stern: "Bronca",
};

export const aiDiagnosisVoiceDescriptions: Record<AiDiagnosisVoice, string> = {
  balanced: "Acolhedor e honesto",
  direct: "Frio e objetivo, sem rodeios",
  encouraging: "Destaca avanços e metas",
  sarcastic: "Ironia seca do começo ao fim",
  stern: "Firme e exigente, sem exagero",
};

export const aiDiagnosisChartTitles: Record<AiDiagnosisChartKind, string> = {
  incomeExpenseHistory: "Receitas e despesas",
  savingsRateHistory: "Taxa de poupança",
  topExpenseCategories: "Maiores categorias de despesa",
  monthlyBalanceHistory: "Saldo do mês",
};

export const aiDiagnosisChartDescriptions: Record<AiDiagnosisChartKind, string> = {
  incomeExpenseHistory: "Entradas e saídas por mês",
  savingsRateHistory: "Parte da receita que sobrou",
  topExpenseCategories: "Mês atual × anterior",
  monthlyBalanceHistory: "Receitas menos despesas",
};

const failureMessages: Record<AiDiagnosisFailureCode, string> = {
  providerDisconnected: "A conexão com a IA expirou. Conecte novamente em Ajustes.",
  providerLimitReached: "O limite da sua assinatura foi atingido. Tente mais tarde.",
  providerBusy: "Outro diagnóstico ainda estava em andamento. Tente novamente.",
  invalidOutput: "A IA respondeu em um formato inesperado. Tente novamente.",
  serviceUnavailable: "O serviço de IA não respondeu. Tente novamente em instantes.",
  runFailed: "Não foi possível gerar o diagnóstico. Tente novamente.",
  timedOut: "A IA demorou demais para responder. Tente novamente.",
  interrupted: "O diagnóstico foi interrompido. Tente novamente.",
  canceled: "Você parou esta análise. Gere novamente quando quiser.",
};

/**
 * How long a diagnosis usually takes with each provider. Antigravity's "High" models reason for
 * minutes, so its window is wider; past `slowAfterSeconds` the page says it is taking longer.
 */
export const aiDiagnosisExpectedDurations: Record<
  AiProvider,
  { label: string; slowAfterSeconds: number }
> = {
  claude: { label: "de 15 segundos a 2 minutos", slowAfterSeconds: 120 },
  codex: { label: "de 15 segundos a 2 minutos", slowAfterSeconds: 120 },
  antigravity: { label: "de 1 a 4 minutos", slowAfterSeconds: 240 },
};

export function formatElapsedTime(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}

export function aiDiagnosisStatusLabel(
  status: AiDiagnosisStatus,
  failureCode: AiDiagnosisFailureCode | null,
) {
  if (status === "pending") return "Gerando";
  if (status === "completed") return null;
  return failureCode === "canceled" ? "Parado" : "Falhou";
}

export function aiDiagnosisChangeErrorMessage(error: unknown) {
  if (error instanceof AiDiagnosesApiError) {
    if (error.code === "ai_diagnosis_not_running") return "A análise já tinha terminado.";
    if (error.code === "ai_diagnosis_not_found") return "Este diagnóstico não existe mais.";
    if (error.status === 429) return "Muitas tentativas. Aguarde um minuto.";
  }
  return "Não foi possível concluir a ação. Tente novamente.";
}

export function aiDiagnosisFailureMessage(code: AiDiagnosisFailureCode | null) {
  return code ? failureMessages[code] : failureMessages.runFailed;
}

export function aiDiagnosisCreateErrorMessage(error: unknown) {
  if (error instanceof AiDiagnosesApiError) {
    switch (error.code) {
      case "ai_provider_not_connected":
        return "Conecte a IA em Ajustes antes de gerar um diagnóstico.";
      case "ai_model_unavailable":
        return "Este modelo não está disponível na sua assinatura.";
      case "ai_diagnosis_in_progress":
        return "Já existe um diagnóstico em andamento.";
      case "ai_diagnosis_daily_limit":
        return "Você atingiu o limite diário de diagnósticos.";
      case "ai_diagnosis_without_data":
        return "Ainda não há lançamentos suficientes para um diagnóstico.";
      case "ai_service_unavailable":
      case "ai_disabled":
        return "O serviço de IA está indisponível no momento.";
    }
    if (error.status === 429) return "Muitas tentativas. Aguarde um minuto.";
  }
  return "Não foi possível iniciar o diagnóstico. Tente novamente.";
}

export function formatDiagnosisDate(value: string) {
  return formatDateInBrazil(new Date(value), {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatPercentIndicator(value: number | null, signed = false) {
  if (value === null) return "—";
  const formatted = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(value);
  return `${signed && value > 0 ? "+" : ""}${formatted}%`;
}

export function formatMonthsIndicator(value: number | null) {
  if (value === null) return "—";
  const formatted = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(value);
  return `${formatted} ${value === 1 ? "mês" : "meses"}`;
}

/** "Claude · Sonnet 5.5", or just the provider when the CLI did not report the model. */
export function formatDiagnosisModel(
  provider: AiProvider,
  model: { name: string } | null,
  requestedModel?: string | null,
) {
  const modelName = model?.name ?? requestedModel;
  return modelName ? `${aiProviderLabels[provider]} · ${modelName}` : aiProviderLabels[provider];
}
