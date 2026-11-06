import { aiChatTitleMaximumLength } from "@openmonetis/domain/ai-chats";
import {
  type AiChatSummaryOutput,
  UpdateAiChatInputSchema,
} from "@openmonetis/validators/ai-chats";
import { useForm } from "@tanstack/react-form";
import { Ellipsis, MessageSquarePlus, Pencil, Trash2 } from "lucide-react";
import { useId, useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { AiProviderMark } from "@/features/ai-providers/components/ai-provider-mark";
import { showInvalidFormToast } from "@/lib/form-feedback";
import { cn } from "@/lib/utils";
import { useDeleteAiChatMutation, useRenameAiChatMutation } from "../ai-chats.mutations";
import { aiChatErrorMessage, formatChatUpdatedAt } from "../ai-chats.presentation";

export function AiChatList({
  chats,
  isLoading,
  selectedId,
  onNewChat,
  onSelect,
  onDeleted,
}: {
  chats: AiChatSummaryOutput[];
  isLoading: boolean;
  selectedId: string | undefined;
  onNewChat: () => void;
  onSelect: (id: string) => void;
  onDeleted: (id: string) => void;
}) {
  const [renaming, setRenaming] = useState<AiChatSummaryOutput | null>(null);
  const [deleting, setDeleting] = useState<AiChatSummaryOutput | null>(null);
  const deleteMutation = useDeleteAiChatMutation();

  async function remove(chat: AiChatSummaryOutput) {
    try {
      await deleteMutation.mutateAsync(chat.id);
      onDeleted(chat.id);
      toast.success("Conversa apagada");
      setDeleting(null);
    } catch (error) {
      toast.error(aiChatErrorMessage(error));
    }
  }

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col gap-2">
      <Button className="w-full justify-start" onClick={onNewChat} type="button" variant="outline">
        <MessageSquarePlus aria-hidden="true" />
        Nova conversa
      </Button>
      <nav aria-label="Conversas" className="min-h-0 flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="grid gap-2" role="status" aria-label="Carregando conversas">
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
          </div>
        ) : null}
        {!isLoading && !chats.length ? (
          <p className="px-2 py-6 text-center text-muted-foreground text-xs">
            Suas conversas aparecem aqui.
          </p>
        ) : null}
        <ul className="grid grid-cols-1 gap-0.5">
          {chats.map((chat) => (
            <li className="relative min-w-0" key={chat.id}>
              <button
                aria-current={chat.id === selectedId ? "page" : undefined}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-md py-2 pr-11 pl-2 text-left outline-none hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50",
                  chat.id === selectedId && "bg-muted",
                )}
                onClick={() => onSelect(chat.id)}
                type="button"
              >
                <AiProviderMark provider={chat.provider} size={16} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm" title={chat.title}>
                    {chat.title}
                  </span>
                  <span className="block text-muted-foreground text-xs">
                    {formatChatUpdatedAt(chat.updatedAt)}
                  </span>
                </span>
              </button>
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <button
                      aria-label={`Mais ações para ${chat.title}`}
                      className="absolute top-1/2 right-1 grid size-9 -translate-y-1/2 place-items-center rounded-md text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
                      type="button"
                    />
                  }
                >
                  <Ellipsis aria-hidden="true" className="size-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-40">
                  <DropdownMenuItem onClick={() => setRenaming(chat)}>
                    <Pencil aria-hidden="true" /> Renomear
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setDeleting(chat)} variant="destructive">
                    <Trash2 aria-hidden="true" /> Apagar
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </li>
          ))}
        </ul>
      </nav>

      {renaming ? (
        <RenameChatDialog chat={renaming} key={renaming.id} onClose={() => setRenaming(null)} />
      ) : null}

      <AlertDialog
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        open={deleting !== null}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apagar esta conversa?</AlertDialogTitle>
            <AlertDialogDescription>
              “{deleting?.title}” e todas as mensagens serão apagadas do OpenMonetis.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteMutation.isPending}
              onClick={() => {
                if (deleting) void remove(deleting);
              }}
              variant="destructive"
            >
              Apagar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function RenameChatDialog({ chat, onClose }: { chat: AiChatSummaryOutput; onClose: () => void }) {
  const mutation = useRenameAiChatMutation();
  const id = useId();
  const form = useForm({
    defaultValues: { title: chat.title },
    validators: { onSubmit: UpdateAiChatInputSchema },
    onSubmitInvalid: showInvalidFormToast,
    onSubmit: async ({ value }) => {
      try {
        await mutation.mutateAsync({ id: chat.id, title: value.title });
        toast.success("Conversa renomeada");
        onClose();
      } catch (error) {
        toast.error(aiChatErrorMessage(error));
      }
    },
  });

  return (
    <Dialog
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      open
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Renomear conversa</DialogTitle>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            void form.handleSubmit();
          }}
        >
          <form.Field name="title">
            {(field) => (
              <div className="grid gap-1.5">
                <Label className="font-mono" htmlFor={id}>
                  Nome
                </Label>
                <Input
                  aria-invalid={field.state.meta.errors.length > 0}
                  autoFocus
                  id={id}
                  maxLength={aiChatTitleMaximumLength}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                  value={field.state.value}
                />
                {field.state.meta.errors.length ? (
                  <p className="text-destructive text-sm" role="alert">
                    Informe um nome.
                  </p>
                ) : null}
              </div>
            )}
          </form.Field>
          <DialogFooter>
            <Button onClick={onClose} type="button" variant="outline">
              Cancelar
            </Button>
            <form.Subscribe selector={(state) => state.isSubmitting}>
              {(isSubmitting) => (
                <Button disabled={isSubmitting} type="submit">
                  {isSubmitting ? "Salvando…" : "Salvar"}
                </Button>
              )}
            </form.Subscribe>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
