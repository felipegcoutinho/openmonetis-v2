import { createFileRoute } from "@tanstack/react-router";
import { GoalsPage } from "@/features/goals/components/goals-page";

export const Route = createFileRoute("/goals")({
  head: () => ({ meta: [{ title: "Metas · OpenMonetis" }] }),
  component: GoalsPage,
});
