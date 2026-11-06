import type { AiProvider } from "@openmonetis/domain/ai-providers";
import { MobileSelect as Select } from "@/components/forms/mobile-select";
import { MobileSelectContent as SelectContent } from "@/components/forms/mobile-select-content";
import { SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { aiProviderLabels } from "../ai-providers.presentation";
import { AiProviderMark } from "./ai-provider-mark";
import { aiSelectContentClassName, aiSelectItemClassName } from "./ai-select-styles";

/** Choice among the connected assistants, each with its brand mark. */
export function AiProviderSelect({
  className,
  disabled,
  onValueChange,
  providers,
  size = "default",
  value,
}: {
  className?: string;
  disabled?: boolean;
  onValueChange: (provider: AiProvider) => void;
  providers: readonly AiProvider[];
  size?: "sm" | "default";
  value: AiProvider;
}) {
  return (
    <Select
      disabled={disabled}
      onValueChange={(next) => {
        if (next) onValueChange(next as AiProvider);
      }}
      value={value}
    >
      <SelectTrigger aria-label="Assistente" className={className} size={size}>
        <SelectValue>
          <AiProviderMark provider={value} size={16} />
          {aiProviderLabels[value]}
        </SelectValue>
      </SelectTrigger>
      <SelectContent className={aiSelectContentClassName}>
        {providers.map((provider) => (
          <SelectItem className={aiSelectItemClassName} key={provider} value={provider}>
            <AiProviderMark provider={provider} size={16} />
            {aiProviderLabels[provider]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
