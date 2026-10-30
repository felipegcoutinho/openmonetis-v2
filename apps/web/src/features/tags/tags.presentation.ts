import type { TagOutput } from "@openmonetis/validators/tags";
import { ApiClientError } from "@/lib/api-client";
export function getTagErrorMessage(error: unknown) {
  return error instanceof ApiClientError && error.code === "tag_name_conflict"
    ? "Já existe uma etiqueta com esse nome."
    : "Não foi possível salvar a etiqueta. Tente novamente.";
}

type TagColor = TagOutput["color"];

/** Theme tokens for each tag color, so tags follow light and dark mode. */
export const tagColorTokens: Record<TagColor, string> = {
  neutral: "var(--muted-foreground)",
  orange: "var(--chart-1)",
  blue: "var(--chart-2)",
  green: "var(--success)",
  purple: "var(--chart-4)",
  yellow: "var(--chart-5)",
  red: "var(--destructive)",
};

export const tagColorOptions: { value: TagColor; label: string }[] = [
  { value: "neutral", label: "Neutra" },
  { value: "orange", label: "Laranja" },
  { value: "blue", label: "Azul" },
  { value: "green", label: "Verde" },
  { value: "purple", label: "Roxa" },
  { value: "yellow", label: "Amarela" },
  { value: "red", label: "Vermelha" },
];
