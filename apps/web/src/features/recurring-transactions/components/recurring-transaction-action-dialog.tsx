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
import { formatRecurringExpenseDate } from "@/features/recurring-expenses/recurring-expenses.presentation";
import { useRecurringRuleActionMutation } from "@/features/transactions/transactions.mutations";
import { getTransactionMutationErrorMessage } from "@/features/transactions/transactions.presentation";

type ActionRecurrence = { id: string; purchaseDate: string; actionDate?: string | null };

type Props = {
  action: "pause" | "resume" | "skip" | "stop" | null;
  recurrence: ActionRecurrence | null;
  onOpenChange: (open: boolean) => void;
};

export function RecurringTransactionActionDialog({ action, recurrence, onOpenChange }: Props) {
  const mutation = useRecurringRuleActionMutation();
  const effectiveDate = recurrence?.actionDate ?? recurrence?.purchaseDate;
  const date = effectiveDate ? formatRecurringExpenseDate(effectiveDate) : "a próxima ocorrência";
  const content = action ? actionContent[action](date) : null;

  async function confirm() {
    if (!action || !recurrence || !effectiveDate) return;
    try {
      await mutation.mutateAsync({ action, id: recurrence.id, occurrenceDate: effectiveDate });
      toast.success(actionContent[action](date).success);
      onOpenChange(false);
    } catch (error) {
      toast.error("Não foi possível alterar a recorrência.", {
        description: getTransactionMutationErrorMessage(error),
      });
    }
  }

  return (
    <AlertDialog onOpenChange={onOpenChange} open={Boolean(action && recurrence)}>
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
            {mutation.isPending ? "Salvando…" : content?.actionLabel}
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
      "Somente esta ocorrência será ignorada. A recorrência volta automaticamente na próxima data prevista.",
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
      "A recorrência volta a ser projetada a partir desta ocorrência. O período em pausa continua preservado.",
    actionLabel: "Retomar recorrência",
    success: `Recorrência retomada em ${date}`,
  }),
  stop: (date: string) => ({
    icon: <Square />,
    title: `Encerrar a partir de ${date}?`,
    description:
      "Esta ocorrência e as seguintes deixam de ser projetadas. O histórico anterior e seus pagamentos ou recebimentos permanecem preservados.",
    actionLabel: "Encerrar recorrência",
    success: `Recorrência encerrada em ${date}`,
  }),
} as const;
