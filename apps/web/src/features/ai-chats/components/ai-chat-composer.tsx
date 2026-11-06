import { aiChatMessageMaximumLength } from "@openmonetis/domain/ai-chats";
import { useForm } from "@tanstack/react-form";
import type { ReactNode } from "react";
import {
  type ChatStatus,
  PromptInput,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
} from "@/components/ai-elements/prompt-input";

export function AiChatComposer({
  disabled,
  onStop,
  onSubmit,
  status,
  tools,
}: {
  disabled: boolean;
  onStop: () => void;
  onSubmit: (content: string) => Promise<boolean>;
  status: ChatStatus;
  tools: ReactNode;
}) {
  const form = useForm({
    defaultValues: { content: "" },
    onSubmit: async ({ value, formApi }) => {
      const content = value.content.trim();
      if (!content) return;
      formApi.reset();
      // A refused message goes back to the box so nothing typed is lost.
      if (!(await onSubmit(content))) formApi.setFieldValue("content", content);
    },
  });

  return (
    <PromptInput
      onSubmit={(event) => {
        event.preventDefault();
        if (status === "ready") void form.handleSubmit();
      }}
    >
      <form.Field name="content">
        {(field) => (
          <PromptInputTextarea
            aria-label="Pergunte sobre suas finanças"
            disabled={disabled}
            maxLength={aiChatMessageMaximumLength}
            name={field.name}
            onBlur={field.handleBlur}
            onChange={(event) => field.handleChange(event.target.value)}
            placeholder="Pergunte sobre seus gastos, contas, metas…"
            value={field.state.value}
          />
        )}
      </form.Field>
      <PromptInputFooter>
        <PromptInputTools className="flex-wrap">{tools}</PromptInputTools>
        <form.Subscribe selector={(state) => state.values.content.trim().length > 0}>
          {(hasContent) => (
            <PromptInputSubmit disabled={disabled || !hasContent} onStop={onStop} status={status} />
          )}
        </form.Subscribe>
      </PromptInputFooter>
    </PromptInput>
  );
}
