import { Progress as ProgressPrimitive } from "@base-ui/react/progress";

import { cn } from "@/lib/utils";

/** Terminal-style meter: thin vertical ticks, filled ones carry the value. */
const progressTickMask =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='4' height='8' viewBox='0 0 4 8' preserveAspectRatio='none'%3E%3Crect width='2' height='8'/%3E%3C/svg%3E\")";

function Progress({
  className,
  children,
  indicatorClassName,
  trackClassName,
  value,
  ...props
}: ProgressPrimitive.Root.Props & {
  indicatorClassName?: string;
  trackClassName?: string;
}) {
  return (
    <ProgressPrimitive.Root
      value={value}
      data-slot="progress"
      className={cn("flex flex-wrap gap-3", className)}
      {...props}
    >
      {children}
      <ProgressTrack className={trackClassName}>
        <ProgressIndicator className={indicatorClassName} />
      </ProgressTrack>
    </ProgressPrimitive.Root>
  );
}

function ProgressTrack({ className, ...props }: ProgressPrimitive.Track.Props) {
  return (
    <ProgressPrimitive.Track
      className={cn("relative flex h-2 w-full overflow-hidden bg-muted-foreground/20", className)}
      data-slot="progress-track"
      style={{ maskImage: progressTickMask, maskSize: "4px 100%", maskRepeat: "repeat-x" }}
      {...props}
    />
  );
}

function ProgressIndicator({ className, ...props }: ProgressPrimitive.Indicator.Props) {
  return (
    <ProgressPrimitive.Indicator
      data-slot="progress-indicator"
      className={cn(
        "h-full origin-left animate-[progress-fill_0.6s_var(--ease-out-strong)_both] bg-foreground transition-[width] duration-300 ease-out motion-reduce:animate-none motion-reduce:transition-none",
        className,
      )}
      {...props}
    />
  );
}

export { Progress };
