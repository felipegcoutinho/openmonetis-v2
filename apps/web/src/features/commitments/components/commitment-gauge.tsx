import type { CommitmentsOutput } from "@openmonetis/validators/commitments";
import { useId } from "react";
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
const radius = 88;
const strokeWidth = 8;
/** Gap between bands, in percentage points of the 0–100% track. */
const bandGap = 1.5;
/** How far the outer bands run past the track ends, so the mask can round them off. */
const endOverrun = 6;

/** Point on the half circle for a position from 0% (left end) to 100% (right end). */
function pointAt(position: number) {
  const angle = Math.PI - (position / 100) * Math.PI;
  return {
    x: center.x + radius * Math.cos(angle),
    y: center.y - radius * Math.sin(angle),
  };
}

function arcPath(from: number, to: number) {
  const start = pointAt(from);
  const end = pointAt(to);
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 0 1 ${end.x} ${end.y}`;
}

/**
 * Half-circle gauge of the share of the expected income already committed in a month. The centre
 * is left empty so the caller can place the value inside the arc.
 */
export function CommitmentGauge({
  percentage,
  status,
}: {
  percentage: number | null;
  status: CommitmentStatus;
}) {
  const maskId = useId();
  const position = getCommitmentGaugePosition(percentage);
  const marker = position === null ? null : pointAt(position);
  const lastBand = commitmentGaugeBands.length - 1;

  return (
    <svg
      aria-label={describeCommitmentGauge(percentage, status)}
      className="h-auto w-full"
      role="img"
      viewBox="0 0 200 110"
    >
      {/* Bands meet with flat edges; one rounded track masks them so only the two ends are round. */}
      <mask id={maskId} maskUnits="userSpaceOnUse" x={0} y={0} width={200} height={110}>
        <path
          d={arcPath(0, 100)}
          fill="none"
          stroke="white"
          strokeLinecap="round"
          strokeWidth={strokeWidth}
        />
      </mask>
      <g mask={`url(#${maskId})`}>
        {commitmentGaugeBands.map((band, index) => (
          <path
            d={arcPath(
              index === 0 ? -endOverrun : band.from + bandGap / 2,
              index === lastBand ? 100 + endOverrun : band.to - bandGap / 2,
            )}
            fill="none"
            key={band.status}
            opacity={band.status === status ? 1 : 0.22}
            stroke={statusColors[band.status]}
            strokeWidth={strokeWidth}
          />
        ))}
      </g>
      {marker ? (
        <circle
          cx={marker.x}
          cy={marker.y}
          fill={statusColors[status]}
          r={7}
          stroke="var(--card)"
          strokeWidth={3.5}
        />
      ) : null}
    </svg>
  );
}
