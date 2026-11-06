import { type AiDiagnosisVoice, aiDiagnosisVoices } from "@openmonetis/domain/ai-diagnoses";
import { MessageSquareQuote } from "lucide-react";
import { MobileSelect as Select } from "@/components/forms/mobile-select";
import { MobileSelectContent as SelectContent } from "@/components/forms/mobile-select-content";
import { SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  aiSelectContentClassName,
  aiSelectItemClassName,
} from "@/features/ai-providers/components/ai-select-styles";
import { aiDiagnosisVoiceDescriptions, aiDiagnosisVoiceLabels } from "../ai-diagnoses.presentation";

/** Writing style of the next diagnosis; it changes only the text, never the numbers. */
export function AiDiagnosisVoiceSelect({
  className,
  disabled,
  onValueChange,
  size = "default",
  value,
}: {
  className?: string;
  disabled?: boolean;
  onValueChange: (voice: AiDiagnosisVoice) => void;
  size?: "sm" | "default";
  value: AiDiagnosisVoice;
}) {
  return (
    <Select
      disabled={disabled}
      onValueChange={(next) => {
        if (next) onValueChange(next as AiDiagnosisVoice);
      }}
      value={value}
    >
      <SelectTrigger aria-label="Estilo do texto" className={className} size={size}>
        <SelectValue>
          <MessageSquareQuote aria-hidden="true" className="size-4 text-muted-foreground" />
          <span className="truncate">{aiDiagnosisVoiceLabels[value]}</span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent className={aiSelectContentClassName}>
        {aiDiagnosisVoices.map((voice) => (
          <SelectItem className={aiSelectItemClassName} key={voice} value={voice}>
            <span className="grid">
              <span>{aiDiagnosisVoiceLabels[voice]}</span>
              <span className="text-muted-foreground text-xs">
                {aiDiagnosisVoiceDescriptions[voice]}
              </span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
