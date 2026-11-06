import {
  type AiDataRetentionDays,
  type AiDataScope,
  aiDataScopesRequiringTransactions,
  aiDiagnosisTransactionsLimit,
} from "@openmonetis/domain/ai-data-sharing";
import { AiDataSharingApiError } from "./ai-data-sharing.api";

/** Descriptions stay short enough to fit one line in the two-column grid. */
export const aiDataScopeOptions: Record<AiDataScope, { label: string; description: string }> = {
  categoryNames: {
    label: "Nomes das categorias",
    description: "Sem isso, viram “Categoria 1”, “Categoria 2”…",
  },
  transactions: {
    label: "Lançamentos do mês",
    description: `Até ${aiDiagnosisTransactionsLimit} lançamentos, com descrição, valor e data.`,
  },
  people: {
    label: "Pessoas",
    description: "Quem fez e com quem dividiu cada lançamento.",
  },
  notes: {
    label: "Anotações dos lançamentos",
    description: "O texto livre escrito em cada lançamento.",
  },
  accounts: {
    label: "Contas e cartões",
    description: "Nomes, saldos, limites e faturas.",
  },
  budgetsAndGoals: {
    label: "Orçamentos e metas",
    description: "Valores orçados, gastos e progresso das metas.",
  },
};

export function isAiDataScopeLocked(scope: AiDataScope, scopes: readonly AiDataScope[]) {
  return aiDataScopesRequiringTransactions.includes(scope) && !scopes.includes("transactions");
}

/** Short list for the report footer. */
export function formatSharedScopes(scopes: readonly AiDataScope[]) {
  if (!scopes.length) return "somente totais e indicadores";
  return ["totais e indicadores", ...scopes.map((scope) => aiDataScopeOptions[scope].label)]
    .join(", ")
    .toLocaleLowerCase("pt-BR");
}

/** Select values are strings; `forever` stands for keeping the history until it is deleted. */
export const aiDataRetentionOptions: Array<{
  value: string;
  days: AiDataRetentionDays;
  label: string;
}> = [
  { value: "30", days: 30, label: "30 dias" },
  { value: "90", days: 90, label: "90 dias" },
  { value: "365", days: 365, label: "1 ano" },
  { value: "forever", days: null, label: "Até eu apagar" },
];

export function aiDataRetentionValue(days: AiDataRetentionDays) {
  return aiDataRetentionOptions.find((option) => option.days === days)?.value ?? "forever";
}

export function formatAiDataHistoryDeleted(deleted: { chats: number; diagnoses: number }) {
  const total = deleted.chats + deleted.diagnoses;
  if (!total) return "Não havia histórico de IA para apagar";
  const parts = [
    deleted.chats ? `${deleted.chats} conversa${deleted.chats === 1 ? "" : "s"}` : null,
    deleted.diagnoses
      ? `${deleted.diagnoses} diagnóstico${deleted.diagnoses === 1 ? "" : "s"}`
      : null,
  ].filter(Boolean);
  return `${parts.join(" e ")} apagado${total === 1 ? "" : "s"}`;
}

/** The preview as people read it: indented JSON and its approximate size. */
export function formatAiDataPreview(data: unknown) {
  const text = JSON.stringify(data, null, 2);
  const bytes = new TextEncoder().encode(JSON.stringify(data)).length;
  const size = bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1).replace(".", ",")} KB`;
  return { text, size };
}

export function aiDataSharingErrorMessage(error: unknown) {
  if (error instanceof AiDataSharingApiError && error.status === 429) {
    return "Muitas tentativas. Aguarde um minuto.";
  }
  return "Não foi possível salvar as permissões. Tente novamente.";
}
