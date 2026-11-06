import { type AiDiagnosisVoice, defaultAiDiagnosisVoice } from "@openmonetis/domain/ai-diagnoses";
import type { AiProvider } from "@openmonetis/domain/ai-providers";
import type { AiProviderOutput } from "@openmonetis/validators/ai-providers";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { MessagesSquare, RefreshCw, ShieldCheck, Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Suggestion, Suggestions } from "@/components/ai-elements/suggestion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { aiDataSharingQueryOptions } from "@/features/ai-data-sharing/ai-data-sharing.queries";
import { AiDiagnosisVoiceSelect } from "@/features/ai-diagnoses/components/ai-diagnosis-voice-select";
import { aiProviderLabels } from "@/features/ai-providers/ai-providers.presentation";
import { AiModelSelect } from "@/features/ai-providers/components/ai-model-select";
import { AiProviderMark } from "@/features/ai-providers/components/ai-provider-mark";
import { AiProviderSelect } from "@/features/ai-providers/components/ai-provider-select";
import { formatPeriod } from "@/lib/period-presentation";
import { useCreateAiChatMutation } from "../ai-chats.mutations";
import { aiChatErrorMessage, aiChatSuggestions } from "../ai-chats.presentation";
import { aiChatQueryOptions, aiChatsQueryOptions } from "../ai-chats.queries";
import { useAiChatStream } from "../useAiChatStream";
import { AiChatComposer } from "./ai-chat-composer";
import { AiChatList } from "./ai-chat-list";
import { AiChatAnswer, AiChatQuestion, AiChatThinking } from "./ai-chat-message";

type Target = { provider: AiProvider; model: string | null };

