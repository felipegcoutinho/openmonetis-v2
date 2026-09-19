import { createFileRoute } from "@tanstack/react-router";
import { InstallmentsPage } from "@/features/installments/components/installments-page";
import {
  resolveInstallmentsSearch,
  validateInstallmentsSearch,
} from "@/features/installments/installments.presentation";

export const Route = createFileRoute("/reports/installments")({
  head: () => ({ meta: [{ title: "Parcelamentos · OpenMonetis" }] }),
  component: InstallmentsRoute,
  validateSearch: validateInstallmentsSearch,
});

function InstallmentsRoute() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const filters = resolveInstallmentsSearch(search);

  return (
    <InstallmentsPage
      filters={filters}
      onStatusChange={(status) => {
        void navigate({
          search: { ...search, status: status === "all" ? undefined : status },
          replace: true,
        });
      }}
    />
  );
}
