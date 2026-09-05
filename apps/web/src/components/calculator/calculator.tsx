import { useEffect, useEffectEvent, useReducer, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { CalculatorDisplay } from "./calculator-display";
import { CalculatorKeypad } from "./calculator-keypad";
import {
  type CalculatorOperator,
  calculatorReducer,
  createCalculatorState,
  getCalculatorExpression,
  getCalculatorFieldValue,
  getCalculatorResultText,
  normalizeCalculatorClipboardValue,
} from "./calculator-state";

type CalculatorProps = {
  active?: boolean;
  initialValue?: string;
  onSelectValue?: (value: string) => void;
};

const keyOperators: Record<string, CalculatorOperator> = {
  "+": "add",
  "-": "subtract",
  "*": "multiply",
  "/": "divide",
};

export function Calculator({ active = true, initialValue, onSelectValue }: CalculatorProps) {
  const [state, dispatch] = useReducer(calculatorReducer, initialValue, createCalculatorState);
  const [copied, setCopied] = useState(false);
  const copiedTimeout = useRef<number | null>(null);
  const expression = getCalculatorExpression(state);
  const resultText = getCalculatorResultText(state);
  const fieldValue = getCalculatorFieldValue(state);

  async function copyResult() {
    if (!navigator.clipboard?.writeText || !resultText) return;
    try {
      await navigator.clipboard.writeText(resultText);
      setCopied(true);
      if (copiedTimeout.current !== null) window.clearTimeout(copiedTimeout.current);
      copiedTimeout.current = window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  async function pasteValue() {
    if (!navigator.clipboard?.readText) return;
    try {
      const value = normalizeCalculatorClipboardValue(await navigator.clipboard.readText());
      dispatch({ type: "paste", value });
    } catch {
      dispatch({ type: "paste", value: null });
    }
  }

  const handleKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (shouldIgnoreKeyboardEvent(event)) return;
    const shortcut = event.metaKey || event.ctrlKey;
    if (shortcut) {
      if (event.key.toLowerCase() === "c" && resultText) {
        event.preventDefault();
        void copyResult();
      } else if (event.key.toLowerCase() === "v") {
        event.preventDefault();
        void pasteValue();
      }
      return;
    }

    const operator = keyOperators[event.key];
    if (event.key >= "0" && event.key <= "9") {
      event.preventDefault();
      dispatch({ type: "digit", digit: event.key });
    } else if (event.key === "." || event.key === ",") {
      event.preventDefault();
      dispatch({ type: "decimal" });
    } else if (operator) {
      event.preventDefault();
      dispatch({ type: "operator", operator });
    } else if (event.key === "Enter" || event.key === "=") {
      event.preventDefault();
      dispatch({ type: "equals" });
    } else if (event.key === "Backspace") {
      event.preventDefault();
      dispatch({ type: "delete" });
    } else if (event.key === "Escape") {
      event.preventDefault();
      dispatch({ type: "clear" });
    } else if (event.key === "%") {
      event.preventDefault();
      dispatch({ type: "percent" });
    }
  });

  useEffect(() => {
    if (!active) return;
    window.addEventListener("keydown", handleKeyDown, true);
    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
      if (copiedTimeout.current !== null) window.clearTimeout(copiedTimeout.current);
    };
  }, [active]);

  return (
    <div className="grid gap-5">
      <CalculatorDisplay
        copied={copied}
        expression={expression}
        history={state.history}
        onCopy={() => void copyResult()}
        resultText={resultText}
      />
      <CalculatorKeypad
        activeOperator={state.operator}
        onClear={() => dispatch({ type: "clear" })}
        onDecimal={() => dispatch({ type: "decimal" })}
        onDelete={() => dispatch({ type: "delete" })}
        onDigit={(digit) => dispatch({ type: "digit", digit })}
        onEquals={() => dispatch({ type: "equals" })}
        onOperator={(operator) => dispatch({ type: "operator", operator })}
        onPercent={() => dispatch({ type: "percent" })}
        onToggleSign={() => dispatch({ type: "toggleSign" })}
      />
      {onSelectValue ? (
        <Button
          className="h-10 rounded-lg"
          disabled={!fieldValue}
          onClick={() => {
            if (fieldValue) onSelectValue(fieldValue);
          }}
          type="button"
        >
          Usar valor
        </Button>
      ) : null}
    </div>
  );
}

function shouldIgnoreKeyboardEvent(event: KeyboardEvent) {
  if (!(event.target instanceof HTMLElement)) return false;
  const selection = window.getSelection()?.toString().trim();
  if ((event.metaKey || event.ctrlKey) && selection) return true;
  return (
    event.target.tagName === "INPUT" ||
    event.target.tagName === "TEXTAREA" ||
    event.target.isContentEditable
  );
}
