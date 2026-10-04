import { CreateCardInputSchema } from "@openmonetis/validators/cards";
import { MobileSelect as Select } from "@/components/forms/mobile-select";
import { MobileSelectContent as SelectContent } from "@/components/forms/mobile-select-content";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cardBrandOptions, parseCurrencyInput } from "../cards.presentation";
import type { useCardForm } from "../useCardForm";
import { CardBrandOption } from "./card-brand-option";
import { FieldError } from "./card-field-error";
import { CardStatusOption } from "./card-status-option";

export function CardIdentityFields({
  form,
  fieldId,
}: {
  form: ReturnType<typeof useCardForm>["form"];
  fieldId: ReturnType<typeof useCardForm>["fieldId"];
}) {
  return (
    <>
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
    </>
  );
}
