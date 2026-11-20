import { Slot } from "@radix-ui/react-slot";
import { createContext, type ReactElement, useContext, useId } from "react";
import type { FieldShellProps } from "./transaction-form.types";

type FieldShellIds = { legendId: string; errorId: string; controlId: string; hasError: boolean };

const FieldShellContext = createContext<FieldShellIds | null>(null);

export function FieldShell({ label, error, children }: FieldShellProps) {
  const baseId = useId();
  const ids: FieldShellIds = {
    legendId: `${baseId}-label`,
    errorId: `${baseId}-error`,
    controlId: `${baseId}-control`,
    hasError: Boolean(error),
  };

  return (
    <FieldShellContext value={ids}>
      <fieldset className="flex min-w-0 flex-col gap-1.5" data-invalid={error ? "true" : undefined}>
        <legend className="font-mono mb-1.5 text-sm font-medium" id={ids.legendId}>
          {label}
        </legend>
        {children}
        {error ? (
          <p className="text-destructive text-xs" id={ids.errorId} role="alert">
            {error}
          </p>
        ) : null}
      </fieldset>
    </FieldShellContext>
  );
}

/**
 * Names the wrapped control after the field legend and links it to the field error, so a
 * select trigger or input announces "Forma de pagamento" instead of only its current value.
 * Use `withOwnText` for button-like controls whose text is the value (e.g. a date trigger).
 */
export function FieldShellControl({
  children,
  withOwnText = false,
}: {
  children: ReactElement;
  withOwnText?: boolean;
}) {
  const ids = useContext(FieldShellContext);
  if (!ids) return children;

  return (
    <Slot
      aria-describedby={ids.hasError ? ids.errorId : undefined}
      aria-labelledby={withOwnText ? `${ids.legendId} ${ids.controlId}` : ids.legendId}
      id={withOwnText ? ids.controlId : undefined}
    >
      {children}
    </Slot>
  );
}
