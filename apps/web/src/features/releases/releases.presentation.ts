import type { ReleaseOutput } from "@openmonetis/validators/releases";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

export const releaseSectionLabels: Record<ReleaseOutput["sections"][number]["type"], string> = {
  added: "Novidades",
  changed: "Melhorias",
  deprecated: "Descontinuado",
  removed: "Removido",
  fixed: "Correções",
  security: "Segurança",
};

export function formatReleaseDate(date: string) {
  const parsed = parseISO(date);
  return Number.isNaN(parsed.getTime())
    ? date
    : format(parsed, "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
}

export function releaseErrorMessage() {
  return "Não foi possível carregar as versões. Tente novamente.";
}

export function releaseStateErrorMessage() {
  return "Não foi possível dispensar o aviso. Tente novamente.";
}
