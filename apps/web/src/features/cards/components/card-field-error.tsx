export function FieldError({ message }: { message?: string }) {
  return message ? (
    <p className="text-destructive text-xs" role="alert">
      {message}
    </p>
  ) : null;
}
