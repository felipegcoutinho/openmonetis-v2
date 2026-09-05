import { UpdateInvoiceDatesInputSchema } from "@openmonetis/validators/invoices";
import { useForm } from "@tanstack/react-form";
import { useId } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useUpdateInvoiceDatesMutation } from "../invoices.mutations";

export function InvoiceDatesDialog({
  cardId,
  cardName,
  period,
  closingDate,
  dueDate,
  open,
  onOpenChange,
}: {
  cardId: string;
  cardName: string;
  period: string;
  closingDate: string;
  dueDate: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const id = useId();
  const mutation = useUpdateInvoiceDatesMutation();
  const form = useForm({
    defaultValues: { closingDate, dueDate },
    onSubmit: async ({ value }) => {
      const parsed = UpdateInvoiceDatesInputSchema.safeParse(value);
      if (!parsed.success || parsed.data.closingDate >= parsed.data.dueDate) {
        toast.error("Revise as datas da fatura", {
          description: "O fechamento precisa acontecer antes do vencimento.",
        });
        return;
      }
      try {
        await mutation.mutateAsync({ cardId, period, input: parsed.data });
        toast.success("Datas da fatura atualizadas");
        onOpenChange(false);
      } catch {
        toast.error("Não foi possível atualizar as datas");
      }
    },
  });

  return (
    <Dialog open={open} onOpenChange={(next) => !mutation.isPending && onOpenChange(next)}>
      <DialogContent key={`${cardId}-${period}-${closingDate}-${dueDate}`}>
        <DialogHeader>
          <DialogTitle>Ajustar datas da fatura</DialogTitle>
          <DialogDescription>
            Altere somente esta fatura de {cardName}. A regra padrão do cartão será preservada.
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid w-full gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            void form.handleSubmit();
          }}
        >
          <form.Field name="closingDate">
            {(field) => (
              <div className="grid w-full gap-2">
                <Label htmlFor={`${id}-closing-date`}>Data de fechamento</Label>
                <DatePicker
                  id={`${id}-closing-date`}
                  value={field.state.value}
                  onChange={field.handleChange}
                />
              </div>
            )}
          </form.Field>
          <form.Field name="dueDate">
            {(field) => (
              <div className="grid w-full gap-2">
                <Label htmlFor={`${id}-due-date`}>Data de vencimento</Label>
                <DatePicker
                  id={`${id}-due-date`}
                  value={field.state.value}
                  onChange={field.handleChange}
                />
              </div>
            )}
          </form.Field>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={mutation.isPending}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Salvando..." : "Salvar datas"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
