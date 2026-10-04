import { MobileSelect as Select } from "@/components/forms/mobile-select";
import { MobileSelectContent as SelectContent } from "@/components/forms/mobile-select-content";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { useCardForm } from "../useCardForm";

import { DayField } from "./card-day-field";

export function CardClosingFields({
  form,
  fieldId,
}: {
  form: ReturnType<typeof useCardForm>["form"];
  fieldId: ReturnType<typeof useCardForm>["fieldId"];
}) {
  return (
    <>
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

      <form.Field name="closingDayPurchasesNextInvoice">
        {(field) => (
          <div className="flex items-center justify-between gap-4 rounded-lg border p-3 sm:col-span-2">
            <div className="grid gap-1.5">
              <Label htmlFor={fieldId(field.name)}>
                Compra no dia do fechamento vai para a próxima fatura
              </Label>
              <p className="text-muted-foreground text-xs" id={`${fieldId(field.name)}-help`}>
                Encerra o ciclo na véspera do fechamento informado. Compras já lançadas mantêm sua
                fatura; previsões de recorrências seguem a regra do cartão.
              </p>
            </div>
            <Switch
              aria-describedby={`${fieldId(field.name)}-help`}
              checked={field.state.value}
              id={fieldId(field.name)}
              name={field.name}
              onBlur={field.handleBlur}
              onCheckedChange={field.handleChange}
            />
          </div>
        )}
      </form.Field>
    </>
  );
}
