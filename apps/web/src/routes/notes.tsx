import { createFileRoute } from "@tanstack/react-router";
import { NotesPage } from "@/features/notes/components/notes-page";

export const Route = createFileRoute("/notes")({
  head: () => ({ meta: [{ title: "Anotações · OpenMonetis" }] }),
  component: NotesPage,
});
