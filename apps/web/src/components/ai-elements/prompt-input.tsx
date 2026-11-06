import { ArrowUpIcon, LoaderCircleIcon, SquareIcon } from "lucide-react";
import type { ComponentProps, KeyboardEvent } from "react";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@/components/ui/input-group";
import { cn } from "@/lib/utils";

export type ChatStatus = "ready" | "submitted" | "streaming" | "error";

/** AI Elements `PromptInput`, adapted: the composer frame; the form logic stays with the caller. */
export function PromptInput({ className, children, ...props }: ComponentProps<"form">) {
  return (
    <form className={cn("w-full", className)} {...props}>
      <InputGroup className="overflow-hidden rounded-xl bg-background">{children}</InputGroup>
    </form>
  );
}

export type PromptInputTextareaProps = ComponentProps<typeof InputGroupTextarea>;

/** Enter sends, Shift+Enter breaks the line; composing text (IME) never sends. */
export function PromptInputTextarea({ className, onKeyDown, ...props }: PromptInputTextareaProps) {
  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    onKeyDown?.(event);
    if (event.defaultPrevented || event.key !== "Enter" || event.shiftKey) return;
    if (event.nativeEvent.isComposing) return;
    event.preventDefault();
    event.currentTarget.form?.requestSubmit();
  }

  return (
    <InputGroupTextarea
      className={cn("field-sizing-content max-h-48 min-h-16 text-sm", className)}
      onKeyDown={handleKeyDown}
      {...props}
    />
  );
}

export function PromptInputFooter({ className, ...props }: ComponentProps<typeof InputGroupAddon>) {
  return (
    <InputGroupAddon
      align="block-end"
      className={cn("justify-between gap-1", className)}
      {...props}
    />
  );
}

export function PromptInputTools({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("flex min-w-0 items-center gap-1", className)} {...props} />;
}

export type PromptInputSubmitProps = ComponentProps<typeof InputGroupButton> & {
  status: ChatStatus;
  onStop?: () => void;
};

/** Sends while idle; while a reply is on its way it becomes the stop button. */
export function PromptInputSubmit({
  className,
  status,
  onStop,
  disabled,
  ...props
}: PromptInputSubmitProps) {
  const isBusy = status === "submitted" || status === "streaming";
  return (
    <InputGroupButton
      aria-label={isBusy ? "Parar resposta" : "Enviar mensagem"}
      className={cn("rounded-full", className)}
      disabled={isBusy ? !onStop : disabled}
      onClick={isBusy ? () => onStop?.() : undefined}
      size="icon-sm"
      type={isBusy ? "button" : "submit"}
      variant="default"
      {...props}
    >
      {status === "submitted" && !onStop ? (
        <LoaderCircleIcon className="size-4 animate-spin" />
      ) : isBusy ? (
        <SquareIcon className="size-3.5 fill-current" />
      ) : (
        <ArrowUpIcon className="size-4" />
      )}
    </InputGroupButton>
  );
}
