import { getCurrentPeriodInBrazil } from "@openmonetis/shared/date-time";
import { createFileRoute } from "@tanstack/react-router";
import { validateAiDiagnosesSearch } from "@/features/ai-diagnoses/ai-diagnoses.presentation";
import { AiDiagnosesPage } from "@/features/ai-diagnoses/components/ai-diagnoses-page";

export const Route = createFileRoute("/reports/ai-diagnoses")({
  head: () => ({ meta: [{ title: "Diagnóstico com IA · OpenMonetis" }] }),
  validateSearch: validateAiDiagnosesSearch,
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
