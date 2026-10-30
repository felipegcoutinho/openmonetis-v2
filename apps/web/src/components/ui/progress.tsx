import { Progress as ProgressPrimitive } from "@base-ui/react/progress";

import { cn } from "@/lib/utils";

const progressSegmentMask =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='5' height='12' viewBox='0 0 5 12' preserveAspectRatio='none'%3E%3Crect width='3' height='12' rx='1.5'/%3E%3C/svg%3E\")";

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
      className={cn(
        "relative flex h-3 min-h-3 w-full overflow-hidden bg-muted-foreground/20",
        className,
      )}
      data-slot="progress-track"
      style={{
        maskImage: progressSegmentMask,
        maskSize: "5px 100%",
        maskRepeat: "repeat-x",
      }}
      {...props}
    />
  );
}

function ProgressIndicator({ className, ...props }: ProgressPrimitive.Indicator.Props) {
  return (
    <ProgressPrimitive.Indicator
      data-slot="progress-indicator"
      className={cn(
        "min-h-3 origin-left animate-[progress-fill_0.9s_cubic-bezier(0.22,1,0.36,1)_both] bg-foreground transition-[width] motion-reduce:animate-none motion-reduce:transition-none",
        className,
      )}
      {...props}
    />
  );
}

export { Progress };
