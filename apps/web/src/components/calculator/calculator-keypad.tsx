import { Delete, Divide, Equal, Minus, Percent, Plus, X } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { CalculatorOperator } from "./calculator-state";

type CalculatorKeypadProps = {
  activeOperator: CalculatorOperator | null;
  onClear: () => void;
  onDecimal: () => void;
  onDelete: () => void;
  onDigit: (digit: string) => void;
  onEquals: () => void;
  onOperator: (operator: CalculatorOperator) => void;
  onPercent: () => void;
  onToggleSign: () => void;
};

const buttons: Array<
  | {
      ariaLabel: string;
      label: ReactNode;
      key: string;
      action: "clear" | "decimal" | "delete" | "equals" | "percent" | "sign";
    }
  | { ariaLabel: string; label: ReactNode; key: string; action: "digit"; value: string }
  | {
      ariaLabel: string;
      label: ReactNode;
      key: string;
      action: "operator";
      value: CalculatorOperator;
    }
> = [
  { ariaLabel: "Limpar", label: "AC", key: "clear", action: "clear" },
  {
    ariaLabel: "Apagar último dígito",
    label: <Delete aria-hidden="true" />,
    key: "delete",
    action: "delete",
  },
  {
    ariaLabel: "Porcentagem",
    label: <Percent aria-hidden="true" />,
    key: "percent",
    action: "percent",
  },
  {
    ariaLabel: "Dividir",
    label: <Divide aria-hidden="true" />,
    key: "divide",
    action: "operator",
    value: "divide",
  },
  { ariaLabel: "Sete", label: "7", key: "7", action: "digit", value: "7" },
  { ariaLabel: "Oito", label: "8", key: "8", action: "digit", value: "8" },
  { ariaLabel: "Nove", label: "9", key: "9", action: "digit", value: "9" },
  {
    ariaLabel: "Multiplicar",
    label: <X aria-hidden="true" />,
    key: "multiply",
    action: "operator",
    value: "multiply",
  },
  { ariaLabel: "Quatro", label: "4", key: "4", action: "digit", value: "4" },
  { ariaLabel: "Cinco", label: "5", key: "5", action: "digit", value: "5" },
  { ariaLabel: "Seis", label: "6", key: "6", action: "digit", value: "6" },
  {
    ariaLabel: "Subtrair",
    label: <Minus aria-hidden="true" />,
    key: "subtract",
    action: "operator",
    value: "subtract",
  },
  { ariaLabel: "Um", label: "1", key: "1", action: "digit", value: "1" },
  { ariaLabel: "Dois", label: "2", key: "2", action: "digit", value: "2" },
  { ariaLabel: "Três", label: "3", key: "3", action: "digit", value: "3" },
  {
    ariaLabel: "Somar",
    label: <Plus aria-hidden="true" />,
    key: "add",
    action: "operator",
    value: "add",
  },
  { ariaLabel: "Inverter sinal", label: "±", key: "sign", action: "sign" },
  { ariaLabel: "Zero", label: "0", key: "0", action: "digit", value: "0" },
  { ariaLabel: "Separador decimal", label: ",", key: "decimal", action: "decimal" },
  {
    ariaLabel: "Calcular resultado",
    label: <Equal aria-hidden="true" />,
    key: "equals",
    action: "equals",
  },
];

export function CalculatorKeypad(props: CalculatorKeypadProps) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {buttons.map((button) => {
        const active = button.action === "operator" && button.value === props.activeOperator;
        return (
          <Button
            aria-label={button.ariaLabel}
            aria-pressed={button.action === "operator" ? active : undefined}
            className={cn(
              "h-12 rounded-lg border font-semibold text-base shadow-none [&_svg]:size-4.5",
              getButtonClassName(button.action, active),
            )}
            key={button.key}
            onClick={() => handleButton(button, props)}
            type="button"
            variant={getVariant(button.action, active)}
          >
            {button.label}
          </Button>
        );
      })}
    </div>
  );
}

function handleButton(button: (typeof buttons)[number], props: CalculatorKeypadProps) {
  switch (button.action) {
    case "clear":
      return props.onClear();
    case "decimal":
      return props.onDecimal();
    case "delete":
      return props.onDelete();
    case "digit":
      return props.onDigit(button.value);
    case "equals":
      return props.onEquals();
    case "operator":
      return props.onOperator(button.value);
    case "percent":
      return props.onPercent();
    case "sign":
      return props.onToggleSign();
  }
}

function getVariant(action: (typeof buttons)[number]["action"], active: boolean) {
  if (active || action === "equals") return "default";
  if (action === "clear") return "destructive";
  return "secondary";
}

function getButtonClassName(action: (typeof buttons)[number]["action"], active: boolean) {
  if (action === "operator" && !active) {
    return "border-brand/20 bg-brand/12 text-brand-strong hover:border-brand/35 hover:bg-brand/22 dark:border-brand/25 dark:bg-secondary/80 dark:text-brand dark:hover:border-brand/40 dark:hover:bg-secondary";
  }

  if (action === "digit" || action === "decimal") {
    return "border-border/60 bg-background text-foreground hover:border-border hover:bg-secondary dark:border-border dark:bg-secondary/65 dark:hover:bg-secondary";
  }

  if (action === "delete" || action === "percent" || action === "sign") {
    return "border-border/60 bg-secondary/70 text-foreground hover:border-border hover:bg-secondary dark:border-border dark:bg-secondary dark:hover:bg-secondary/80";
  }

  if (action === "equals") return "border-primary";

  if (action === "clear") return "border-destructive/15";

  return undefined;
}
