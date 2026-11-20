import { CalendarX2, Pause, Square } from "lucide-react";
import { useState } from "react";
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

type RecurringStatusAction = "pause" | "stop" | "skip";

type RecurringStatusDialogProps = {
  action: RecurringStatusAction | null;
  name: string;
  occurrenceDate: string;
  onConfirm: (action: RecurringStatusAction) => Promise<void> | void;
  onOpenChange: (open: boolean) => void;
};

const actionContent = {
  pause: {
    actionLabel: "Pausar recorrência",
    description:
      "Esta ocorrência e as próximas ficarão em pausa. As ocorrências anteriores e seus recebimentos ou pagamentos serão mantidos.",
    icon: <Pause aria-hidden="true" />,
    title: "Pausar recorrência?",
  },
  stop: {
    actionLabel: "Encerrar recorrência",
    description:
      "Esta ocorrência e as próximas deixarão de ser projetadas. As ocorrências anteriores e seus recebimentos ou pagamentos serão mantidos.",
    icon: <Square aria-hidden="true" />,
    title: "Encerrar recorrência?",
  },
  skip: {
    actionLabel: "Pular ocorrência",
    description:
      "Somente esta ocorrência será ignorada. A recorrência volta na próxima data prevista, respeitando sua data final.",
    icon: <CalendarX2 aria-hidden="true" />,
    title: "Pular esta ocorrência?",
  },
} as const;

export function RecurringStatusDialog({
  action,
  name,
  occurrenceDate,
  onConfirm,
  onOpenChange,
}: RecurringStatusDialogProps) {
  const [isPending, setIsPending] = useState(false);
  const content = action ? actionContent[action] : null;

  async function confirm() {
    if (!action) return;
    setIsPending(true);
    try {
      await onConfirm(action);
      onOpenChange(false);
    } catch {
      return;
    } finally {
      setIsPending(false);
    }
  }

  return (
    <AlertDialog onOpenChange={onOpenChange} open={Boolean(action)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia>{content?.icon}</AlertDialogMedia>
          <AlertDialogTitle>{content?.title}</AlertDialogTitle>
          <AlertDialogDescription>
            {content?.description} Recorrência: &quot;{name}&quot;. Data:{" "}
            {occurrenceDate.split("-").reverse().join("/")}.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            disabled={isPending}
            onClick={(event) => {
              event.preventDefault();
              void confirm();
            }}
            variant={action === "stop" ? "destructive" : "default"}
          >
            {isPending ? "Salvando…" : content?.actionLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
