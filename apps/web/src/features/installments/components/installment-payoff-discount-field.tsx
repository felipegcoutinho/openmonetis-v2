import type {
  InstallmentPayoffSimulationOutput,
  installmentDiscountTypes,
} from "@openmonetis/validators/installments";
import { useId } from "react";
import { MoneyValue } from "@/components/money-value";
import { CurrencyInput } from "@/components/ui/currency-input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

type PayoffDiscountType = (typeof installmentDiscountTypes)[number];

export type PayoffDiscountDraft = {
  type: PayoffDiscountType;
  /** Raw text typed by the user; parsed only when building the request. */
  value: string;
};

/** Bank apps usually show the amount to pay, so that is where the field starts. */
export const emptyPayoffDiscount: PayoffDiscountDraft = { type: "payoffAmount", value: "" };

const discountModes: Record<PayoffDiscountType, { label: string; hint: string }> = {
  payoffAmount: {
    label: "Valor final",
    hint: "O total que o app do banco mostra para antecipar.",
  },
  amount: { label: "Desconto R$", hint: "Quanto o banco tira do total." },
  percentage: { label: "Desconto %", hint: "Percentual que o banco tira do total." },
};
const discountModeOrder: PayoffDiscountType[] = ["payoffAmount", "amount", "percentage"];

type InstallmentPayoffDiscountFieldProps = {
  purchaseName: string;
  discount: PayoffDiscountDraft;
  onDiscountChange: (discount: PayoffDiscountDraft) => void;
  /** Latest simulation of this purchase; absent while the first one loads. */
  impact?: InstallmentPayoffSimulationOutput["series"][number];
};

/**
 * The bank's offer to pay off one purchase, typed however the bank shows it. The API returns the
 * amount to pay, the discount and its percentage, so the result always shows all three.
 */
export function InstallmentPayoffDiscountField({
  purchaseName,
  discount,
  onDiscountChange,
  impact,
}: InstallmentPayoffDiscountFieldProps) {
  const id = useId();
  const inputId = `${id}-value`;
  const hintId = `${id}-hint`;
  const outOfRange = impact?.discountOutOfRange ?? false;

  return (
    <div className="mt-4 grid gap-3 rounded-lg border border-teal/20 bg-background p-3 md:ml-20 lg:grid-cols-[minmax(0,1fr)_16rem] lg:items-stretch">
      <div className="grid min-w-0 content-center gap-2 lg:px-1">
        <p className="flex flex-wrap items-baseline gap-x-1.5 text-sm">
          <Label htmlFor={inputId}>Oferta do banco</Label>
          {impact ? (
            <span className="text-muted-foreground text-xs tabular-nums">
              para {impact.releasedInstallmentCount}{" "}
              {impact.releasedInstallmentCount === 1 ? "parcela" : "parcelas"} de{" "}
              <MoneyValue amount={impact.releasedAmount} />
            </span>
          ) : null}
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <ToggleGroup
            aria-label={`Como o banco informou a oferta de ${purchaseName}`}
            className="grid w-full grid-cols-3 rounded-md bg-muted p-0.5 sm:flex sm:w-fit"
            onValueChange={(value) => {
              const type = value[0] as PayoffDiscountType | undefined;
              if (type && type !== discount.type) onDiscountChange({ type, value: "" });
            }}
            size="sm"
            spacing={0.5}
            value={[discount.type]}
          >
            {discountModeOrder.map((type) => (
              <ToggleGroupItem
                className="h-8 rounded-[5px] px-2.5 text-muted-foreground text-xs hover:text-foreground data-pressed:bg-background data-pressed:font-medium data-pressed:text-foreground data-pressed:shadow-xs"
                key={type}
                value={type}
              >
                {discountModes[type].label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <div className="sm:w-40">
            {discount.type === "percentage" ? (
              <InputGroup>
                <InputGroupInput
                  aria-describedby={hintId}
                  aria-invalid={outOfRange}
                  id={inputId}
                  inputMode="decimal"
                  maxLength={6}
                  onChange={(event) =>
                    onDiscountChange({
                      type: "percentage",
                      value: event.target.value.replace(/[^\d,.]/g, ""),
                    })
                  }
                  placeholder="0"
                  value={discount.value}
                />
                <InputGroupAddon align="inline-end">%</InputGroupAddon>
              </InputGroup>
            ) : (
              <CurrencyInput
                aria-describedby={hintId}
                aria-invalid={outOfRange}
                id={inputId}
                onValueChange={(value) => onDiscountChange({ type: discount.type, value })}
                placeholder="R$ 0,00"
                value={discount.value}
              />
            )}
          </div>
        </div>
        <p
          className={cn("text-xs", outOfRange ? "text-destructive" : "text-muted-foreground")}
          id={hintId}
          role={outOfRange ? "alert" : undefined}
        >
          {outOfRange && impact ? (
            <>
              {discount.type === "payoffAmount" ? "Maior que" : "Passa dos"}{" "}
              <MoneyValue amount={impact.releasedAmount} /> das parcelas. Calculado sem desconto.
            </>
          ) : (
            discountModes[discount.type].hint
          )}
        </p>
      </div>

      <PayoffResult impact={impact} />
    </div>
  );
}

/** Output of the offer, tinted apart from the inputs so it never reads as another field. */
function PayoffResult({
  impact,
}: {
  impact?: InstallmentPayoffSimulationOutput["series"][number];
}) {
  const hasDiscount = (impact?.discountAmount ?? 0) > 0;

  return (
    <div
      aria-live="polite"
      className="grid content-center rounded-md bg-teal/8 px-3 py-2.5 tabular-nums"
    >
      <p className="text-muted-foreground text-xs">Você paga agora</p>
      {impact ? (
        <>
          <p className="flex flex-wrap items-baseline gap-x-1.5">
            <MoneyValue amount={impact.payoffAmount} className="font-semibold text-lg text-teal" />
            {hasDiscount ? (
              <MoneyValue
                amount={impact.releasedAmount}
                className="text-muted-foreground text-xs line-through"
              />
            ) : null}
          </p>
          <p className={cn("text-xs", hasDiscount ? "text-success" : "text-muted-foreground")}>
            {hasDiscount ? (
              <>
                Economia de <MoneyValue amount={impact.discountAmount} className="font-medium" /> (
                {impact.discountPercentage.toLocaleString("pt-BR")}%)
              </>
            ) : (
              "Sem desconto"
            )}
          </p>
        </>
      ) : (
        <>
          <Skeleton className="my-1 h-6 w-28" />
          <Skeleton className="h-4 w-32" />
        </>
      )}
    </div>
  );
}
