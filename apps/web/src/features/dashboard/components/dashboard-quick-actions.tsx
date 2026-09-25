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
  hoverClassName: string;
  icon: typeof ArrowDownLeft;
  iconClassName: string;
  iconMotionClassName: string;
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
    hoverClassName: "hover:bg-success/10",
    iconMotionClassName:
      "group-hover/quick-action:-translate-x-0.5 group-hover/quick-action:translate-y-0.5 group-focus-visible/quick-action:-translate-x-0.5 group-focus-visible/quick-action:translate-y-0.5",
  },
  {
    type: "expense",
    label: "Nova despesa",
    shortLabel: "Despesa",
    icon: ArrowUpRight,
    iconClassName: "text-destructive",
    hoverClassName: "hover:bg-destructive/10",
    iconMotionClassName:
      "group-hover/quick-action:translate-x-0.5 group-hover/quick-action:-translate-y-0.5 group-focus-visible/quick-action:translate-x-0.5 group-focus-visible/quick-action:-translate-y-0.5",
  },
  {
    type: "transfer",
    label: "Nova transferência",
    shortLabel: "Transferir",
    icon: ArrowLeftRight,
    iconClassName: "text-info",
    hoverClassName: "hover:bg-info/10",
    iconMotionClassName:
      "group-hover/quick-action:scale-x-110 group-focus-visible/quick-action:scale-x-110",
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
      className="grid grid-cols-4 gap-1 md:gap-0.5 md:rounded-card md:border md:bg-card/75 md:p-1 md:shadow-xs md:backdrop-blur-sm"
    >
      {transactionActions.map((action) => (
        <Button
          aria-label={action.label}
          className={cn(
            "group/quick-action h-auto min-h-16 flex-col justify-center gap-2 rounded-lg bg-muted/40 px-1 py-3 text-foreground text-xs md:h-10 md:min-h-0 md:flex-row md:bg-transparent md:px-3 md:py-0 md:text-sm hover:text-foreground sm:justify-center",
            action.hoverClassName,
          )}
          disabled={referenceLoading}
          key={action.type}
          onClick={() => openTransaction(action.type)}
          size="sm"
          type="button"
          variant="ghost"
        >
          <action.icon
            aria-hidden="true"
            className={cn(
              "size-4 transition-transform duration-200 ease-out motion-reduce:transition-none",
              action.iconClassName,
              action.iconMotionClassName,
            )}
          />
          {action.shortLabel}
        </Button>
      ))}

      <Button
        aria-label="Nova anotação"
        className="group/quick-action h-auto min-h-16 flex-col justify-center gap-2 rounded-lg bg-muted/40 px-1 py-3 text-foreground text-xs md:h-10 md:min-h-0 md:flex-row md:bg-transparent md:px-3 md:py-0 md:text-sm hover:bg-warning/10 hover:text-foreground sm:justify-center"
        onClick={() => setNoteOpen(true)}
        size="sm"
        type="button"
        variant="ghost"
      >
        <NotebookPen
          aria-hidden="true"
          className="size-4 text-warning transition-transform duration-200 ease-out group-hover/quick-action:-translate-y-0.5 group-hover/quick-action:-rotate-6 group-focus-visible/quick-action:-translate-y-0.5 group-focus-visible/quick-action:-rotate-6 motion-reduce:transition-none"
        />
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
