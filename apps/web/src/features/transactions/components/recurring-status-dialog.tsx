import { Pause, Trash2 } from "lucide-react";
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

type RecurringStatusAction = "pause" | "cancel";

type RecurringStatusDialogProps = {
  action: RecurringStatusAction | null;
  name: string;
  onConfirm: (action: RecurringStatusAction) => Promise<void> | void;
  onOpenChange: (open: boolean) => void;
};

const actionContent = {
  pause: {
    actionLabel: "Pausar recorrência",
    description:
      "Os lançamentos já registrados serão mantidos, e novas ocorrências deixarão de ser geradas até você retomar a recorrência.",
    icon: <Pause aria-hidden="true" />,
    title: "Pausar recorrência?",
  },
  cancel: {
    actionLabel: "Encerrar recorrência",
    description:
      "Os lançamentos já registrados serão mantidos, mas nenhuma nova ocorrência será gerada. Esta ação não pode ser desfeita.",
    icon: <Trash2 aria-hidden="true" />,
    title: "Encerrar recorrência?",
  },
} as const;

export function RecurringStatusDialog({
  action,
  name,
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
            {content?.description} Recorrência: &quot;{name}&quot;.
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
            variant={action === "cancel" ? "destructive" : "default"}
          >
            {isPending ? "Salvando..." : content?.actionLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