export function AiChatPanel({
  chatId,
  connectedProviders,
  onChatChange,
  period,
}: {
  chatId: string | undefined;
  connectedProviders: AiProviderOutput[];
  onChatChange: (chatId: string | undefined) => void;
  period: string;
}) {
  const chatsQuery = useQuery(aiChatsQueryOptions());
  const chatQuery = useQuery({ ...aiChatQueryOptions(chatId ?? ""), enabled: Boolean(chatId) });
  const sharingQuery = useQuery(aiDataSharingQueryOptions());
  const createMutation = useCreateAiChatMutation();
  const stream = useAiChatStream();
  const [chosen, setChosen] = useState<Target | null>(null);
  const [voice, setVoice] = useState<AiDiagnosisVoice>(defaultAiDiagnosisVoice);
  const [listOpen, setListOpen] = useState(false);

  const chat = chatId ? chatQuery.data : undefined;
  const providerItem =
    connectedProviders.find((item) => item.provider === chosen?.provider) ??
    connectedProviders.find((item) => item.provider === chat?.provider) ??
    connectedProviders[0];
  const provider = providerItem?.provider ?? null;
  const fallbackModel =
    chat?.provider === provider
      ? chat.model
      : providerItem?.models.some((model) => model.id === providerItem.preferredModel)
        ? providerItem.preferredModel
        : null;
  const model = chosen?.provider === provider ? chosen.model : (fallbackModel ?? null);

  const messages = chat?.messages ?? [];
  const streaming = stream.reply && stream.reply.chatId === chatId ? stream.reply : null;
  const isBusy = stream.status !== "ready" || createMutation.isPending;
  const lastMessage = messages.at(-1);
  const scopes = sharingQuery.data?.scopes ?? [];

  function selectChat(id: string | undefined) {
    if (stream.status !== "ready") stream.stop();
    setListOpen(false);
    onChatChange(id);
  }

  async function send(content: string) {
    if (!provider) return false;
    let id = chatId;
    if (!id) {
      try {
        id = (await createMutation.mutateAsync({ period, provider, model })).id;
        onChatChange(id);
      } catch (error) {
        toast.error(aiChatErrorMessage(error));
        return false;
      }
    }
    return stream.send(id, { content, provider, model, voice });
  }

  function regenerate() {
    if (chatId && provider) void stream.regenerate(chatId, { provider, model, voice });
  }

  const list = (
    <AiChatList
      chats={chatsQuery.data?.items ?? []}
      isLoading={chatsQuery.isLoading}
      onDeleted={(id) => {
        if (id === chatId) onChatChange(undefined);
      }}
      onNewChat={() => selectChat(undefined)}
      onSelect={selectChat}
      selectedId={chatId}
    />
  );

  return (
    <Card className="grid h-[calc(100svh-8rem)] min-h-[40rem] grid-cols-1 gap-0 overflow-hidden p-0 lg:grid-cols-[16rem_minmax(0,1fr)]">
      <aside className="hidden min-h-0 min-w-0 border-border border-r p-3 lg:block">{list}</aside>

      <section className="flex min-h-0 min-w-0 flex-col">
        <header className="flex items-center gap-2 border-border border-b px-4 py-2.5">
          <Sheet onOpenChange={setListOpen} open={listOpen}>
            <SheetTrigger
              render={
                <Button
                  aria-label="Ver conversas"
                  className="lg:hidden"
                  size="icon-sm"
                  type="button"
                  variant="ghost"
                />
              }
            >
              <MessagesSquare aria-hidden="true" />
            </SheetTrigger>
            <SheetContent side="left">
              <SheetHeader>
                <SheetTitle>Conversas</SheetTitle>
              </SheetHeader>
              <SheetBody className="min-h-0 flex-1">{list}</SheetBody>
            </SheetContent>
          </Sheet>
          <h2 className="min-w-0 flex-1 truncate font-medium text-sm">
            {chat?.title ?? "Nova conversa"}
          </h2>
          <Badge className="hidden shrink-0 font-mono sm:inline-flex" variant="outline">
            <span className="sr-only">Dados de </span>
            {formatPeriod(chat?.period ?? period, true)}
          </Badge>
          <Button asChild className="shrink-0" size="sm" variant="secondary">
            <Link
              aria-label="Permissões de dados"
              search={{ tab: "integrations" }}
              title="Permissões de dados"
              to="/settings"
            >
              <ShieldCheck aria-hidden="true" />
              <span className="max-sm:sr-only">
                {scopes.length === 0
                  ? "Só totais"
                  : sharingQuery.data?.isFull
                    ? "Todos os dados"
                    : `${scopes.length} permiss${scopes.length === 1 ? "ão" : "ões"}`}
              </span>
            </Link>
          </Button>
        </header>

        <Conversation className="min-h-0">
          <ConversationContent className="mx-auto w-full max-w-3xl">
            {chatId && chatQuery.isLoading ? (
              <div className="grid gap-4" role="status" aria-label="Carregando conversa">
                <Skeleton className="ml-auto h-10 w-1/2" />
                <Skeleton className="h-24 w-full" />
              </div>
            ) : null}
            {chatQuery.isError && chatId ? (
              <div className="grid justify-items-center gap-3 text-center text-sm">
                <p className="text-muted-foreground" role="alert">
                  Não foi possível carregar a conversa.
                </p>
                <Button
                  disabled={chatQuery.isFetching}
                  onClick={() => void chatQuery.refetch()}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  <RefreshCw aria-hidden="true" />
                  {chatQuery.isFetching ? "Tentando…" : "Tentar novamente"}
                </Button>
              </div>
            ) : null}
            {!messages.length &&
            !streaming?.pendingQuestion &&
            !(chatId && (chatQuery.isLoading || chatQuery.isError)) ? (
              <ConversationEmptyState className="gap-4 sm:gap-6">
                <div className="grid justify-items-center gap-3">
                  <span className="hidden size-12 place-items-center rounded-2xl sm:grid bg-brand/10 text-brand-strong ring-1 ring-brand/15">
                    <Sparkles aria-hidden="true" className="size-5" />
                  </span>
                  <div className="grid max-w-md gap-1.5">
                    <h3 className="font-semibold text-base tracking-tight sm:text-lg">
                      Converse sobre suas finanças
                    </h3>
                    <p className="text-balance text-muted-foreground text-sm leading-relaxed">
                      As respostas usam os dados de{" "}
                      <span className="font-medium text-foreground">
                        {formatPeriod(chat?.period ?? period)}
                      </span>{" "}
                      conforme suas permissões.
                    </p>
                  </div>
                </div>
                <div className="grid w-full max-w-xl gap-2">
                  <p className="hidden text-left font-medium text-muted-foreground text-xs sm:block">
                    Comece por aqui
                  </p>
                  <Suggestions className="grid gap-2 max-sm:[&>*:nth-child(n+3)]:hidden sm:grid-cols-2">
                    {aiChatSuggestions.map(({ text, icon: Icon }) => (
                      <Suggestion
                        className="group h-auto min-h-10 w-full justify-start gap-3 whitespace-normal rounded-xl px-3 py-2 text-left font-normal sm:min-h-12 sm:py-2.5"
                        disabled={isBusy || !provider}
                        key={text}
                        onClick={(value) => void send(value)}
                        suggestion={text}
                      >
                        <span className="hidden size-7 shrink-0 place-items-center rounded-lg bg-muted sm:grid text-muted-foreground transition-colors group-hover:bg-brand/10 group-hover:text-brand-strong">
                          <Icon aria-hidden="true" className="size-4" />
                        </span>
                        <span className="min-w-0 flex-1">{text}</span>
                      </Suggestion>
                    ))}
                  </Suggestions>
                </div>
              </ConversationEmptyState>
            ) : null}

            {messages.map((message) =>
              message.role === "user" ? (
                <AiChatQuestion content={message.content} key={message.id} />
              ) : (
                <AiChatAnswer
                  canRegenerate={message === lastMessage && !isBusy}
                  key={message.id}
                  message={message}
                  onRegenerate={regenerate}
                  streaming={streaming?.assistantId === message.id ? streaming : null}
                />
              ),
            )}
            {streaming?.pendingQuestion ? (
              <>
                <AiChatQuestion content={streaming.pendingQuestion} />
                <AiChatThinking />
              </>
            ) : null}
            {!chatId && createMutation.isPending ? <AiChatThinking /> : null}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>

        <div className="mx-auto w-full max-w-3xl px-3 pt-1 pb-3 sm:px-4 sm:pb-4">
          <AiChatComposer
            disabled={!provider}
            onStop={stream.stop}
            onSubmit={send}
            status={createMutation.isPending ? "submitted" : stream.status}
            tools={
              providerItem ? (
                <>
                  {connectedProviders.length > 1 ? (
                    <AiProviderSelect
                      className="h-8 w-auto border-0 bg-transparent shadow-none"
                      disabled={isBusy}
                      onValueChange={(next) => setChosen({ provider: next, model: null })}
                      providers={connectedProviders.map((item) => item.provider)}
                      size="sm"
                      value={providerItem.provider}
                    />
                  ) : (
                    <span className="hidden items-center gap-1.5 px-2 text-muted-foreground text-xs sm:flex">
                      <AiProviderMark provider={providerItem.provider} size={14} />
                      {aiProviderLabels[providerItem.provider]}
                    </span>
                  )}
                  <AiModelSelect
                    className="h-8 w-auto max-w-52 border-0 bg-transparent shadow-none"
                    provider={providerItem.provider}
                    size="sm"
                    disabled={isBusy}
                    label="Modelo"
                    models={providerItem.models}
                    onValueChange={(next) =>
                      setChosen({ provider: providerItem.provider, model: next })
                    }
                    showProviderMark={connectedProviders.length === 1}
                    value={model}
                  />
                  <AiDiagnosisVoiceSelect
                    className="h-8 w-auto border-0 bg-transparent shadow-none"
                    disabled={isBusy}
                    onValueChange={setVoice}
                    size="sm"
                    value={voice}
                  />
                </>
              ) : null
            }
          />
          <p className="mt-2 text-center text-muted-foreground text-xs">
            A IA pode errar.
            <span className="max-sm:hidden">
              {" "}
              Confira os números no OpenMonetis antes de decidir.
            </span>
          </p>
        </div>
      </section>
    </Card>
  );
}
