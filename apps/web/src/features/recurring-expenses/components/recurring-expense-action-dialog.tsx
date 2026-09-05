import type { RecurringExpenseOutput } from "@openmonetis/validators/recurring-expenses";
import { CalendarX2, Pause, Play, Square } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useRecurringExpenseStateMutation } from "../recurring-expenses.mutations";
import { formatRecurringExpenseDate } from "../recurring-expenses.presentation";

type ActionExpense = RecurringExpenseOutput & { actionDate?: string | null };

type Props = {
  action: "pause" | "resume" | "skip" | "stop" | null;
  expense: ActionExpense | null;
  onOpenChange: (open: boolean) => void;
};

export function RecurringExpenseActionDialog({ action, expense, onOpenChange }: Props) {
  const mutation = useRecurringExpenseStateMutation();
  const effectiveDate = expense?.actionDate ?? expense?.purchaseDate;
  const date = effectiveDate ? formatRecurringExpenseDate(effectiveDate) : "a próxima ocorrência";
  const content = action ? actionContent[action](date) : null;

  async function confirm() {
    if (!action || !expense || !effectiveDate) return;
    try {
      await mutation.mutateAsync({ action, id: expense.id, purchaseDate: effectiveDate });
      toast.success(actionContent[action](date).success);
      onOpenChange(false);
    } catch {
      toast.error("Não foi possível alterar a recorrência.");
    }
  }

  return (
    <AlertDialog onOpenChange={onOpenChange} open={Boolean(action && expense)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia>{content?.icon}</AlertDialogMedia>
          <AlertDialogTitle>{content?.title}</AlertDialogTitle>
          <AlertDialogDescription>{content?.description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={mutation.isPending}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            disabled={mutation.isPending}
            onClick={(event) => {
              event.preventDefault();
              void confirm();
            }}
            variant={action === "stop" ? "destructive" : "default"}
          >
            {mutation.isPending ? "Salvando..." : content?.actionLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

const actionContent = {
  skip: (date: string) => ({
    icon: <CalendarX2 />,
    title: `Pular ${date}?`,
    description:
      "Somente esta ocorrência será ignorada. A despesa volta automaticamente na próxima data prevista.",
    actionLabel: "Pular lançamento",
    success: `Ocorrência de ${date} ignorada`,
  }),
  pause: (date: string) => ({
    icon: <Pause />,
    title: `Pausar a partir de ${date}?`,
    description:
      "As ocorrências anteriores permanecem no histórico. Nenhuma nova ocorrência será projetada até a retomada.",
    actionLabel: "Pausar recorrência",
    success: `Recorrência pausada em ${date}`,
  }),
  resume: (date: string) => ({
    icon: <Play />,
    title: `Retomar em ${date}?`,
    description:
      "A despesa volta a ser projetada a partir desta ocorrência. O período em pausa continua preservado.",
    actionLabel: "Retomar recorrência",
    success: `Recorrência retomada em ${date}`,
  }),
  stop: (date: string) => ({
    icon: <Square />,
    title: `Parar em ${date}?`,
    description:
      "Esta ocorrência e todas as seguintes deixam de existir. Os meses anteriores permanecem no histórico.",
    actionLabel: "Parar recorrência",
    success: `Recorrência encerrada em ${date}`,
  }),
} as const;
