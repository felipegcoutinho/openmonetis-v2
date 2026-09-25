import type * as React from "react";
import { cn } from "@/lib/utils";

type LabelProps = React.ComponentProps<"label"> & {
  htmlFor: string;
};

function Label({ className, htmlFor, ...props }: LabelProps) {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: callers must pass htmlFor through LabelProps.
    <label
      className={cn(
        "flex items-center gap-2 font-medium text-sm leading-none tracking-tight",
        className,
      )}
      data-slot="label"
      htmlFor={htmlFor}
      {...props}
    />
  );
}

export { Label };
