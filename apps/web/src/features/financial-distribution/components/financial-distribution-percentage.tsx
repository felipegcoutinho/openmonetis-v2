import { usePrivacyMode } from "@/components/privacy-provider";
import { cn } from "@/lib/utils";
import {
  formatDistributionPercentage,
  formatSignedDistributionPercentage,
} from "../financial-distribution.presentation";

export function FinancialDistributionPercentage({
  value,
  signed = false,
  className,
}: {
  value: number | null;
  signed?: boolean;
  className?: string;
}) {
  const { isPrivacyModeEnabled } = usePrivacyMode();
  const formattedValue = signed
    ? formatSignedDistributionPercentage(value)
    : formatDistributionPercentage(value);
  return (
    <span
      role="img"
      aria-label={isPrivacyModeEnabled ? "Percentual oculto" : formattedValue}
      className={cn(
        "text-muted-foreground text-xs tabular-nums",
        isPrivacyModeEnabled && "blur-md select-none",
        className,
      )}
    >
      <span aria-hidden={isPrivacyModeEnabled}>{formattedValue}</span>
    </span>
  );
}
