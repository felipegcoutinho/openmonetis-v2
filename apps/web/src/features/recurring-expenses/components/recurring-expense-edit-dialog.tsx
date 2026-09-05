import type {
  RecurringExpenseOutput,
  UpdateRecurringExpenseInput,
} from "@openmonetis/validators/recurring-expenses";
import { UpdateRecurringExpenseInputSchema } from "@openmonetis/validators/recurring-expenses";
import { useForm } from "@tanstack/react-form";
import { CalendarRange } from "lucide-react";
import { useId, useState } from "react";
import { toast } from "sonner";
import { MoneyValue } from "@/components/money-value";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { CurrencyInput } from "@/components/ui/currency-input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUpdateRecurringExpenseMutation } from "../recurring-expenses.mutations";
import { formatRecurringExpenseDate } from "../recurring-expenses.presentation";

type EditableExpense = RecurringExpenseOutput & { actionDate?: string | null };

type Props = {
  expense: EditableExpense;
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

export function RecurringExpenseEditDialog({ expense, onOpenChange, open }: Props) {
  const id = useId();
  const [confirming, setConfirming] = useState(false);
  const [draft, setDraft] = useState<Omit<UpdateRecurringExpenseInput, "scope"> | null>(null);
  const mutation = useUpdateRecurringExpenseMutation();
  const effectiveDate = expense.actionDate ?? expense.purchaseDate;
  const date = formatRecurringExpenseDate(effectiveDate);
  const isDivided = expense.splitPeople.length > 1;
  const form = useForm({
    defaultValues: {
      name: expense.name,
      amount: (isDivided ? expense.totalAmount : expense.amount).toFixed(2),
      splitShares: expense.splitPeople.map((person) => ({
        personId: person.id,
        name: person.name,
        avatarUrl: person.avatarUrl,
        amount: person.amount.toFixed(2),
      })),
    },
    onSubmit: ({ value }) => {
      const splitShares = isDivided
        ? value.splitShares.map((share) => ({
            personId: share.personId,
            amount: Number(share.amount),
          }))
        : undefined;
      const totalAmount = splitShares
        ? splitShares.reduce((total, share) => total + share.amount, 0)
        : Number(value.amount);
      const parsed = UpdateRecurringExpenseInputSchema.omit({ scope: true }).safeParse({
        name: value.name,
        amount: Math.round(totalAmount * 100) / 100,
        splitShares,
      });
      if (!parsed.success) {
        toast.error("Revise o nome e os valores da divisão.");
        return;
      }
      setDraft(parsed.data);
      setConfirming(true);
    },
  });

  async function save(scope: "single" | "future") {
    if (!draft) return;
    try {
      await mutation.mutateAsync({
        id: expense.id,
        purchaseDate: effectiveDate,
        input: { ...draft, scope },
      });
      toast.success(
        scope === "single"
          ? `Alteração aplicada somente em ${date}`
          : `Alteração aplicada desde ${date}`,
      );
      setConfirming(false);
      onOpenChange(false);
    } catch {
      toast.error("Não foi possível alterar a despesa recorrente.");
    }
  }

  return (
    <>
      <Dialog onOpenChange={onOpenChange} open={open}>
        <DialogContent className="max-h-[90svh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Alterar despesa recorrente</DialogTitle>
            <DialogDescription>
              {isDivided
                ? `Edite o nome ou o valor de cada pessoa para ${date}.`
                : `Edite o nome ou o valor previsto para ${date}.`}
            </DialogDescription>
          </DialogHeader>
          <form
            className="grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              void form.handleSubmit();
            }}
          >
            <form.Field name="name">
              {(field) => (
                <div className="grid gap-2">
                  <Label htmlFor={`${id}-name`}>Descrição</Label>
                  <Input
                    id={`${id}-name`}
                    maxLength={160}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                    value={field.state.value}
                  />
                </div>
              )}
            </form.Field>
            {isDivided ? (
              <form.Field name="splitShares">
                {(field) => (
                  <div className="grid gap-3">
                    <div>
                      <p className="font-medium text-sm">Divisão entre pessoas</p>
                      <p className="mt-1 text-muted-foreground text-xs">
                        O total é recalculado pela soma das parcelas.
                      </p>
                    </div>
                    <div className="grid gap-2">
                      {field.state.value.map((share, index) => (
                        <div
                          className="grid items-center gap-3 rounded-lg border bg-muted/20 p-3 sm:grid-cols-[minmax(0,1fr)_9rem]"
                          key={share.personId}
                        >
                          <div className="flex min-w-0 items-center gap-2.5">
                            <Avatar size="sm">
                              <AvatarImage
                                alt={`Avatar de ${share.name}`}
                                src={share.avatarUrl ?? undefined}
                              />
                              <AvatarFallback>{share.name.slice(0, 1)}</AvatarFallback>
                            </Avatar>
                            <span className="truncate text-sm">{share.name}</span>
                          </div>
                          <CurrencyInput
                            aria-label={`Valor de ${share.name}`}
                            onBlur={field.handleBlur}
                            onValueChange={(amount) =>
                              field.handleChange(
                                field.state.value.map((item, itemIndex) =>
                                  itemIndex === index ? { ...item, amount } : item,
                                ),
                              )
                            }
                            value={share.amount}
                          />
                        </div>
                      ))}
                    </div>
                    <form.Subscribe selector={(state) => state.values.splitShares}>
                      {(shares) => (
                        <div className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2 text-sm">
                          <span className="text-muted-foreground">Valor total</span>
                          <MoneyValue
                            amount={
                              Math.round(
                                shares.reduce(
                                  (total, share) => total + (Number(share.amount) || 0),
                                  0,
                                ) * 100,
                              ) / 100
                            }
                            className="font-semibold"
                          />
                        </div>
                      )}
                    </form.Subscribe>
                  </div>
                )}
              </form.Field>
            ) : (
              <form.Field name="amount">
                {(field) => (
                  <div className="grid gap-2">
                    <Label htmlFor={`${id}-amount`}>Valor</Label>
                    <CurrencyInput
                      id={`${id}-amount`}
                      onBlur={field.handleBlur}
                      onValueChange={field.handleChange}
                      value={field.state.value}
                    />
                  </div>
                )}
              </form.Field>
            )}
            <DialogFooter>
              <Button onClick={() => onOpenChange(false)} type="button" variant="outline">
                Cancelar
              </Button>
              <Button type="submit">Continuar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <AlertDialog onOpenChange={setConfirming} open={confirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia>
              <CalendarRange />
            </AlertDialogMedia>
            <AlertDialogTitle>Por quanto tempo vale a alteração?</AlertDialogTitle>
            <AlertDialogDescription>
              Escolha como a alteração deve ser aplicada à recorrência.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="grid-cols-1">
            <AlertDialogAction
              className="h-auto flex-col items-start gap-1.5 whitespace-normal p-4 text-left"
              disabled={mutation.isPending}
              onClick={(event) => {
                event.preventDefault();
                void save("single");
              }}
              variant="outline"
            >
              <span>Somente este lançamento</span>
              <span className="font-normal text-muted-foreground text-xs">
                Aplica os novos valores apenas em {date}. A divisão atual volta na próxima
                ocorrência.
              </span>
            </AlertDialogAction>
            <AlertDialogAction
              className="h-auto flex-col items-start gap-1.5 whitespace-normal p-4 text-left"
              disabled={mutation.isPending}
              onClick={(event) => {
                event.preventDefault();
                void save("future");
              }}
              variant="outline"
            >
              <span>Este e os próximos</span>
              <span className="font-normal text-muted-foreground text-xs">
                Aplica os novos valores desde {date} e mantém a alteração nas próximas ocorrências.
              </span>
            </AlertDialogAction>
            <AlertDialogCancel disabled={mutation.isPending}>Voltar</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
