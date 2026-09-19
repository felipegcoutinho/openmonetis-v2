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
