import { getCurrentDateInBrazil } from "@openmonetis/shared/date-time";
import {
  CreateBillPaymentInputSchema,
  type DashboardBill,
  type DashboardBillsOutput,
} from "@openmonetis/validators/bills";
import { useForm } from "@tanstack/react-form";
import { Image } from "@unpic/react";
import { useId, useState } from "react";
import { toast } from "sonner";
import { PaymentSuccess } from "@/components/payment-success";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EstablishmentLogo } from "@/features/establishments/components/establishment-logo";
import { usePayBillMutation } from "../bills.mutations";
import { billDueLabel } from "../bills.presentation";

type BillAccount = DashboardBillsOutput["accounts"][number];

export function BillPaymentDialog({
  accounts,
  bill,
  onOpenChange,
  open,
}: {
  accounts: DashboardBillsOutput["accounts"];
  bill: DashboardBill | null;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) {
  const id = useId();
  const payment = usePayBillMutation();
  const [paymentCompleted, setPaymentCompleted] = useState(false);
  const preferredAccount =
    accounts.find((account) => account.id === bill?.accountId) ?? accounts[0];
  const form = useForm({
    defaultValues: {
      accountId: preferredAccount?.id ?? "",
      paidAt: currentLocalDate(),
    },
    onSubmit: async ({ value }) => {
      if (!bill) return;
      const parsed = CreateBillPaymentInputSchema.safeParse({ ...value, billId: bill.id });
      if (!parsed.success) {
        toast.error("Revise os dados do pagamento", {
          description: "Selecione uma conta e uma data válidas.",
        });
        return;
      }
      try {
        await payment.mutateAsync({ period: bill.period, input: parsed.data });
        setPaymentCompleted(true);
      } catch {
        toast.error("Não foi possível registrar o pagamento", {
          description: "O boleto permanece em aberto. Tente novamente.",
        });
      }
    },
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (payment.isPending) return;
        if (!next) setPaymentCompleted(false);
        onOpenChange(next);
      }}
    >
      <DialogContent className="gap-4">
        {paymentCompleted ? (
          <PaymentSuccess
            celebrate
            description="O pagamento foi registrado. O boleto aparece como pago no histórico."
            onClose={() => {
              setPaymentCompleted(false);
              onOpenChange(false);
            }}
            title="Pagamento registrado"
          />
        ) : (
          <>
            <DialogHeader>
              <div className="flex items-center gap-3">
                {bill ? <EstablishmentLogo name={bill.name} size={40} /> : null}
                <div className="min-w-0">
                  <DialogTitle>Registrar pagamento do boleto</DialogTitle>
                  <DialogDescription className="mt-0.5">
                    {bill
                      ? `${bill.name}. Informe a conta e a data do pagamento já realizado.`
                      : "Informe os dados do pagamento já realizado."}
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            {bill ? (
              <div className="flex items-center justify-between gap-4 rounded-lg border bg-muted/35 px-4 py-3">
                <div>
                  <p className="text-muted-foreground text-xs">Valor do boleto</p>
                  <p className="mt-0.5 font-semibold text-lg">{formatCurrency(bill.amount)}</p>
                </div>
                <p className="text-right text-muted-foreground text-sm">
                  {billDueLabel(bill.dueDate)}
                </p>
              </div>
            ) : null}

            <form
              className="grid gap-4"
              onSubmit={(event) => {
                event.preventDefault();
                void form.handleSubmit();
              }}
            >
              <form.Field name="accountId">
                {(field) => (
                  <div className="grid gap-2">
                    <Label htmlFor={`${id}-account`}>Conta de pagamento</Label>
                    <Select
                      disabled={payment.isPending}
                      items={accounts.map((account) => ({
                        value: account.id,
                        label: <AccountOption account={account} />,
                      }))}
                      value={field.state.value}
                      onValueChange={(value) => value && field.handleChange(value)}
                    >
                      <SelectTrigger
                        aria-invalid={accounts.length === 0}
                        className="w-full"
                        id={`${id}-account`}
                      >
                        <SelectValue placeholder="Selecione uma conta" />
                      </SelectTrigger>
                      <SelectContent>
                        {accounts.map((account) => (
                          <SelectItem key={account.id} value={account.id}>
                            <AccountOption account={account} />
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {accounts.length === 0 ? (
                      <p className="text-destructive text-xs" role="alert">
                        Cadastre uma conta antes de registrar o pagamento.
                      </p>
                    ) : null}
                  </div>
                )}
              </form.Field>

              <form.Field name="paidAt">
                {(field) => (
                  <div className="grid gap-2">
                    <Label htmlFor={`${id}-paid-at`}>Data do pagamento</Label>
                    <DatePicker
                      aria-invalid={field.state.value > currentLocalDate()}
                      disabled={payment.isPending}
                      id={`${id}-paid-at`}
                      onChange={field.handleChange}
                      value={field.state.value}
                      max={currentLocalDate()}
                    />
                    {field.state.value > currentLocalDate() ? (
                      <p className="text-destructive text-xs" role="alert">
                        A data não pode estar no futuro.
                      </p>
                    ) : null}
                  </div>
                )}
              </form.Field>

              <DialogFooter>
                <Button
                  disabled={payment.isPending}
                  onClick={() => onOpenChange(false)}
                  type="button"
                  variant="outline"
                >
                  Cancelar
                </Button>
                <form.Subscribe selector={(state) => state.values}>
                  {(values) => (
                    <Button
                      disabled={
                        payment.isPending ||
                        !bill ||
                        !values.accountId ||
                        !values.paidAt ||
                        values.paidAt > currentLocalDate()
                      }
                      type="submit"
                    >
                      {payment.isPending ? "Registrando…" : "Registrar pagamento"}
                    </Button>
                  )}
                </form.Subscribe>
              </DialogFooter>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function AccountOption({ account }: { account: BillAccount }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      {account.logo ? (
        <Image
          alt=""
          className="size-5 rounded-full object-contain"
          height={20}
          layout="fixed"
          src={account.logo}
          width={20}
        />
      ) : (
        <span className="grid size-5 place-items-center rounded-full bg-muted font-medium text-[9px]">
          {account.name.slice(0, 2).toLocaleUpperCase("pt-BR")}
        </span>
      )}
      <span className="truncate">{account.name}</span>
    </span>
  );
}

function currentLocalDate() {
  return getCurrentDateInBrazil();
}

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
