/** Signed amounts formatted for PT-BR spreadsheets, such as "-10,05", are data, not formulas. */
const signedAmountPattern = /^-\d+(,\d+)?$/;

/**
 * Quotes one CSV cell. Quoting alone does not stop spreadsheet apps from evaluating text that
 * starts with `=`, `+`, `-`, `@`, a tab or a line break as a formula, so such text gets a leading
 * apostrophe; signed amounts stay numbers.
 */
export function csvCell(value: string) {
  const formulaLike =
    /^[\t\r\n]/.test(value) ||
    /^\s*[=+@]/.test(value) ||
    (/^\s*-/.test(value) && !signedAmountPattern.test(value));
  const safeValue = formulaLike ? `'${value}` : value;
  return `"${safeValue.replaceAll('"', '""')}"`;
}
