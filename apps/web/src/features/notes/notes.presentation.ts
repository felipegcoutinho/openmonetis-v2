import { dateOnlyToSafeInstant, formatDateInBrazil } from "@openmonetis/shared/date-time";
import type { NoteOutput } from "@openmonetis/validators/notes";

export const noteKindLabels: Record<NoteOutput["kind"], string> = {
  text: "Nota",
  checklist: "Lista",
  task: "Tarefa",
};

export const noteKindOptions = [
  {
    value: "text" as const,
    label: "Nota",
    description: "Registre ideias, referências e decisões.",
  },
  {
    value: "checklist" as const,
    label: "Lista",
    description: "Acompanhe itens e marque o que concluir.",
  },
  {
    value: "task" as const,
    label: "Tarefa",
    description: "Defina uma data e receba alertas.",
  },
];

export const noteCompletionCheckboxClassName =
  "data-checked:border-success data-checked:bg-success data-checked:text-white dark:data-checked:bg-success dark:data-checked:text-primary-foreground";

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

export function formatTaskDueDate(value: string) {
  return formatDateInBrazil(dateOnlyToSafeInstant(value), {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
