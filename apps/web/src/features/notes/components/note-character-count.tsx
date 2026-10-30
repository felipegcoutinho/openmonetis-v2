import { cn } from "@/lib/utils";
import { isNearLimit } from "../notes.presentation";

export function NoteCharacterCount({ length, maximum }: { length: number; maximum: number }) {
  if (!isNearLimit(length, maximum)) return null;
  return (
    <span
      aria-live="polite"
      className={cn(
        "text-muted-foreground text-xs tabular-nums",
        length >= maximum && "text-destructive",
      )}
    >
      {length}/{maximum}
    </span>
  );
}
