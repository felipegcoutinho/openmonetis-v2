import { createFileRoute } from "@tanstack/react-router";
import { InstallmentsPage } from "@/features/installments/components/installments-page";
import {
  resolveInstallmentsSearch,
  validateInstallmentsSearch,
} from "@/features/installments/installments.presentation";

export const Route = createFileRoute("/reports/installments")({
  component: InstallmentsRoute,
  validateSearch: validateInstallmentsSearch,
});

function InstallmentsRoute() {
  const search = Route.useSearch();
  const filters = resolveInstallmentsSearch(search);

  return <InstallmentsPage filters={filters} />;
}
