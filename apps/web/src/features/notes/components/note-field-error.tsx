export function FieldError({ errors }: { errors: unknown[] }) {
  const message = errors.find((error): error is string => typeof error === "string");
  return message ? (
    <p aria-live="polite" className="text-destructive text-xs" role="alert">
      {message}
    </p>
  ) : null;
}
