import type { AccountOutput } from "@openmonetis/validators/accounts";
import {
  type CreateGoalInput,
  CreateGoalInputSchema,
  type GoalOutput,
  type UpdateGoalInput,
  UpdateGoalInputSchema,
} from "@openmonetis/validators/goals";
import { useForm } from "@tanstack/react-form";
import { Link } from "@tanstack/react-router";
import { Landmark, PencilLine } from "lucide-react";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { CurrencyInput } from "@/components/ui/currency-input";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { showInvalidFormToast } from "@/lib/form-feedback";
import { GoalAccountLogo } from "./goal-account-logo";

type GoalDialogProps = {
  goal: GoalOutput | null;
  accounts: AccountOutput[];
  accountsLoading: boolean;
  accountsError: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: CreateGoalInput | UpdateGoalInput) => Promise<void>;
};

export function GoalDialog({
  goal,
  accounts,
  accountsLoading,
  accountsError,
  open,
  onOpenChange,
  onSubmit,
}: GoalDialogProps) {
  const id = useId();
  const [submitError, setSubmitError] = useState(false);
  const form = useForm({
    defaultValues: {
      name: goal?.name ?? "",
      targetAmount: goal ? String(goal.targetAmount) : "",
      currentAmount: goal?.trackingType === "manual" ? String(goal.currentAmount) : "",
      targetDate: goal?.targetDate ?? "",
      trackingType: goal?.trackingType ?? "manual",
      accountId: goal?.accountId ?? "",
    },
    onSubmitInvalid: showInvalidFormToast,
    onSubmit: async ({ value }) => {
      setSubmitError(false);
      const common = {
        name: value.name,
        targetAmount: Number(value.targetAmount),
        targetDate: value.targetDate || null,
      };
      const parsed = goal
        ? UpdateGoalInputSchema.safeParse({
            ...common,
            ...(goal.trackingType === "manual"
              ? { currentAmount: Number(value.currentAmount) }
              : {}),
          })
        : CreateGoalInputSchema.safeParse(
            value.trackingType === "account"
              ? { ...common, trackingType: "account", accountId: value.accountId }
              : {
                  ...common,
                  trackingType: "manual",
                  currentAmount: Number(value.currentAmount || 0),
                },
          );
      if (!parsed.success) {
        showInvalidFormToast();
        return;
      }
      try {
        await onSubmit(parsed.data);
        onOpenChange(false);
      } catch {
        setSubmitError(true);
      }
    },
  });

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{goal ? "Editar meta" : "Nova meta"}</DialogTitle>
          <DialogDescription>
            {goal
              ? "Atualize o objetivo e o valor economizado."
              : "Defina um objetivo e escolha como acompanhar o progresso."}
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            void form.handleSubmit();
          }}
        >
          <form.Field
            name="name"
            validators={{
              onBlur: ({ value }) =>
                CreateGoalInputSchema.options[0].shape.name.safeParse(value).success
                  ? undefined
                  : "Informe um nome para a meta.",
            }}
          >
            {(field) => (
              <div className="grid gap-1.5">
                <Label htmlFor={`${id}-name`}>Nome</Label>
                <Input
                  id={`${id}-name`}
                  maxLength={120}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                  placeholder="Ex.: Reserva de emergência"
                  value={field.state.value}
                  aria-invalid={field.state.meta.errors.length > 0}
                />
                {field.state.meta.errors[0] ? (
                  <p className="text-destructive text-xs" role="alert">
                    {field.state.meta.errors[0]}
                  </p>
                ) : null}
              </div>
            )}
          </form.Field>
          <form.Field
            name="targetAmount"
            validators={{
              onBlur: ({ value }) =>
                CreateGoalInputSchema.options[0].shape.targetAmount.safeParse(Number(value)).success
                  ? undefined
                  : "Informe um valor maior que zero.",
            }}
          >
            {(field) => (
              <div className="grid gap-1.5">
                <Label htmlFor={`${id}-target`}>Valor alvo</Label>
                <CurrencyInput
                  id={`${id}-target`}
                  onBlur={field.handleBlur}
                  onValueChange={field.handleChange}
                  placeholder="R$ 0,00"
                  value={field.state.value}
                  aria-invalid={field.state.meta.errors.length > 0}
                />
                {field.state.meta.errors[0] ? (
                  <p className="text-destructive text-xs" role="alert">
                    {field.state.meta.errors[0]}
                  </p>
                ) : null}
              </div>
            )}
          </form.Field>
          {goal ? (
            <div className="grid gap-1.5">
              <Label htmlFor={`${id}-tracking-output`}>Tipo de acompanhamento</Label>
              <p
                className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm"
                id={`${id}-tracking-output`}
              >
                {goal.trackingType === "manual" ? (
                  <>
                    <PencilLine aria-hidden="true" className="size-4 text-muted-foreground" />{" "}
                    Acompanhamento manual
                  </>
                ) : (
                  <>
                    <GoalAccountLogo logo={goal.accountLogo} name={goal.accountName ?? "Conta"} />{" "}
                    Saldo de {goal.accountName}
                  </>
                )}
              </p>
            </div>
          ) : (
            <form.Field name="trackingType">
              {(field) => (
                <div className="grid gap-1.5">
                  <Label htmlFor={`${id}-tracking`}>Acompanhamento</Label>
                  <Select
                    onValueChange={(value) => {
                      if (value) field.handleChange(value);
                    }}
                    value={field.state.value}
                  >
                    <SelectTrigger className="h-11 w-full" id={`${id}-tracking`}>
                      <SelectValue>
                        {(value: string) =>
                          value === "account" ? (
                            <span className="flex items-center gap-2">
                              <Landmark
                                aria-hidden="true"
                                className="size-4 text-muted-foreground"
                              />{" "}
                              Saldo de uma conta
                            </span>
                          ) : (
                            <span className="flex items-center gap-2">
                              <PencilLine
                                aria-hidden="true"
                                className="size-4 text-muted-foreground"
                              />{" "}
                              Acompanhamento manual
                            </span>
                          )
                        }
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem className="py-2.5" value="manual">
                        <PencilLine aria-hidden="true" className="size-4 text-muted-foreground" />
                        <span className="grid gap-0.5">
                          <span>Acompanhamento manual</span>
                          <span className="text-muted-foreground text-xs">
                            Atualize o valor economizado quando quiser
                          </span>
                        </span>
                      </SelectItem>
                      <SelectItem className="py-2.5" value="account">
                        <Landmark aria-hidden="true" className="size-4 text-muted-foreground" />
                        <span className="grid gap-0.5">
                          <span>Saldo de uma conta</span>
                          <span className="text-muted-foreground text-xs">
                            Progresso acompanha o saldo persistido
                          </span>
                        </span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </form.Field>
          )}
          <form.Subscribe selector={(state) => state.values.trackingType}>
            {(trackingType) =>
              trackingType === "manual" ? (
                <form.Field
                  name="currentAmount"
                  validators={{
                    onBlur: ({ value }) =>
                      CreateGoalInputSchema.options[0].shape.currentAmount.safeParse(
                        Number(value || 0),
                      ).success
                        ? undefined
                        : "Informe um valor válido.",
                  }}
                >
                  {(field) => (
                    <div className="grid gap-1.5">
                      <Label htmlFor={`${id}-current`}>Valor já economizado</Label>
                      <CurrencyInput
                        id={`${id}-current`}
                        onBlur={field.handleBlur}
                        onValueChange={field.handleChange}
                        placeholder="R$ 0,00"
                        value={field.state.value}
                        aria-invalid={field.state.meta.errors.length > 0}
                      />
                      {field.state.meta.errors[0] ? (
                        <p className="text-destructive text-xs" role="alert">
                          {field.state.meta.errors[0]}
                        </p>
                      ) : null}
                    </div>
                  )}
                </form.Field>
              ) : goal ? null : (
                <form.Field name="accountId">
                  {(field) => (
                    <div className="grid gap-1.5">
                      <Label htmlFor={`${id}-account`}>Conta vinculada</Label>
                      <Select
                        disabled={
                          accountsLoading ||
                          accountsError ||
                          accounts.every((account) => account.isArchived)
                        }
                        onValueChange={(value) => value && field.handleChange(value)}
                        value={field.state.value}
                      >
                        <SelectTrigger className="h-11 w-full" id={`${id}-account`}>
                          <SelectValue
                            placeholder={
                              accountsLoading ? "Carregando contas..." : "Selecione uma conta"
                            }
                          >
                            {(value: string) => {
                              const account = accounts.find((item) => item.id === value);
                              return account ? (
                                <span className="flex items-center gap-2">
                                  <GoalAccountLogo logo={account.logo} name={account.name} />{" "}
                                  {account.name}
                                </span>
                              ) : null;
                            }}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {accounts
                            .filter((account) => !account.isArchived)
                            .map((account) => (
                              <SelectItem key={account.id} value={account.id}>
                                <GoalAccountLogo logo={account.logo} name={account.name} />
                                <span>{account.name}</span>
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                      <p className="text-muted-foreground text-xs">
                        O saldo inteiro da conta define o progresso. Esta meta não reserva dinheiro.
                      </p>
                      {accountsLoading ? (
                        <p className="text-muted-foreground text-xs">Carregando contas...</p>
                      ) : null}
                      {accountsError ? (
                        <p className="text-destructive text-xs">
                          Não foi possível carregar as contas.
                        </p>
                      ) : null}
                      {!accountsLoading &&
                      !accountsError &&
                      accounts.every((account) => account.isArchived) ? (
                        <p className="text-muted-foreground text-xs">
                          Nenhuma conta ativa disponível.{" "}
                          <Link className="text-brand-strong underline" to="/accounts">
                            Ir para contas
                          </Link>
                        </p>
                      ) : null}
                    </div>
                  )}
                </form.Field>
              )
            }
          </form.Subscribe>
          <form.Field name="targetDate">
            {(field) => (
              <div className="grid gap-1.5">
                <Label htmlFor={`${id}-date`}>
                  Data alvo <span className="font-normal text-muted-foreground">(opcional)</span>
                </Label>
                <DatePicker
                  id={`${id}-date`}
                  onChange={field.handleChange}
                  value={field.state.value}
                />
              </div>
            )}
          </form.Field>
          {submitError ? (
            <p className="text-destructive text-sm" role="alert">
              Não foi possível salvar a meta. Tente novamente.
            </p>
          ) : null}
          <form.Subscribe selector={(state) => state.isSubmitting}>
            {(submitting) => (
              <div className="grid grid-cols-2 gap-2">
                <Button
                  disabled={submitting}
                  onClick={() => onOpenChange(false)}
                  type="button"
                  variant="outline"
                >
                  Cancelar
                </Button>
                <Button disabled={submitting} type="submit">
                  {submitting ? "Salvando..." : goal ? "Salvar alterações" : "Criar meta"}
                </Button>
              </div>
            )}
          </form.Subscribe>
        </form>
      </DialogContent>
    </Dialog>
  );
}
