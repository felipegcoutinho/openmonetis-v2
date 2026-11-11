import { useId } from "react";
import { Checkbox } from "@/components/ui/checkbox";

export function FilterToggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  const id = useId();
  return (
    // The whole row is the hit target and the box sits right next to its text.
    <label className="flex min-h-9 cursor-pointer items-center gap-3 text-sm" htmlFor={id}>
      <Checkbox checked={checked} id={id} onCheckedChange={onChange} />
      {label}
    </label>
  );
}
