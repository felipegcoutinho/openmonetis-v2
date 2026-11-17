import { toast } from "sonner";

export function showInvalidFormToast() {
  toast.error("Revise os campos destacados.");
  const currentForm =
    typeof document === "undefined" ? null : document.activeElement?.closest("form");
  if (typeof requestAnimationFrame === "undefined") return;
  requestAnimationFrame(() =>
    currentForm
      ?.querySelector<HTMLElement>(
        '[aria-invalid="true"], [data-invalid="true"] input, [data-invalid="true"] button',
      )
      ?.focus(),
  );
}

type SubmittedFieldApi = { form: { state: { submissionAttempts: number } } };

/**
 * Field validators that stay quiet while the person is still filling the form: the first error
 * shows on submit, and from then on the field re-validates as it changes, so it clears once fixed.
 */
export function validateAfterSubmit<TValue>(validate: (value: TValue) => string | undefined) {
  return {
    onSubmit: ({ value }: { value: TValue }) => validate(value),
    onChange: ({ value, fieldApi }: { value: TValue; fieldApi: SubmittedFieldApi }) =>
      fieldApi.form.state.submissionAttempts > 0 ? validate(value) : undefined,
  };
}
