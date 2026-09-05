import type { ComponentProps } from "react";
import { usePrivacyMode } from "@/components/privacy-provider";
import { cn } from "@/lib/utils";

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

type MoneyValueProps = Omit<ComponentProps<"span">, "children"> & {
  amount: number;
  showPositiveSign?: boolean;
};

export function MoneyValue({
  amount,
  className,
  showPositiveSign = false,
  ...props
}: MoneyValueProps) {
  const { isPrivacyModeEnabled } = usePrivacyMode();
  const formattedValue = currencyFormatter.format(amount);
  const displayValue = showPositiveSign && amount > 0 ? `+${formattedValue}` : formattedValue;

  return (
    <span
      aria-label={isPrivacyModeEnabled ? "Valor oculto" : displayValue}
      className={cn(
        "inline-flex tabular-nums tracking-tighter transition-[filter] duration-200",
        isPrivacyModeEnabled && "blur-sm select-none hover:blur-none",
        className,
      )}
      data-privacy={isPrivacyModeEnabled ? "hidden" : undefined}
      role="img"
      title={isPrivacyModeEnabled ? "Valor oculto. Passe o cursor para revelar." : undefined}
      {...props}
    >
      {displayValue}
    </span>
  );
}
