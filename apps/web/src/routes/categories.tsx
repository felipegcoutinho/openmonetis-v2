import { createFileRoute } from "@tanstack/react-router";
import { CategoriesPage } from "@/features/categories/components/categories-page";

export const Route = createFileRoute("/categories")({
  head: () => ({ meta: [{ title: "Categorias · OpenMonetis" }] }),
  component: CategoriesPage,
});
