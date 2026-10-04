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
  return (
    <div className="flex items-center justify-between gap-3 text-sm font-medium">
      {label}
      <Checkbox aria-label={label} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
