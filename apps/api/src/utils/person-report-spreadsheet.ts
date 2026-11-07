import type { PersonReportOutput } from "@openmonetis/validators/person-reports";
import ExcelJS from "exceljs";
import { getReportGroupLabel, getReportLineAmount } from "./person-report-format";

export type PersonReportSpreadsheet = {
  fileName: string;
  contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  contentBase64: string;
};

const columns = [
  { header: "Data", width: 14 },
  { header: "Descrição", width: 40 },
  { header: "Categoria", width: 28 },
  { header: "Cartão ou forma de pagamento", width: 30 },
  { header: "Parcela", width: 12 },
  { header: "Recorrente", width: 12 },
  { header: "Tipo", width: 12 },
  { header: "Valor (R$)", width: 16 },
];

const moneyFormat = '"R$" #,##0.00;[Red]-"R$" #,##0.00';

/** Only the fields the report already exposes: no accounts, notes or internal identifiers. */
export async function createPersonReportSpreadsheet(
  report: PersonReportOutput,
): Promise<PersonReportSpreadsheet> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Extrato", { views: [{ state: "frozen", ySplit: 1 }] });
  sheet.columns = columns.map((column) => ({ header: column.header, width: column.width }));

  for (const group of report.groups) {
    for (const line of group.lines) {
      sheet.addRow([
        new Date(`${line.purchaseDate}T00:00:00.000Z`),
        line.name,
        line.categoryName ?? "Sem categoria",
        getReportGroupLabel(group),
        line.currentInstallment && line.installmentCount
          ? `${line.currentInstallment}/${line.installmentCount}`
          : null,
        line.isRecurring ? "Sim" : "Não",
        line.kind === "refund" ? "Estorno" : "Despesa",
        getReportLineAmount(line),
      ]);
    }
  }

  const lineCount = sheet.rowCount - 1;
  sheet.addRow([]);
  for (const [label, amount] of [
    ["Total do mês", report.balance.dueAmount],
    ["Repasses recebidos", report.balance.settledAmount],
    ["Saldo", report.balance.balanceAmount],
  ] as const) {
    const row = sheet.addRow([label, null, null, null, null, null, null, amount]);
    row.font = { bold: true };
  }

  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).height = 24;
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: lineCount + 1, column: columns.length },
  };
  sheet.getColumn(1).numFmt = "dd/mm/yyyy";
  sheet.getColumn(columns.length).numFmt = moneyFormat;

  return {
    fileName: `extrato-${report.period}.xlsx`,
    contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    contentBase64: Buffer.from(await workbook.xlsx.writeBuffer()).toString("base64"),
  };
}
