import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden="true"
      className={cn(
        "relative overflow-hidden rounded-md bg-muted/70 before:absolute before:inset-y-0 before:left-0 before:w-2/3 before:-translate-x-[175%] before:animate-[skeleton-shimmer_1.8s_ease-in-out_infinite] before:bg-linear-to-r before:from-transparent before:via-background/55 before:to-transparent motion-reduce:before:animate-none",
        className,
      )}
      {...props}
    />
  );
}

export { Skeleton };
