import type { AiChatMessageOutput } from "@openmonetis/validators/ai-chats";
import { CircleAlert, CircleStop, CopyIcon, LoaderCircle, RefreshCwIcon } from "lucide-react";
import { toast } from "sonner";
import {
  Message,
  MessageAction,
  MessageActions,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import { Reasoning } from "@/components/ai-elements/reasoning";
import { aiProviderLabels } from "@/features/ai-providers/ai-providers.presentation";
import { AiProviderMark } from "@/features/ai-providers/components/ai-provider-mark";
import { aiChatFailureMessage, formatChatUpdatedAt } from "../ai-chats.presentation";
import type { StreamingReply } from "../useAiChatStream";

export function AiChatQuestion({ content }: { content: string }) {
  return (
    <Message from="user">
      <MessageContent>
        <p className="whitespace-pre-wrap break-words">{content}</p>
      </MessageContent>
    </Message>
  );
}

export function AiChatAnswer({
  message,
  streaming,
  canRegenerate,
  onRegenerate,
}: {
  message: AiChatMessageOutput;
  streaming: StreamingReply | null;
  canRegenerate: boolean;
  onRegenerate: () => void;
}) {
  const isStreaming = message.status === "streaming" && streaming !== null;
  const content = isStreaming ? streaming.content : message.content;
  const reasoning = isStreaming ? streaming.reasoning : (message.reasoning ?? "");

  async function copy() {
    try {
      await navigator.clipboard.writeText(content);
      toast.success("Resposta copiada");
    } catch {
      toast.error("Não foi possível copiar.");
    }
  }

  return (
    <Message from="assistant">
      <MessageContent>
        {reasoning ? (
          <Reasoning isStreaming={isStreaming && !content}>{reasoning}</Reasoning>
        ) : null}
        {isStreaming && !content && !reasoning ? <AiChatThinking /> : null}
        {content ? <MessageResponse>{content}</MessageResponse> : null}
        {message.status === "failed" ? (
          <p className="flex items-start gap-2 text-destructive text-sm" role="alert">
            <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            {aiChatFailureMessage(message.failureCode)}
          </p>
        ) : null}
        {message.status === "canceled" ? (
          <p className="flex items-center gap-2 text-muted-foreground text-xs">
            <CircleStop aria-hidden="true" className="size-3.5" />
            Resposta interrompida.
          </p>
        ) : null}
      </MessageContent>
      {message.status !== "streaming" ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <MessageActions>
            {content ? (
              <MessageAction label="Copiar resposta" onClick={() => void copy()}>
                <CopyIcon className="size-3.5" />
              </MessageAction>
            ) : null}
            {canRegenerate ? (
              <MessageAction label="Responder de novo" onClick={onRegenerate}>
                <RefreshCwIcon className="size-3.5" />
              </MessageAction>
            ) : null}
          </MessageActions>
          {message.provider ? (
            <span className="flex items-center gap-1.5 text-muted-foreground text-xs">
              <AiProviderMark provider={message.provider} size={14} />
              {message.model?.name ?? aiProviderLabels[message.provider]} ·{" "}
              {formatChatUpdatedAt(message.completedAt ?? message.createdAt)}
            </span>
          ) : null}
        </div>
      ) : null}
    </Message>
  );
}

export function AiChatThinking() {
  return (
    <p className="flex items-center gap-2 text-muted-foreground text-sm" role="status">
      <LoaderCircle aria-hidden="true" className="size-4 animate-spin text-brand-strong" />
      <span>Analisando seus dados…</span>
    </p>
  );
}
