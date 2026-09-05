import { createFileRoute } from "@tanstack/react-router";
import { validateAttachmentsSearch } from "@/features/attachments/attachments.presentation";
import { AttachmentsPage } from "@/features/attachments/components/attachments-page";

export const Route = createFileRoute("/attachments")({
  component: AttachmentsRoute,
  validateSearch: validateAttachmentsSearch,
});

function AttachmentsRoute() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();

  return (
    <AttachmentsPage
      onSearchChange={(nextSearch) =>
        navigate({
          replace: true,
          search: (previous) => ({ ...previous, ...nextSearch }),
        })
      }
      search={search}
    />
  );
}
