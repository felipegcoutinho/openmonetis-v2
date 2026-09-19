export type CalculatorOperator = "add" | "subtract" | "multiply" | "divide";

type CalculatorState = {
  accumulator: number | null;
  display: string;
  history: string | null;
  operator: CalculatorOperator | null;
  overwrite: boolean;
};

type CalculatorAction =
  | { type: "clear" }
  | { type: "decimal" }
  | { type: "delete" }
  | { type: "digit"; digit: string }
  | { type: "equals" }
  | { type: "operator"; operator: CalculatorOperator }
  | { type: "paste"; value: string | null }
  | { type: "percent" }
  | { type: "toggleSign" };

const maximumDigits = 10;

const calculatorOperatorSymbols: Record<CalculatorOperator, string> = {
  add: "+",
  subtract: "−",
  multiply: "×",
  divide: "÷",
};

const initialCalculatorState: CalculatorState = {
  accumulator: null,
  display: "0",
  history: null,
  operator: null,
  overwrite: false,
};

export function createCalculatorState(initialValue?: string): CalculatorState {
  const normalized = initialValue ? normalizeCalculatorClipboardValue(initialValue) : null;
  return normalized ? { ...initialCalculatorState, display: normalized } : initialCalculatorState;
}

export function calculatorReducer(
  state: CalculatorState,
  action: CalculatorAction,
): CalculatorState {
  switch (action.type) {
    case "clear":
      return initialCalculatorState;
    case "digit":
      return inputDigit(state, action.digit);
    case "decimal":
      return inputDecimal(state);
    case "operator":
      return setOperator(state, action.operator);
    case "equals":
      return evaluate(state);
    case "toggleSign":
      return toggleSign(state);
    case "delete":
      return deleteLastDigit(state);
    case "percent":
      return applyPercent(state);
    case "paste":
      return pasteValue(action.value);
  }
}

export function getCalculatorExpression(state: CalculatorState) {
  if (state.display === "Erro") return state.display;

  if (state.operator && state.accumulator !== null) {
    const left = formatLocaleValue(formatCalculatorNumber(state.accumulator));
    const symbol = calculatorOperatorSymbols[state.operator];
    return state.overwrite
      ? `${left} ${symbol}`
      : `${left} ${symbol} ${formatLocaleValue(state.display)}`;
  }

  return formatLocaleValue(state.display);
}

export function getCalculatorResultText(state: CalculatorState) {
  if (state.display === "Erro") return null;
  const formatted = formatCalculatorNumber(Number(state.display));
  return formatted === "Erro" ? null : formatLocaleValue(formatted);
}

export function getCalculatorFieldValue(state: CalculatorState) {
  if (state.display === "Erro") return null;
  const value = Number(state.display);
  return Number.isFinite(value) && value !== 0 ? Math.abs(value).toFixed(2) : null;
}

export function normalizeCalculatorClipboardValue(rawValue: string): string | null {
  const match = rawValue.trim().match(/-?[\d.,\s]+/);
  if (!match) return null;

  let extracted = match[0].replace(/\s+/g, "");
  const isNegative = extracted.startsWith("-");
  if (isNegative) extracted = extracted.slice(1);
  extracted = extracted.replace(/[^\d.,]/g, "");
  if (!extracted) return null;

  const commas = countOccurrences(extracted, ",");
  const dots = countOccurrences(extracted, ".");
  let decimalSeparator: "," | "." | null = null;

  if (commas && dots) {
    decimalSeparator = extracted.lastIndexOf(",") > extracted.lastIndexOf(".") ? "," : ".";
  } else if (commas === 1) {
    const decimalLength = extracted.length - extracted.lastIndexOf(",") - 1;
    decimalSeparator = decimalLength > 0 && decimalLength <= 2 ? "," : null;
  } else if (dots === 1) {
    const decimalPart = extracted.slice(extracted.lastIndexOf(".") + 1);
    const decimalLength = decimalPart.length;
    decimalSeparator =
      decimalLength > 0 && decimalLength <= 3 && !(decimalLength === 3 && /^0+$/.test(decimalPart))
        ? "."
        : null;
  }

  const separatorIndex = decimalSeparator ? extracted.lastIndexOf(decimalSeparator) : -1;
  const integerPart = (
    separatorIndex >= 0 ? extracted.slice(0, separatorIndex) : extracted
  ).replace(/\D/g, "");
  const decimalPart = (separatorIndex >= 0 ? extracted.slice(separatorIndex + 1) : "").replace(
    /\D/g,
    "",
  );
  const normalized = `${isNegative ? "-" : ""}${integerPart || "0"}${decimalPart ? `.${decimalPart}` : ""}`;
  const value = Number(normalized);

  return Number.isFinite(value) && countDigits(normalized) <= maximumDigits ? normalized : null;
}

