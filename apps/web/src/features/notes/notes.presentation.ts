import { formatDateInBrazil } from "@openmonetis/shared/date-time";
import type { NoteOutput } from "@openmonetis/validators/notes";

export const noteKindLabels: Record<NoteOutput["kind"], string> = {
  text: "Nota",
  checklist: "Lista",
};

export const noteKindOptions = [
  {
    value: "text" as const,
    label: "Nota",
    description: ["Texto livre para ideias", "e decisões"],
  },
  {
    value: "checklist" as const,
    label: "Lista",
    description: ["Itens que podem ser marcados", "como concluídos"],
  },
];

export function formatNoteUpdatedAt(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ""
    : formatDateInBrazil(date, { dateStyle: "medium", timeStyle: "short" });
}

export function getChecklistProgressLabel(note: NoteOutput) {
  if (note.totalItemCount === 0) return "Lista vazia";
  if (note.completedItemCount === note.totalItemCount) return "Tudo concluído";
  return `${note.completedItemCount} de ${note.totalItemCount} ${note.totalItemCount === 1 ? "concluído" : "concluídos"}`;
}
