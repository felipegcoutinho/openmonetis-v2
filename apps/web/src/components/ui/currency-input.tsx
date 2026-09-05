import type * as React from "react";
import { CalculatorDialogButton } from "@/components/calculator/calculator-dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const formatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function digitsToDecimal(digits: string) {
  const paddedDigits = digits.padStart(3, "0");
  const integerPart = paddedDigits.slice(0, -2).replace(/^0+(?=\d)/, "");
  return `${integerPart}.${paddedDigits.slice(-2)}`;
}

function decimalToDigits(value: string) {
  const compactValue = value.replace(/[^\d,.-]/g, "");
  const normalizedValue = compactValue.includes(",")
    ? compactValue.replace(/\./g, "").replace(",", ".")
    : compactValue;
  const numericValue = Number(normalizedValue);

  if (!Number.isFinite(numericValue)) {
    return "";
  }

  return String(Math.round(Math.abs(numericValue) * 100));
}

type CurrencyInputProps = Omit<
  React.ComponentProps<typeof Input>,
  "defaultValue" | "inputMode" | "onChange" | "type" | "value"
> & {
  allowNegative?: boolean;
  showCalculator?: boolean;
  value: string;
  onValueChange: (value: string) => void;
};

function CurrencyInput({
  allowNegative = false,
  className,
  onValueChange,
  showCalculator = true,
  value,
  ...props
}: CurrencyInputProps) {
  const digits = value ? decimalToDigits(value) : "";
  const isNegative = allowNegative && value.includes("-");
  const displayValue = digits
    ? formatter.format(Number(digitsToDecimal(digits)) * (isNegative ? -1 : 1))
    : "";

  return (
    <div className="relative w-full">
      <Input
        {...props}
        className={cn("tracking-tight", className, showCalculator && "pr-10")}
        inputMode="decimal"
        onChange={(event) => {
          const nextDigits = event.target.value.replace(/\D/g, "");
          const negative = allowNegative && event.target.value.includes("-");
          const decimal = nextDigits ? digitsToDecimal(nextDigits) : "";
          onValueChange(decimal && negative ? `-${decimal}` : decimal);
        }}
        type="text"
        value={displayValue}
      />
      {showCalculator ? (
        <CalculatorDialogButton
          className="absolute top-1/2 right-1 -translate-y-1/2"
          disabled={props.disabled}
          initialValue={value}
          onSelectValue={onValueChange}
        />
      ) : null}
    </div>
  );
}

export { CurrencyInput };
