import { getCurrentPeriodInBrazil } from "@openmonetis/shared/date-time";
import { createFileRoute } from "@tanstack/react-router";
import { validateAiDiagnosesSearch } from "@/features/ai-diagnoses/ai-diagnoses.presentation";
import { prefetchAiDiagnosesPage } from "@/features/ai-diagnoses/ai-diagnoses.queries";
import { AiDiagnosesPage } from "@/features/ai-diagnoses/components/ai-diagnoses-page";

export const Route = createFileRoute("/reports/ai-diagnoses")({
  head: () => ({ meta: [{ title: "Diagnóstico com IA · OpenMonetis" }] }),
  validateSearch: validateAiDiagnosesSearch,
  loaderDeps: ({ search }) => ({ period: search.period, diagnosisId: search.diagnosis }),
  loader: ({ context, deps }) => {
    // The API is reached through the browser's session, so the server render never prefetches.
    if (typeof document === "undefined") return;
    // Not awaited: the page opens at once and its queries pick up the reads already in flight.
    void prefetchAiDiagnosesPage(context.queryClient, {
      period: deps.period ?? getCurrentPeriodInBrazil(),
      diagnosisId: deps.diagnosisId,
    });
  },
  component: AiDiagnosesRoute,
});

function AiDiagnosesRoute() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();

  return (
    <AiDiagnosesPage
      chatId={search.chat}
      diagnosisId={search.diagnosis}
      onChatChange={(chat) =>
        void navigate({ replace: true, search: (previous) => ({ ...previous, chat }) })
      }
      onTabChange={(tab) =>
        void navigate({
          replace: true,
          search: (previous) => ({ ...previous, tab: tab === "diagnosis" ? undefined : tab }),
        })
      }
      tab={search.tab ?? "diagnosis"}
      onDiagnosisChange={(diagnosis) =>
        void navigate({ replace: true, search: (previous) => ({ ...previous, diagnosis }) })
      }
      onPeriodChange={(period) =>
        void navigate({
          replace: true,
          search: (previous) => ({ ...previous, period, diagnosis: undefined }),
        })
      }
      period={search.period ?? getCurrentPeriodInBrazil()}
    />
  );
}
