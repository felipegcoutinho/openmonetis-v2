import { createFileRoute } from "@tanstack/react-router";
import { CardsPage } from "@/features/cards/components/cards-page";

export const Route = createFileRoute("/cards")({
  head: () => ({ meta: [{ title: "Cartões · OpenMonetis" }] }),
  component: CardsPage,
});
