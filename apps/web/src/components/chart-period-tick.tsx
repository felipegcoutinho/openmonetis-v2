import { formatDateInBrazil, periodToSafeInstant } from "@openmonetis/shared/date-time";

type ChartPeriodTickProps = {
  x?: number | string;
  y?: number | string;
  index?: number;
  payload?: { value: string | number };
  disabled: boolean;
  getLabel: (period: string) => string;
  onPeriodChange?: (period: string) => void;
  selectedPeriod: string;
};

/**
 * Month tick for 12-month history charts: each month is a keyboard-reachable link that opens
 * that period. Shows the abbreviated month and, on the first tick and every January, the year.
 */
export function ChartPeriodTick({
  x = 0,
  y = 0,
  index = 0,
  payload,
  disabled,
  getLabel,
  onPeriodChange,
  selectedPeriod,
}: ChartPeriodTickProps) {
  const period = String(payload?.value ?? "");
  if (!period) return null;
  const selected = period === selectedPeriod;
  const instant = periodToSafeInstant(period);
  const month = formatDateInBrazil(instant, { month: "short" }).replace(".", "");
  const showYear = index === 0 || period.endsWith("-01");

  function openPeriod() {
    if (!disabled) onPeriodChange?.(period);
  }

  return (
    <a
      aria-current={selected ? "date" : undefined}
      aria-label={getLabel(period)}
      className="cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      href={`?period=${encodeURIComponent(period)}`}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        openPeriod();
      }}
      onKeyDown={(event) => {
        if (event.key !== " ") return;
        event.preventDefault();
        openPeriod();
      }}
      tabIndex={disabled ? -1 : 0}
    >
      <text
        fill={selected ? "var(--foreground)" : "var(--muted-foreground)"}
        fontSize={12}
        fontWeight={selected ? 600 : undefined}
        textAnchor="middle"
        x={x}
        y={y}
      >
        <tspan dy={16} x={x}>
          {month}
        </tspan>
        {showYear ? (
          <tspan dy={14} fontSize={10} x={x}>
            {formatDateInBrazil(instant, { year: "2-digit" })}
          </tspan>
        ) : null}
      </text>
    </a>
  );
}
