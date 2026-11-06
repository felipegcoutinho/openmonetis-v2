import type { AiChatFailureCode } from "@openmonetis/domain/ai-chats";
import { formatDateInBrazil } from "@openmonetis/shared/date-time";
import { CalendarClock, ChartPie, type LucideIcon, PiggyBank, Scissors } from "lucide-react";
import { AiChatsApiError } from "./ai-chats.api";

export const aiChatSuggestions: { text: string; icon: LucideIcon }[] = [
  { text: "Onde estou gastando mais este mês?", icon: ChartPie },
  { text: "Como está minha reserva de emergência?", icon: PiggyBank },
  { text: "Quais contas vencem nos próximos dias?", icon: CalendarClock },
  { text: "O que posso cortar para economizar R$ 500?", icon: Scissors },
];

const failureMessages: Record<AiChatFailureCode, string> = {
  providerDisconnected: "A conexão com a IA expirou. Conecte novamente em Ajustes.",
  providerLimitReached: "O limite da sua assinatura foi atingido. Tente mais tarde.",
  providerBusy: "Outra análise está em andamento na sua conta. Aguarde e tente novamente.",
  serviceUnavailable: "O serviço de IA não respondeu. Tente novamente.",
  runFailed: "Não foi possível responder. Tente novamente.",
  timedOut: "A IA demorou demais para responder. Tente novamente.",
  interrupted: "A resposta foi interrompida. Tente novamente.",
};

export function aiChatFailureMessage(code: AiChatFailureCode | null) {
  return failureMessages[code ?? "runFailed"];
}

export function aiChatErrorMessage(error: unknown) {
  if (error instanceof AiChatsApiError) {
    switch (error.code) {
      case "ai_provider_not_connected":
        return "Conecte a IA em Ajustes antes de conversar.";
      case "ai_model_unavailable":
        return "Este modelo não está disponível na sua assinatura.";
      case "ai_chat_busy":
        return "Aguarde a resposta atual terminar.";
      case "ai_chat_daily_limit":
        return "Você atingiu o limite diário de mensagens.";
      case "ai_chat_not_found":
        return "Esta conversa não existe mais.";
      case "ai_chat_nothing_to_regenerate":
        return "Não há pergunta para responder de novo.";
      case "ai_service_unavailable":
      case "ai_disabled":
        return "O serviço de IA está indisponível no momento.";
    }
    if (error.status === 429) return "Muitas mensagens seguidas. Aguarde um minuto.";
  }
  return "Não foi possível enviar a mensagem. Tente novamente.";
}

export function formatChatUpdatedAt(value: string, today = new Date()) {
  const date = new Date(value);
  const sameDay = date.toDateString() === today.toDateString();
  return formatDateInBrazil(
    date,
    sameDay ? { hour: "2-digit", minute: "2-digit" } : { day: "2-digit", month: "short" },
  );
}
