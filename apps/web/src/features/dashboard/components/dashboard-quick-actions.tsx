import type { CreateNoteInput } from "@openmonetis/validators/notes";
import type { TransactionInput } from "@openmonetis/validators/transactions";
import { useQuery } from "@tanstack/react-query";
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, NotebookPen } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { accountsQueryOptions } from "@/features/accounts/accounts.queries";
import { cardsQueryOptions } from "@/features/cards/cards.queries";
import { categoriesQueryOptions } from "@/features/categories/categories.queries";
import { NoteDialog } from "@/features/notes/components/note-dialog";
import { useCreateNoteMutation } from "@/features/notes/notes.mutations";
import { peopleQueryOptions } from "@/features/people/people.queries";
import { TransactionDialog } from "@/features/transactions/components/transaction-dialog";
import { cn } from "@/lib/utils";

type TransactionAction = Extract<TransactionInput["type"], "expense" | "income" | "transfer">;

const transactionActions: Array<{
  icon: typeof ArrowDownLeft;
  iconClassName: string;
  label: string;
  shortLabel: string;
  type: TransactionAction;
}> = [
  {
    type: "income",
    label: "Nova receita",
    shortLabel: "Receita",
    icon: ArrowDownLeft,
    iconClassName: "text-success",
  },
  {
    type: "expense",
    label: "Nova despesa",
    shortLabel: "Despesa",
    icon: ArrowUpRight,
    iconClassName: "text-destructive",
  },
  {
    type: "transfer",
    label: "Nova transferência",
    shortLabel: "Transferir",
    icon: ArrowLeftRight,
    iconClassName: "text-info",
  },
];

export function DashboardQuickActions({ period }: { period: string }) {
  const [transactionAction, setTransactionAction] = useState<TransactionAction | null>(null);
  const [noteOpen, setNoteOpen] = useState(false);
  const accountsQuery = useQuery(accountsQueryOptions());
  const cardsQuery = useQuery(cardsQueryOptions());
  const categoriesQuery = useQuery(categoriesQueryOptions());
  const peopleQuery = useQuery(peopleQueryOptions());
  const createNote = useCreateNoteMutation();
  const referenceLoading =
    accountsQuery.isLoading ||
    cardsQuery.isLoading ||
    categoriesQuery.isLoading ||
    peopleQuery.isLoading;
  const referenceError =
    accountsQuery.isError || cardsQuery.isError || categoriesQuery.isError || peopleQuery.isError;

  function openTransaction(type: TransactionAction) {
    if (referenceError) {
      toast.error("Não foi possível preparar o formulário.", {
        description: "Atualize a página e tente novamente.",
      });
      return;
    }
    setTransactionAction(type);
  }

  return (
    <section
      aria-label="Ações rápidas"
      className="grid grid-cols-2 gap-1 rounded-card border bg-card/70 p-1 sm:grid-cols-4"
    >
      {transactionActions.map((action) => (
        <Button
          aria-label={action.label}
          className="h-9 justify-start gap-2 px-3 text-muted-foreground text-sm hover:bg-background hover:text-foreground sm:justify-center"
          disabled={referenceLoading}
          key={action.type}
          onClick={() => openTransaction(action.type)}
          size="sm"
          type="button"
          variant="ghost"
        >
          <action.icon aria-hidden="true" className={cn("size-4", action.iconClassName)} />
          {action.shortLabel}
        </Button>
      ))}

      <Button
        aria-label="Nova anotação"
        className="h-9 justify-start gap-2 px-3 text-muted-foreground text-sm hover:bg-background hover:text-foreground sm:justify-center"
        onClick={() => setNoteOpen(true)}
        size="sm"
        type="button"
        variant="ghost"
      >
        <NotebookPen aria-hidden="true" className="size-4 text-warning" />
        Anotação
      </Button>

      {transactionAction ? (
        <TransactionDialog
          accounts={accountsQuery.data ?? []}
          cards={cardsQuery.data ?? []}
          categories={categoriesQuery.data ?? []}
          defaultPeriod={period}
          defaultType={transactionAction}
          key={`${transactionAction}-${period}`}
          onOpenChange={(open) => {
            if (!open) setTransactionAction(null);
          }}
          open
          people={peopleQuery.data ?? []}
          transaction={null}
        />
      ) : null}

      <NoteDialog
        key={noteOpen ? "new-note-open" : "new-note-closed"}
        note={null}
        onOpenChange={setNoteOpen}
        onSubmit={async (input) => {
          await createNote.mutateAsync(input as CreateNoteInput);
          setNoteOpen(false);
        }}
        open={noteOpen}
        pending={createNote.isPending}
      />
    </section>
  );
}
