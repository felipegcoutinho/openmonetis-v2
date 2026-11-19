import type { CreateNoteInput } from "@openmonetis/validators/notes";
import type { TransactionInput } from "@openmonetis/validators/transactions";
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  LoaderCircle,
  NotebookPen,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { NoteDialog } from "@/features/notes/components/note-dialog";
import { useCreateNoteMutation } from "@/features/notes/notes.mutations";
import { TransactionDialog } from "@/features/transactions/components/transaction-dialog";
import { useTransactionFormOptions } from "@/features/transactions/useTransactionFormOptions";
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
  const [preparingAction, setPreparingAction] = useState<TransactionAction | null>(null);
  const [noteOpen, setNoteOpen] = useState(false);
  const formOptions = useTransactionFormOptions();
  const createNote = useCreateNoteMutation();

  async function openTransaction(type: TransactionAction) {
    setPreparingAction(type);
    if (await formOptions.ensureLoaded()) setTransactionAction(type);
    setPreparingAction(null);
  }

  return (
    <section
      aria-label="Ações rápidas"
      className="grid grid-cols-4 gap-1 md:gap-0.5 md:rounded-lg md:border md:bg-card md:p-1"
    >
      {transactionActions.map((action) => (
        <Button
          aria-label={action.label}
          className={cn(
            "group/quick-action h-auto min-h-16 flex-col justify-center gap-2 rounded-lg bg-card px-1 py-3 text-foreground text-xs border-border md:h-9 md:min-h-0 md:flex-row md:rounded-md md:border-transparent md:bg-transparent md:px-3.5 md:py-0 md:text-sm hover:text-foreground sm:justify-center",
            action.hoverClassName,
          )}
          aria-busy={preparingAction === action.type}
          disabled={preparingAction !== null}
          key={action.type}
          onClick={() => void openTransaction(action.type)}
          size="sm"
          type="button"
          variant="ghost"
        >
          {preparingAction === action.type ? (
            <LoaderCircle
              aria-hidden="true"
              className="size-4 animate-spin text-muted-foreground"
            />
          ) : (
            <action.icon
              aria-hidden="true"
              className={cn(
                "size-4 transition-transform duration-200 ease-out motion-reduce:transition-none",
                action.iconClassName,
                action.iconMotionClassName,
              )}
            />
          )}
          {action.shortLabel}
        </Button>
      ))}

      <Button
        aria-label="Nova anotação"
        className="group/quick-action h-auto min-h-16 flex-col justify-center gap-2 rounded-lg bg-card px-1 py-3 text-foreground text-xs border-border md:h-9 md:min-h-0 md:flex-row md:rounded-md md:border-transparent md:bg-transparent md:px-3.5 md:py-0 md:text-sm hover:bg-warning/10 hover:text-foreground sm:justify-center"
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
          accounts={formOptions.accounts}
          cards={formOptions.cards}
          categories={formOptions.categories}
          defaultPeriod={period}
          defaultType={transactionAction}
          key={`${transactionAction}-${period}`}
          onOpenChange={(open) => {
            if (!open) setTransactionAction(null);
          }}
          open
          people={formOptions.people}
          transaction={null}
        />
      ) : null}

      <NoteDialog
        key={noteOpen ? "new-note-open" : "new-note-closed"}
        note={null}
        onOpenChange={setNoteOpen}
        onSubmit={async (input, files) => {
          const created = await createNote.mutateAsync({ input: input as CreateNoteInput, files });
          setNoteOpen(false);
          return created;
        }}
        open={noteOpen}
        pending={createNote.isPending}
      />
    </section>
  );
}
