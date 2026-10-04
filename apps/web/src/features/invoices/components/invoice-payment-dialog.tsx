import { getCurrentDateInBrazil } from "@openmonetis/shared/date-time";
import {
  CreateInvoicePaymentInputSchema,
  type DashboardInvoice,
  type DashboardInvoicesOutput,
} from "@openmonetis/validators/invoices";
import { useForm } from "@tanstack/react-form";
import { Image } from "@unpic/react";
import { useId, useState } from "react";
import { toast } from "sonner";
import { MobileDatePicker as DatePicker } from "@/components/forms/mobile-date-picker";
import { MobileFormContent as DialogContent } from "@/components/forms/mobile-form-content";
import { MobileFormDialog as Dialog } from "@/components/forms/mobile-form-dialog";
import { MobileFormState } from "@/components/forms/mobile-form-state";
import { MobileSelect as Select } from "@/components/forms/mobile-select";
import { MobileSelectContent as SelectContent } from "@/components/forms/mobile-select-content";
import { PaymentSuccess } from "@/components/payment-success";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { CurrencyInput } from "@/components/ui/currency-input";
import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { parseCurrencyInput } from "@/features/accounts/accounts.presentation";
import { usePayInvoiceMutation } from "../invoices.mutations";

type InvoiceAccount = DashboardInvoicesOutput["accounts"][number];

