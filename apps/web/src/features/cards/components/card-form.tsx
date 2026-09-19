import type { AccountOutput } from "@openmonetis/validators/accounts";
import type { CardOutput, CreateCardInput, ReplaceCardInput } from "@openmonetis/validators/cards";
import { CreateCardInputSchema, ReplaceCardInputSchema } from "@openmonetis/validators/cards";
import { useForm } from "@tanstack/react-form";
import { Image } from "@unpic/react";
import { Info } from "lucide-react";
import { useId, useState } from "react";
import { toast } from "sonner";
import { LogoPicker } from "@/components/logo-picker";
import { Button } from "@/components/ui/button";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { showInvalidFormToast } from "@/lib/form-feedback";
import { logoCatalog } from "@/lib/logo-catalog";
import { getCardBrandAsset } from "../card-brand-assets";
import {
  cardBrandLabels,
  cardBrandOptions,
  daysOfMonth,
  formatCurrency,
  getCardLogoDisplayName,
  parseCurrencyInput,
} from "../cards.presentation";

type CardFormProps = {
  accounts: AccountOutput[];
  card?: CardOutput | null;
  onCancel: () => void;
  onSubmit: (input: CreateCardInput | ReplaceCardInput) => Promise<void>;
};

type FormValues = {
  name: string;
  brand: CardOutput["brand"];
  status: CardOutput["status"];
  limit: string;
  closingDay: string;
  closingRuleType: CardOutput["closingRuleType"];
  closingOffsetDays: string;
  closingOffsetMode: NonNullable<CardOutput["closingOffsetMode"]>;
  dueDay: string;
  accountId: string;
  logo: string | null;
  note: string;
};

function initialValues(card: CardOutput | null | undefined, accounts: AccountOutput[]): FormValues {
  return {
    name: card?.name ?? "",
    brand: card?.brand ?? "mastercard",
    status: card?.status ?? "active",
    limit: formatCurrency(card?.limit ?? 0),
    closingDay: String(card?.closingDay ?? 1),
    closingRuleType: card?.closingRuleType ?? "fixedDay",
    closingOffsetDays: String(card?.closingOffsetDays ?? 7),
    closingOffsetMode: card?.closingOffsetMode ?? "calendarDays",
    dueDay: String(card?.dueDay ?? 10),
    accountId: card?.accountId ?? accounts[0]?.id ?? "",
    logo: card?.logo ?? null,
    note: card?.note ?? "",
  };
}

function FieldError({ message }: { message?: string }) {
  return message ? (
    <p className="text-destructive text-xs" role="alert">
      {message}
    </p>
  ) : null;
}

