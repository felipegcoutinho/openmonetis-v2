import type { AiProvider } from "@openmonetis/domain/ai-providers";
import type { AiProviderModel } from "@openmonetis/validators/ai-providers";
import { MobileSelect as Select } from "@/components/forms/mobile-select";
import { MobileSelectContent as SelectContent } from "@/components/forms/mobile-select-content";
import { SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { aiProviderDefaultModelValue, formatAiModelLabel } from "../ai-providers.presentation";
import { AiProviderMark } from "./ai-provider-mark";
import { aiSelectContentClassName, aiSelectItemClassName } from "./ai-select-styles";

/** Model of one provider; names use the mono face, like other technical identifiers. */
export function AiModelSelect({
  className,
  disabled,
  label,
  models,
  onValueChange,
  provider,
  showProviderMark = true,
  size = "default",
  value,
}: {
  className?: string;
  disabled?: boolean;
  label: string;
  models: readonly AiProviderModel[];
  onValueChange: (model: string | null) => void;
  provider: AiProvider;
  /** Hide the trigger mark when a provider select beside it already shows the brand. */
  showProviderMark?: boolean;
  size?: "sm" | "default";
  value: string | null;
}) {
  const options = [
    { id: aiProviderDefaultModelValue, name: "Padrão do plano" },
    ...models.map((model) => ({ id: model.id, name: model.name })),
  ];

  return (
    <Select
      disabled={disabled}
      onValueChange={(next) => {
        if (!next) return;
        onValueChange(next === aiProviderDefaultModelValue ? null : next);
      }}
      value={value ?? aiProviderDefaultModelValue}
    >
      <SelectTrigger aria-label={label} className={className} size={size}>
        <SelectValue>
          {showProviderMark ? <AiProviderMark provider={provider} size={16} /> : null}
          <span className={cn("truncate", value && "font-mono")}>
            {formatAiModelLabel(models, value)}
          </span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent className={aiSelectContentClassName}>
        {options.map((option) => (
          <SelectItem className={aiSelectItemClassName} key={option.id} value={option.id}>
            <AiProviderMark provider={provider} size={16} />
            <span
              className={cn("truncate", option.id !== aiProviderDefaultModelValue && "font-mono")}
            >
              {option.name}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
