import { getCurrentPeriodInBrazil } from "@openmonetis/shared/date-time";
import { DashboardQuerySchema } from "@openmonetis/validators/dashboard";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { DashboardPage } from "@/features/dashboard/components/dashboard-page";

const legacyDashboardPeriodSlugs = [
  "janeiro",
  "fevereiro",
  "marco",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
] as const;

export const Route = createFileRoute("/dashboard")({
  beforeLoad: ({ search }) => {
    const period = DashboardQuerySchema.shape.period.safeParse(search.period);

    if (!period.success) {
      throw redirect({
        replace: true,
        search: {
          period: parseLegacyDashboardPeriodSlug(search.period) ?? getCurrentPeriodInBrazil(),
        },
        to: "/dashboard",
      });
    }
  },
  component: DashboardRoute,
  validateSearch: validateDashboardSearch,
});

function DashboardRoute() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const period = resolveDashboardPeriod(search.period);

  return (
    <DashboardPage
      onPeriodChange={(nextPeriod) =>
        navigate({
          replace: true,
          search: (previous) => ({
            ...previous,
            period: nextPeriod,
          }),
        })
      }
      period={period}
    />
  );
}

type DashboardSearch = { period?: string };

function validateDashboardSearch(search: Record<string, unknown>): DashboardSearch {
  const period = DashboardQuerySchema.shape.period.safeParse(search.period);
  const legacyPeriod = parseLegacyDashboardPeriodSlug(search.period);

  return {
    period: period.success || legacyPeriod ? String(search.period) : undefined,
  };
}

function resolveDashboardPeriod(value: unknown) {
  const period = DashboardQuerySchema.shape.period.safeParse(value);
  return period.success ? period.data : getCurrentPeriodInBrazil();
}

function parseLegacyDashboardPeriodSlug(value: unknown) {
  if (typeof value !== "string") return undefined;

  const match = /^([a-z]+)-([1-9]\d{3})$/.exec(value);
  if (!match) return undefined;

  const month = legacyDashboardPeriodSlugs.indexOf(
    match[1] as (typeof legacyDashboardPeriodSlugs)[number],
  );
  if (month < 0) return undefined;

  return `${match[2]}-${String(month + 1).padStart(2, "0")}`;
}