export function CardForm({ accounts, card, onCancel, onSubmit }: CardFormProps) {
  const id = useId();
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const isEditing = Boolean(card);
  const form = useForm({
    defaultValues: initialValues(card, accounts),
    onSubmitInvalid: showInvalidFormToast,
    onSubmit: async ({ value }) => {
      setSubmissionError(null);
      const input = {
        name: value.name.trim(),
        brand: value.brand,
        status: value.status,
        limit: parseCurrencyInput(value.limit),
        closingRuleType: value.closingRuleType,
        closingDay: value.closingRuleType === "fixedDay" ? Number(value.closingDay) : null,
        closingOffsetDays:
          value.closingRuleType === "daysBeforeDue" ? Number(value.closingOffsetDays) : null,
        closingOffsetMode:
          value.closingRuleType === "daysBeforeDue" ? value.closingOffsetMode : null,
        dueDay: Number(value.dueDay),
        accountId: value.accountId,
        logo: value.logo,
        note: value.note.trim() || null,
      };
      const result = (isEditing ? ReplaceCardInputSchema : CreateCardInputSchema).safeParse(input);
      if (!result.success) {
        showInvalidFormToast();
        return;
      }
      try {
        await onSubmit(result.data);
        toast.success(isEditing ? "Cartão atualizado" : "Cartão criado");
      } catch {
        setSubmissionError("Não foi possível salvar.");
        toast.error("Não foi possível salvar.");
      }
    },
  });
  const fieldId = (name: string) => `${id}-${name}`;

  return (
    <form
      className="grid gap-4"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <form.Field name="logo">
        {(field) => (
          <LogoPicker
            allowEmpty
            dialogTitle="Selecionar instituição"
            label="Instituição"
            onChange={(logo) => {
              field.handleChange(logo);
              form.setFieldValue("name", getCardLogoDisplayName(logo));
            }}
            options={logoCatalog}
            searchPlaceholder="Buscar emissor do cartão"
            value={field.state.value}
          />
        )}
      </form.Field>

      <div className="grid gap-3 sm:grid-cols-2">
        <form.Field
          name="name"
          validators={{
            onBlur: ({ value }) =>
              CreateCardInputSchema.shape.name.safeParse(value).success
                ? undefined
                : "Informe o nome.",
          }}
        >
          {(field) => (
            <div className="grid content-start gap-1.5">
              <Label htmlFor={fieldId(field.name)}>Nome do cartão</Label>
              <Input
                aria-invalid={field.state.meta.errors.length > 0}
                id={fieldId(field.name)}
                name={field.name}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
                placeholder="Ex.: Nubank Platinum"
                value={field.state.value}
              />
              <FieldError message={field.state.meta.errors[0]} />
            </div>
          )}
        </form.Field>

        <form.Field name="brand">
          {(field) => (
            <div className="grid content-start gap-1.5">
              <Label htmlFor={fieldId(field.name)}>Bandeira</Label>
              <Select
                onValueChange={(value) => {
                  if (value) field.handleChange(value);
                }}
                value={field.state.value}
              >
                <SelectTrigger className="w-full" id={fieldId(field.name)}>
                  <SelectValue>
                    <CardBrandOption brand={field.state.value} />
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {cardBrandOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <CardBrandOption brand={option.value} />
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </form.Field>

        <form.Field name="status">
          {(field) => (
            <div className="grid content-start gap-1.5">
              <Label htmlFor={fieldId(field.name)}>Status</Label>
              <Select
                onValueChange={(value) => {
                  if (value) field.handleChange(value);
                }}
                value={field.state.value}
              >
                <SelectTrigger className="w-full" id={fieldId(field.name)}>
                  <SelectValue>
                    <CardStatusOption status={field.state.value} />
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">
                    <CardStatusOption status="active" />
                  </SelectItem>
                  <SelectItem value="inactive">
                    <CardStatusOption status="inactive" />
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </form.Field>

        <form.Field
          name="limit"
          validators={{
            onBlur: ({ value }) =>
              CreateCardInputSchema.shape.limit.safeParse(parseCurrencyInput(value)).success
                ? undefined
                : "Informe o limite.",
          }}
        >
          {(field) => (
            <div className="grid content-start gap-1.5">
              <Label htmlFor={fieldId(field.name)}>Limite</Label>
              <CurrencyInput
                aria-invalid={field.state.meta.errors.length > 0}
                id={fieldId(field.name)}
                name={field.name}
                onBlur={field.handleBlur}
                onValueChange={field.handleChange}
                placeholder="R$ 0,00"
                value={field.state.value}
              />
              <FieldError message={field.state.meta.errors[0]} />
            </div>
          )}
        </form.Field>

        <form.Field name="dueDay">
          {(field) => (
            <div className="sm:col-span-2">
              <DayField
                fieldId={fieldId(field.name)}
                help="Se cair em sábado ou domingo, o vencimento será ajustado para a segunda-feira seguinte."
                label="Dia preferencial de vencimento"
                onChange={field.handleChange}
                value={field.state.value}
              />
            </div>
          )}
        </form.Field>

        <form.Field name="closingRuleType">
          {(field) => (
            <div className="grid content-start gap-1.5 sm:col-span-2">
              <Label htmlFor={fieldId(field.name)}>Regra de fechamento</Label>
              <Select
                onValueChange={(value) => value && field.handleChange(value)}
                value={field.state.value}
              >
                <SelectTrigger className="w-full" id={fieldId(field.name)}>
                  <SelectValue>
                    {field.state.value === "fixedDay"
                      ? "Dia fixo do mês"
                      : "Dias antes do vencimento"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixedDay">Dia fixo do mês</SelectItem>
                  <SelectItem value="daysBeforeDue">Dias antes do vencimento</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </form.Field>

        <form.Subscribe selector={(state) => state.values.closingRuleType}>
          {(closingRuleType) =>
            closingRuleType === "fixedDay" ? (
              <form.Field name="closingDay">
                {(field) => (
                  <div className="sm:col-span-2">
                    <DayField
                      fieldId={fieldId(field.name)}
                      label="Dia de fechamento"
                      onChange={field.handleChange}
                      value={field.state.value}
                    />
                  </div>
                )}
              </form.Field>
            ) : (
              <>
                <form.Field name="closingOffsetDays">
                  {(field) => (
                    <div className="grid content-start gap-1.5">
                      <Label htmlFor={fieldId(field.name)}>Quantidade de dias</Label>
                      <Input
                        id={fieldId(field.name)}
                        inputMode="numeric"
                        max={31}
                        min={1}
                        onChange={(event) => field.handleChange(event.target.value)}
                        type="number"
                        value={field.state.value}
                      />
                    </div>
                  )}
                </form.Field>
                <form.Field name="closingOffsetMode">
                  {(field) => (
                    <div className="grid content-start gap-1.5">
                      <Label htmlFor={fieldId(field.name)}>Contagem</Label>
                      <Select
                        onValueChange={(value) => value && field.handleChange(value)}
                        value={field.state.value}
                      >
                        <SelectTrigger className="w-full" id={fieldId(field.name)}>
                          <SelectValue>
                            {field.state.value === "calendarDays"
                              ? "Dias corridos"
                              : "Dias úteis (segunda a sexta)"}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="calendarDays">Dias corridos</SelectItem>
                          <SelectItem value="weekdays">Dias úteis (segunda a sexta)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </form.Field>
              </>
            )
          }
        </form.Subscribe>

        <form.Field name="accountId">
          {(field) => (
            <div className="grid gap-1.5 sm:col-span-2">
              <Label htmlFor={fieldId(field.name)}>Conta vinculada</Label>
              <Select
                disabled={accounts.length === 0}
                onValueChange={(value) => {
                  if (value) field.handleChange(value);
                }}
                value={field.state.value}
              >
                <SelectTrigger className="w-full" id={fieldId(field.name)}>
                  <SelectValue
                    placeholder={
                      accounts.length ? "Selecione a conta" : "Cadastre uma conta primeiro"
                    }
                  >
                    {(() => {
                      const account = accounts.find((item) => item.id === field.state.value);
                      return account ? <AccountOption account={account} /> : null;
                    })()}
                  </SelectValue>
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

        <form.Field name="note">
          {(field) => (
            <div className="grid gap-1.5 sm:col-span-2">
              <Label htmlFor={fieldId(field.name)}>Anotação</Label>
              <Textarea
                id={fieldId(field.name)}
                maxLength={1000}
                name={field.name}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
                placeholder="Observações sobre este cartão"
                value={field.state.value}
              />
            </div>
          )}
        </form.Field>
      </div>

      {submissionError ? (
        <p className="text-destructive text-sm" role="alert">
          {submissionError}
        </p>
      ) : null}
      <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
        {([canSubmit, isSubmitting]) => (
          <div className="grid w-full grid-cols-2 gap-2 [&>*]:w-full">
            <Button disabled={isSubmitting} onClick={onCancel} type="button" variant="outline">
              Cancelar
            </Button>
            <Button
              aria-disabled={!canSubmit || accounts.length === 0}
              disabled={isSubmitting || accounts.length === 0}
              type="submit"
            >
              {isSubmitting ? "Salvando..." : isEditing ? "Atualizar" : "Salvar"}
            </Button>
          </div>
        )}
      </form.Subscribe>
    </form>
  );
}

function CardBrandOption({ brand }: { brand: CardOutput["brand"] }) {
  const asset = getCardBrandAsset(brand);
  return (
    <span className="flex items-center gap-2">
      {asset ? (
        <Image
          alt=""
          className="size-5 rounded-sm object-contain"
          height={20}
          layout="fixed"
          src={asset}
          width={20}
        />
      ) : null}
      <span>{cardBrandLabels[brand]}</span>
    </span>
  );
}

function CardStatusOption({ status }: { status: CardOutput["status"] }) {
  return (
    <span className="flex items-center gap-2">
      <span
        aria-hidden="true"
        className={`size-2 rounded-full ${status === "active" ? "bg-emerald-500" : "bg-muted-foreground"}`}
      />
      <span>{status === "active" ? "Ativo" : "Inativo"}</span>
    </span>
  );
}

function AccountOption({ account }: { account: AccountOutput }) {
  return (
    <span className="flex items-center gap-2">
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
        <span className="grid size-5 place-items-center rounded-full bg-muted text-[9px]">
          {account.name.slice(0, 1).toUpperCase()}
        </span>
      )}
      <span>{account.name}</span>
    </span>
  );
}

function DayField({
  fieldId,
  help,
  label,
  onChange,
  value,
}: {
  fieldId: string;
  help?: string;
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <div className="grid gap-1.5">
      <div className="flex items-center gap-1.5">
        <Label htmlFor={fieldId}>{label}</Label>
        {help ? (
          <Tooltip>
            <TooltipTrigger
              aria-label="Informações sobre o ajuste do vencimento"
              render={
                <button
                  className="text-muted-foreground transition-colors hover:text-foreground"
                  type="button"
                />
              }
            >
              <Info aria-hidden="true" className="size-3.5" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">{help}</TooltipContent>
          </Tooltip>
        ) : null}
      </div>
      <Select
        onValueChange={(day) => {
          if (day) onChange(day);
        }}
        value={value}
      >
        <SelectTrigger className="w-full" id={fieldId}>
          <SelectValue>Dia {value}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {daysOfMonth.map((day) => (
            <SelectItem key={day} value={String(day)}>
              Dia {day}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
