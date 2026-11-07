import {
  CreatePersonReportDeliveryInputSchema,
  maximumPersonReportMessageLength,
} from "@openmonetis/validators/person-reports";
import { useForm } from "@tanstack/react-form";
import { Mail } from "lucide-react";
import { useId, useState } from "react";
import { toast } from "sonner";
import { MobileFormContent as DialogContent } from "@/components/forms/mobile-form-content";
import { MobileFormDialog as Dialog } from "@/components/forms/mobile-form-dialog";
import { MobileFormState } from "@/components/forms/mobile-form-state";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatPeriod } from "@/lib/period-presentation";
import { useSendPersonReportMutation } from "../person-reports.mutations";
import { getPersonReportDeliveryErrorMessage } from "../person-reports.presentation";

type Props = {
  onOpenChange: (open: boolean) => void;
  open: boolean;
  period: string;
  person: { id: string; name: string; email: string };
};

export function PersonReportDeliveryDialog({ onOpenChange, open, period, person }: Props) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent guarded mobileLayout="sheet" className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Enviar extrato por e-mail</DialogTitle>
          <DialogDescription>
            {person.name} recebe o extrato de {formatPeriod(period).toLocaleLowerCase("pt-BR")} em{" "}
            <span className="font-medium text-foreground">{person.email}</span>. As respostas vão
            para o seu e-mail.
          </DialogDescription>
        </DialogHeader>
        <PersonReportDeliveryForm
          key={`${person.id}:${period}:${open ? "open" : "closed"}`}
          onCancel={() => onOpenChange(false)}
          onSent={() => onOpenChange(false)}
          period={period}
          person={person}
        />
      </DialogContent>
    </Dialog>
  );
}

function PersonReportDeliveryForm({
  onCancel,
  onSent,
  period,
  person,
}: Omit<Props, "onOpenChange" | "open"> & { onCancel: () => void; onSent: () => void }) {
  const id = useId();
  const [error, setError] = useState<string | null>(null);
  const sendReport = useSendPersonReportMutation(person.id);
  const form = useForm({
    defaultValues: { message: "", includeSpreadsheet: false },
    onSubmit: async ({ value }) => {
      setError(null);
      const parsed = CreatePersonReportDeliveryInputSchema.safeParse({
        period,
        message: value.message.trim() || null,
        includeSpreadsheet: value.includeSpreadsheet,
      });
      if (!parsed.success) {
        setError(`A mensagem pode ter até ${maximumPersonReportMessageLength} caracteres.`);
        return;
      }
      try {
        await sendReport.mutateAsync(parsed.data);
        toast.success(`Extrato enviado para ${person.name}`);
        onSent();
      } catch (sendError) {
        setError(getPersonReportDeliveryErrorMessage(sendError));
      }
    },
  });

  return (
    <form
      data-mobile-page-form
      className="grid gap-4"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <form.Subscribe
        selector={(state) => ({ isDirty: !state.isDefaultValue, isSubmitting: state.isSubmitting })}
      >
        {(state) => <MobileFormState {...state} />}
      </form.Subscribe>
      <form.Field name="message">
        {(field) => (
          <div className="grid gap-1.5">
            <Label className="font-mono" htmlFor={`${id}-message`}>
              Mensagem (opcional)
            </Label>
            <Textarea
              aria-describedby={`${id}-message-count`}
              id={`${id}-message`}
              maxLength={maximumPersonReportMessageLength}
              onChange={(event) => field.handleChange(event.target.value)}
              placeholder="Ex.: Oi! Segue o resumo do mês."
              value={field.state.value}
            />
            <p className="text-right text-muted-foreground text-xs" id={`${id}-message-count`}>
              {field.state.value.length}/{maximumPersonReportMessageLength}
            </p>
          </div>
        )}
      </form.Field>
      <form.Field name="includeSpreadsheet">
        {(field) => (
          <div className="flex items-start gap-3 rounded-lg border p-3">
            <Checkbox
              checked={field.state.value}
              id={`${id}-spreadsheet`}
              onCheckedChange={(checked) => field.handleChange(checked === true)}
            />
            <Label className="grid cursor-pointer gap-0.5" htmlFor={`${id}-spreadsheet`}>
              <span className="font-medium text-sm">Anexar planilha (.xlsx)</span>
              <span className="font-normal text-muted-foreground text-xs">
                Com os mesmos lançamentos do extrato, sem contas nem observações.
              </span>
            </Label>
          </div>
        )}
      </form.Field>
      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}
      <DialogFooter>
        <Button data-mobile-cancel onClick={onCancel} type="button" variant="outline">
          Cancelar
        </Button>
        <form.Subscribe selector={(state) => state.isSubmitting}>
          {(isSubmitting) => (
            <Button disabled={isSubmitting} type="submit">
              <Mail aria-hidden="true" />
              {isSubmitting ? "Enviando…" : "Enviar extrato"}
            </Button>
          )}
        </form.Subscribe>
      </DialogFooter>
    </form>
  );
}