function inputDigit(state: CalculatorState, digit: string): CalculatorState {
  if (state.overwrite || state.display === "Erro") {
    return { ...state, display: digit, history: null, overwrite: false };
  }
  if (countDigits(state.display) >= maximumDigits) return state;
  return { ...state, display: state.display === "0" ? digit : `${state.display}${digit}` };
}

function inputDecimal(state: CalculatorState): CalculatorState {
  if (state.overwrite || state.display === "Erro") {
    return { ...state, display: "0.", history: null, overwrite: false };
  }
  if (state.display.includes(".") || countDigits(state.display) >= maximumDigits) return state;
  return { ...state, display: `${state.display}.` };
}

function setOperator(state: CalculatorState, operator: CalculatorOperator): CalculatorState {
  if (state.display === "Erro") return initialCalculatorState;

  const currentValue = Number(state.display);
  if (state.accumulator === null || state.operator === null || state.overwrite) {
    return {
      ...state,
      accumulator: currentValue,
      history: null,
      operator,
      overwrite: true,
    };
  }

  const result = performOperation(state.accumulator, currentValue, state.operator);
  if (!Number.isFinite(result)) return errorState();
  return {
    accumulator: result,
    display: formatCalculatorNumber(result),
    history: null,
    operator,
    overwrite: true,
  };
}

function evaluate(state: CalculatorState): CalculatorState {
  if (state.operator === null || state.accumulator === null || state.display === "Erro") {
    return state;
  }

  const currentValue = Number(state.display);
  const history = `${formatLocaleValue(formatCalculatorNumber(state.accumulator))} ${calculatorOperatorSymbols[state.operator]} ${formatLocaleValue(formatCalculatorNumber(currentValue))}`;
  const result = performOperation(state.accumulator, currentValue, state.operator);
  if (!Number.isFinite(result)) return errorState();
  return {
    accumulator: result,
    display: formatCalculatorNumber(result),
    history,
    operator: null,
    overwrite: true,
  };
}

function toggleSign(state: CalculatorState): CalculatorState {
  if (state.display === "Erro" || state.display === "0") return state;
  return {
    ...state,
    display: state.display.startsWith("-") ? state.display.slice(1) : `-${state.display}`,
    history: state.overwrite ? null : state.history,
    overwrite: false,
  };
}

function deleteLastDigit(state: CalculatorState): CalculatorState {
  if (state.display === "Erro") return initialCalculatorState;
  if (state.overwrite) return { ...state, display: "0", history: null, overwrite: false };
  if (state.display.length <= 1 || (state.display.length === 2 && state.display.startsWith("-"))) {
    return { ...state, display: "0", history: null };
  }
  return { ...state, display: state.display.slice(0, -1), history: null };
}

function applyPercent(state: CalculatorState): CalculatorState {
  if (state.display === "Erro") return state;
  return {
    ...state,
    display: formatCalculatorNumber(Number(state.display) / 100),
    history: null,
    overwrite: true,
  };
}

function pasteValue(value: string | null): CalculatorState {
  if (!value || countDigits(value) > maximumDigits) return errorState();
  return { ...initialCalculatorState, display: value };
}

function errorState(): CalculatorState {
  return { ...initialCalculatorState, display: "Erro", overwrite: true };
}

function performOperation(left: number, right: number, operator: CalculatorOperator) {
  switch (operator) {
    case "add":
      return left + right;
    case "subtract":
      return left - right;
    case "multiply":
      return left * right;
    case "divide":
      return right === 0 ? Number.POSITIVE_INFINITY : left / right;
  }
}

function formatCalculatorNumber(value: number) {
  if (!Number.isFinite(value)) return "Erro";
  return Number(Math.round(value * 1e10) / 1e10).toString();
}

function formatLocaleValue(rawValue: string) {
  if (rawValue === "Erro") return rawValue;
  const isNegative = rawValue.startsWith("-");
  const unsignedValue = isNegative ? rawValue.slice(1) : rawValue;
  const [integer = "0", decimal] = unsignedValue.split(".");
  const formattedInteger = Number(integer || "0").toLocaleString("pt-BR");
  return `${isNegative ? "-" : ""}${formattedInteger}${decimal === undefined ? "" : `,${decimal}`}`;
}

function countDigits(value: string) {
  return value.replace(/[-.]/g, "").length;
}

function countOccurrences(value: string, character: string) {
  return value.split(character).length - 1;
}
