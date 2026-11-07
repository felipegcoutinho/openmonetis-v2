import type {
  ExportTransactionsQuery,
  TransactionExportOutput,
  TransactionOutput,
} from "@openmonetis/validators/transactions";
import ExcelJS from "exceljs";

const typeLabels = { income: "Receita", expense: "Despesa", transfer: "Transferência" };
const conditionLabels = { single: "Única", installment: "Parcelada", recurring: "Recorrente" };
export const paymentMethodLabels = {
  credit_card: "Cartão de crédito",
  debit_card: "Cartão de débito",
  pix: "Pix",
  cash: "Dinheiro",
  boleto: "Boleto",
  benefits: "Benefícios",
  bank_transfer: "Transferência bancária",
};
const columns = [
  { header: "Data", width: 14, date: true },
  { header: "Competência", width: 14 },
  { header: "Descrição", width: 40 },
  { header: "Tipo", width: 18 },
  { header: "Categoria", width: 30 },
  { header: "Pessoa", width: 24 },
  { header: "Conta", width: 24 },
  { header: "Cartão", width: 24 },
  { header: "Forma de pagamento", width: 25 },
  { header: "Condição", width: 18 },
  { header: "Parcela", width: 12 },
  { header: "Conta de origem", width: 24 },
  { header: "Conta de destino", width: 24 },
  { header: "Vencimento", width: 14, date: true },
  { header: "Situação", width: 22 },
  { header: "Valor (R$)", width: 18, money: true },
  { header: "Data da baixa", width: 14, date: true },
  { header: "Observações", width: 45 },
];

function transactionRow(item: TransactionOutput): Array<string | number | null> {
  return [
    item.purchaseDate,
    item.period,
    item.name,
    typeLabels[item.type],
    item.categoryName,
    item.allocation?.personName ?? item.personName,
    item.accountName,
    item.cardName,
    item.paymentMethod ? paymentMethodLabels[item.paymentMethod] : "Não se aplica",
    conditionLabels[item.isRecurring ? "recurring" : item.condition],
    item.currentInstallment && item.installmentCount
      ? `${item.currentInstallment}/${item.installmentCount}`
      : null,
    item.sourceAccountName,
    item.destinationAccountName,
    item.dueDate,
    item.paymentMethod === "credit_card" || item.isSettled === null
      ? "Pela fatura"
      : item.isSettled
        ? item.type === "income"
          ? "Recebido"
          : item.type === "transfer"
            ? "Confirmado"
            : "Pago"
        : "Em aberto",
    item.allocation?.amount ?? item.amount,
    item.settledDate ?? null,
    item.note,
  ];
}

// Quoting alone does not prevent spreadsheet applications from evaluating CSV text as formulas.
function csvCell(value: string | number | null, column: (typeof columns)[number]) {
  if (typeof value === "number") return value.toFixed(2).replace(".", ",");
  let text = value ?? "";
  if (column.date && text) text = text.split("-").reverse().join("/");
  if (/^[\s]*[=+\-@]|^[\t\r\n]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export async function createTransactionsExport(
  items: TransactionOutput[],
  query: ExportTransactionsQuery,
): Promise<TransactionExportOutput> {
  const range =
    query.dateStart || query.dateEnd
      ? `${query.dateStart ?? query.period ?? "inicio"}_${query.dateEnd ?? query.period ?? "fim"}`
      : (query.period ?? "periodo");
  const fileName = `lancamentos-${range}.${query.format}`;
  const rows = items.map(transactionRow);

  if (query.format === "csv") {
    const content = `\uFEFF${[
      columns.map((column) => csvCell(column.header, column)).join(";"),
      ...rows.map((row) => row.map((value, index) => csvCell(value, columns[index])).join(";")),
    ].join("\r\n")}`;
    return {
      fileName,
      contentType: "text/csv;charset=utf-8",
      contentBase64: Buffer.from(content).toString("base64"),
      rowCount: rows.length,
    };
  }

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Lançamentos", { views: [{ state: "frozen", ySplit: 1 }] });
  sheet.columns = columns.map((column) => ({ header: column.header, width: column.width }));
  sheet.addRows(
    rows.map((row) =>
      row.map((value, index) =>
        columns[index].date && typeof value === "string"
          ? new Date(`${value}T00:00:00.000Z`)
          : value,
      ),
    ),
  );
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).height = 24;
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: rows.length + 1, column: columns.length },
  };
  columns.forEach((column, index) => {
    if (column.date) sheet.getColumn(index + 1).numFmt = "dd/mm/yyyy";
    if (column.money) sheet.getColumn(index + 1).numFmt = '"R$" #,##0.00;[Red]-"R$" #,##0.00';
  });
  return {
    fileName,
    contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    contentBase64: Buffer.from(await workbook.xlsx.writeBuffer()).toString("base64"),
    rowCount: rows.length,
  };
}
