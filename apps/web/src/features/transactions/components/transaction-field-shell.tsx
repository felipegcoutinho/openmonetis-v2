import type { FieldShellProps } from "./transaction-form.types";

export function FieldShell({ label, error, children }: FieldShellProps) {
  return (
    <fieldset className="flex min-w-0 flex-col gap-1.5" data-invalid={error ? "true" : undefined}>
      <legend className="mb-1.5 text-sm font-medium">{label}</legend>
      {children}
      {error ? (
        <p className="text-destructive text-xs" role="alert">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
