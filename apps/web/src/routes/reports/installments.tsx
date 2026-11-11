import { createFileRoute } from "@tanstack/react-router";
import { InstallmentsPage } from "@/features/installments/components/installments-page";
import {
  compactInstallmentsSearch,
  resolveInstallmentsSearch,
  validateInstallmentsSearch,
} from "@/features/installments/installments.presentation";

export const Route = createFileRoute("/reports/installments")({
  head: () => ({ meta: [{ title: "Despesas parceladas · OpenMonetis" }] }),
  component: InstallmentsRoute,
  validateSearch: validateInstallmentsSearch,
});

function InstallmentsRoute() {
  const search = resolveInstallmentsSearch(Route.useSearch());
  const navigate = Route.useNavigate();

  return (
    <InstallmentsPage
      search={search}
      onSearchChange={(patch) => {
        void navigate({
          search: compactInstallmentsSearch({ ...search, ...patch }),
          replace: true,
        });
      }}
    />
  );
}
