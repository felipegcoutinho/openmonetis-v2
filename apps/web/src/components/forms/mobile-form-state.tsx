/** The form's own state includes selections without native inputs, such as logos. */
export function MobileFormState({
  isDirty,
  isSubmitting,
}: {
  isDirty: boolean;
  isSubmitting: boolean;
}) {
  return <span hidden data-mobile-form-state data-dirty={isDirty} data-submitting={isSubmitting} />;
}
