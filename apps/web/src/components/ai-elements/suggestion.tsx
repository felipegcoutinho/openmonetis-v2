import type { ComponentProps } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** AI Elements `Suggestions`: ready-made prompts that wrap instead of scrolling. */
export function Suggestions({ className, children, ...props }: ComponentProps<"div">) {
  return (
    <div className={cn("flex w-full flex-wrap items-center gap-2", className)} {...props}>
      {children}
    </div>
  );
}

export type SuggestionProps = Omit<ComponentProps<typeof Button>, "onClick"> & {
  suggestion: string;
  onClick?: (suggestion: string) => void;
};

export function Suggestion({
  suggestion,
  onClick,
  className,
  variant = "outline",
  size = "sm",
  children,
  ...props
}: SuggestionProps) {
  return (
    <Button
      className={cn("rounded-full px-4", className)}
      onClick={() => onClick?.(suggestion)}
      size={size}
      type="button"
      variant={variant}
      {...props}
    >
      {children ?? suggestion}
    </Button>
  );
}
