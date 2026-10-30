import type { CommitmentsOutput } from "@openmonetis/validators/commitments";
import {
  commitmentGaugeBands,
  describeCommitmentGauge,
  getCommitmentGaugePosition,
} from "../commitments.presentation";

type CommitmentStatus = CommitmentsOutput["months"][number]["status"];

const statusColors: Record<CommitmentStatus, string> = {
  healthy: "var(--success)",
  attention: "var(--warning)",
  critical: "var(--destructive)",
};

const center = { x: 100, y: 100 };
const radius = 80;
const strokeWidth = 14;
const needleLength = radius - 24;
/** Gap between bands, in percentage points of the 0–100% track. */
const bandGap = 1.5;

/** Point on the half circle for a position from 0% (left end) to 100% (right end). */
function pointAt(position: number, distance = radius) {
  const angle = Math.PI - (position / 100) * Math.PI;
  return {
    x: center.x + distance * Math.cos(angle),
    y: center.y - distance * Math.sin(angle),
  };
}

function arcPath(from: number, to: number) {
  const start = pointAt(from);
  const end = pointAt(to);
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 0 1 ${end.x} ${end.y}`;
}

/** Half-circle gauge of the share of the expected income already committed in a month. */
export function CommitmentGauge({
  percentage,
  status,
}: {
  percentage: number | null;
  status: CommitmentStatus;
}) {
  const position = getCommitmentGaugePosition(percentage);
  const needleEnd = position === null ? null : pointAt(position, needleLength);

  return (
    <svg
      aria-label={describeCommitmentGauge(percentage, status)}
      className="h-auto w-full max-w-64"
      role="img"
      viewBox="0 0 200 112"
    >
      {commitmentGaugeBands.map((band, index) => (
        <path
          d={arcPath(
            band.from + (index === 0 ? 0 : bandGap / 2),
            band.to - (index === commitmentGaugeBands.length - 1 ? 0 : bandGap / 2),
          )}
          fill="none"
          key={band.status}
          opacity={band.status === status ? 1 : 0.25}
          stroke={statusColors[band.status]}
          strokeLinecap="round"
          strokeWidth={strokeWidth}
        />
      ))}
      {needleEnd ? (
        <g>
          <line
            stroke="var(--foreground)"
            strokeLinecap="round"
            strokeWidth={3}
            x1={center.x}
            x2={needleEnd.x}
            y1={center.y}
            y2={needleEnd.y}
          />
          <circle
            cx={center.x}
            cy={center.y}
            fill="var(--card)"
            r={6}
            stroke="var(--foreground)"
            strokeWidth={3}
          />
        </g>
      ) : null}
    </svg>
  );
}