export function InvoicePaymentDialog({
  invoice,
  accounts,
  open,
  onOpenChange,
}: {
  invoice: DashboardInvoice | null;
  accounts: DashboardInvoicesOutput["accounts"];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const id = useId();
  const mutation = usePayInvoiceMutation();
  const [paymentResult, setPaymentResult] = useState<{
    accountAmount: number;
    status: DashboardInvoice["status"];
  } | null>(null);
  const today = getCurrentDateInBrazil();
  const canPayByPerson =
    (invoice?.people.filter((person) => person.remainingAmount > 0).length ?? 0) > 1;
  const defaultAccountId =
    invoice && accounts.some((account) => account.id === invoice.accountId)
      ? invoice.accountId
      : (accounts[0]?.id ?? "");
  const form = useForm({
    defaultValues: {
      mode: "invoice" as "invoice" | "person" | "manual",
      accountId: defaultAccountId,
      personId: invoice?.people.find((person) => person.remainingAmount > 0)?.personId ?? "",
      amount: "",
      paidAt: today,
    },
    onSubmit: async ({ value }) => {
      if (!invoice) return;
      const person = invoice.people.find((item) => item.personId === value.personId);
      const allocations =
        value.mode === "invoice"
          ? invoice.people
              .filter((item) => item.remainingAmount > 0)
              .map((item) => ({ personId: item.personId, amount: item.remainingAmount }))
          : person
            ? [
                {
                  personId: person.personId,
                  amount:
                    value.mode === "person"
                      ? person.remainingAmount
                      : parseCurrencyInput(value.amount),
                },
              ]
            : [];
      const usesAccount = allocations.some((allocation) =>
        invoice.people.some(
          (item) => item.personId === allocation.personId && item.personRole === "admin",
        ),
      );
      const parsed = CreateInvoicePaymentInputSchema.safeParse({
        accountId: usesAccount ? value.accountId : null,
        paidAt: value.paidAt,
        allocations,
      });
      if (!parsed.success) {
        toast.error("Revise os dados do pagamento", {
          description: usesAccount
            ? "Informe uma conta, pessoa e valor válidos."
            : "Informe uma pessoa e um valor válidos.",
        });
        return;
      }
      try {
        const result = await mutation.mutateAsync({
          cardId: invoice.cardId,
          period: invoice.period,
          input: parsed.data,
        });
        setPaymentResult({ accountAmount: result.accountAmount, status: result.status });
      } catch {
        toast.error("Não foi possível registrar o pagamento", {
          description: "Confira o valor e o saldo restante da pessoa.",
        });
      }
    },
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (mutation.isPending) return;
        if (!next) setPaymentResult(null);
        onOpenChange(next);
      }}
    >
      <DialogContent guarded className="gap-4 overflow-x-hidden" key={invoice?.cardId}>
        {paymentResult ? (
          <PaymentSuccess
            celebrate={paymentResult.status === "paid"}
            description={
              paymentResult.accountAmount > 0
                ? paymentResult.status === "paid"
                  ? "A fatura foi quitada e a sua parte já foi registrada no extrato."
                  : "A sua parte foi registrada no extrato. A fatura continua com saldo em aberto."
                : paymentResult.status === "paid"
                  ? "A fatura foi quitada sem movimentar suas contas."
                  : "A parte da pessoa foi quitada sem movimentar suas contas."
            }
            onClose={() => {
              setPaymentResult(null);
              onOpenChange(false);
            }}
            title={paymentResult.status === "paid" ? "Fatura paga!" : "Pagamento registrado!"}
          />
        ) : (
          <>
            <DialogHeader>
              <div className="flex items-center gap-3">
                {invoice?.logo ? (
                  <Image
                    alt=""
                    className="size-10 rounded-full object-contain"
                    height={40}
                    layout="fixed"
                    src={invoice.logo}
                    width={40}
                  />
                ) : null}
                <DialogTitle>Registrar pagamento da fatura</DialogTitle>
              </div>
              <DialogDescription>
                {invoice
                  ? `${invoice.cardName} · saldo de ${formatCurrency(invoice.remainingAmount)}`
                  : "Escolha como deseja pagar."}
              </DialogDescription>
            </DialogHeader>
            <form
              data-mobile-page-form
              className="grid w-full gap-4"
              onSubmit={(event) => {
                event.preventDefault();
                void form.handleSubmit();
              }}
            >
              <form.Subscribe
                selector={(state) => ({
                  isDirty: !state.isDefaultValue,
                  isSubmitting: state.isSubmitting,
                })}
              >
                {(state) => <MobileFormState {...state} />}
              </form.Subscribe>
              <form.Field name="mode">
                {(field) => (
                  <Tabs
                    aria-label="Forma de pagamento da fatura"
                    className="min-w-0 gap-0"
                    onValueChange={(value) =>
                      value && field.handleChange(value as typeof field.state.value)
                    }
                    value={field.state.value}
                  >
                    <TabsList
                      className="min-h-11 min-w-0 items-stretch group-data-horizontal/tabs:h-auto"
                      variant="line"
                    >
                      <TabsTrigger
                        className="min-w-0 whitespace-normal px-1 py-2 text-center text-xs leading-tight group-data-[variant=line]/tabs-list:h-auto group-data-[variant=line]/tabs-list:flex-1 sm:px-3 sm:text-sm"
                        value="invoice"
                      >
                        Fatura inteira
                      </TabsTrigger>
                      {canPayByPerson ? (
                        <TabsTrigger
                          className="min-w-0 whitespace-normal px-1 py-2 text-center text-xs leading-tight group-data-[variant=line]/tabs-list:h-auto group-data-[variant=line]/tabs-list:flex-1 sm:px-3 sm:text-sm"
                          value="person"
                        >
                          Registrar parte da pessoa
                        </TabsTrigger>
                      ) : null}
                      <TabsTrigger
                        className="min-w-0 whitespace-normal px-1 py-2 text-center text-xs leading-tight group-data-[variant=line]/tabs-list:h-auto group-data-[variant=line]/tabs-list:flex-1 sm:px-3 sm:text-sm"
                        value="manual"
                      >
                        Valor parcial
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                )}
              </form.Field>
              <form.Subscribe selector={(state) => state.values.mode}>
                {(mode) =>
                  mode !== "invoice" ? (
                    <form.Field name="personId">
                      {(field) => (
                        <div className="grid gap-2">
                          <Label htmlFor={`${id}-person`}>Pessoa</Label>
                          <Select
                            items={
                              invoice?.people
                                .filter((person) => person.remainingAmount > 0)
                                .map((person) => ({
                                  value: person.personId,
                                  label: <PersonOption person={person} />,
                                })) ?? []
                            }
                            onValueChange={(value) => value && field.handleChange(value)}
                            value={field.state.value}
                          >
                            <SelectTrigger className="w-full" id={`${id}-person`}>
                              <SelectValue placeholder="Selecione" />
                            </SelectTrigger>
                            <SelectContent>
                              {invoice?.people
                                .filter((person) => person.remainingAmount > 0)
                                .map((person) => (
                                  <SelectItem key={person.personId} value={person.personId}>
                                    <PersonOption person={person} />
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </form.Field>
                  ) : null
                }
              </form.Subscribe>
              <form.Subscribe selector={(state) => state.values.mode}>
                {(mode) =>
                  mode === "manual" ? (
                    <form.Field name="amount">
                      {(field) => (
                        <div className="grid gap-2">
                          <Label htmlFor={`${id}-amount`}>Valor</Label>
                          <CurrencyInput
                            id={`${id}-amount`}
                            onValueChange={field.handleChange}
                            placeholder="R$ 0,00"
                            value={field.state.value}
                          />
                        </div>
                      )}
                    </form.Field>
                  ) : null
                }
              </form.Subscribe>
              <form.Subscribe
                selector={(state) => [state.values.mode, state.values.personId] as const}
              >
                {([mode, personId]) =>
                  paymentUsesAccount(invoice, mode, personId) ? (
                    <form.Field name="accountId">
                      {(field) => (
                        <div className="grid gap-2">
                          <Label htmlFor={`${id}-account`}>Conta de pagamento</Label>
                          <Select
                            items={accounts.map((account) => ({
                              value: account.id,
                              label: <AccountOption account={account} />,
                            }))}
                            value={field.state.value}
                            onValueChange={(value) => value && field.handleChange(value)}
                          >
                            <SelectTrigger className="w-full" id={`${id}-account`}>
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
                        </div>
                      )}
                    </form.Field>
                  ) : (
                    <p className="rounded-md bg-muted px-3 py-2 text-muted-foreground text-sm">
                      Este pagamento quita somente a parte da pessoa e não movimenta suas contas.
                    </p>
                  )
                }
              </form.Subscribe>
              <form.Field name="paidAt">
                {(field) => (
                  <div className="grid gap-2">
                    <Label htmlFor={`${id}-paid-at`}>Data do pagamento</Label>
                    <DatePicker
                      id={`${id}-paid-at`}
                      max={today}
                      onChange={field.handleChange}
                      value={field.state.value}
                    />
                  </div>
                )}
              </form.Field>
              <DialogFooter>
                <Button
                  data-mobile-cancel
                  disabled={mutation.isPending}
                  onClick={() => onOpenChange(false)}
                  type="button"
                  variant="outline"
                >
                  Cancelar
                </Button>
                <form.Subscribe
                  selector={(state) =>
                    [state.values.mode, state.values.personId, state.values.accountId] as const
                  }
                >
                  {([mode, personId, accountId]) => (
                    <Button
                      disabled={
                        mutation.isPending ||
                        !invoice ||
                        (paymentUsesAccount(invoice, mode, personId) && !accountId)
                      }
                      type="submit"
                    >
                      {mutation.isPending ? "Registrando…" : "Confirmar pagamento"}
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

function paymentUsesAccount(
  invoice: DashboardInvoice | null,
  mode: "invoice" | "person" | "manual",
  personId: string,
) {
  if (!invoice) return false;
  if (mode === "invoice") {
    return invoice.people.some(
      (person) => person.personRole === "admin" && person.remainingAmount > 0,
    );
  }
  return invoice.people.some(
    (person) => person.personId === personId && person.personRole === "admin",
  );
}

function PersonOption({ person }: { person: DashboardInvoice["people"][number] }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <Avatar className="size-6 shrink-0">
        <AvatarImage alt="" src={person.personAvatarUrl ?? undefined} />
        <AvatarFallback className="text-[10px]">{person.personName.slice(0, 1)}</AvatarFallback>
      </Avatar>
      <span className="truncate">
        {person.personName} · {formatCurrency(person.remainingAmount)}
      </span>
    </span>
  );
}

function AccountOption({ account }: { account: InvoiceAccount }) {
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

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
