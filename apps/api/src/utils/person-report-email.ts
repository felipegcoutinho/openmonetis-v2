import { formatDateInBrazil } from "@openmonetis/shared/date-time";
import type {
  PersonReportGroupOutput,
  PersonReportOutput,
} from "@openmonetis/validators/person-reports";
import {
  formatReportCurrency as currency,
  describeReportCommitment,
  describeReportComparison,
  formatReportDate,
  formatReportMonth,
  formatReportPeriod,
  getReportGroupLabel,
  getReportGroupLogoPath,
  getReportLineAmount,
  getReportLineTags,
} from "./person-report-format";

export type PersonReportEmailContent = {
  subject: string;
  html: string;
  text: string;
};

type PersonReportEmailInput = {
  report: PersonReportOutput;
  senderName: string;
  message?: string | null;
  issuedAt: Date;
  /** The month is still open, so the report can change until it closes. */
  partial?: boolean;
  /**
   * `src` of each available image by its bundled path: `cid:` references for inline email
   * attachments, or the path itself for a page served by the web app. Missing images fall back to
   * monograms.
   */
  imageSources?: ReadonlyMap<string, string>;
  /** Renders a printable document with this title instead of an email body. */
  printTitle?: string;
};

const brandIconPath = "/icon-192.png";

/**
 * The app's light theme tokens converted to hex: email clients ignore stylesheets, CSS variables
 * and oklch, so the template inlines them.
 */
const colors = {
  page: "#efe9df", // --secondary
  paper: "#f6f4f1", // --background
  surface: "#efe9df", // --muted
  accent: "#f7e5cf", // --accent
  brand: "#fc941d", // --primary (coral)
  text: "#3f2508", // --foreground (charcoal)
  muted: "#725f49", // --muted-foreground
  border: "#dbd5ce", // --border over the background
  success: "#287a50", // --success
};

const fontFamily = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const monoFamily = "ui-monospace,SFMono-Regular,Menlo,Consolas,monospace";

export function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/** Content id of an inline image; the HTML references it as `cid:<id>`. */
export function getPersonReportEmailImageId(path: string) {
  return `om-${path.replace(/^\//, "").replace(/[^\w.-]/g, "-")}`;
}

/** Image sources for an email whose images travel as inline attachments. */
export function inlinePersonReportImageSources(paths: Iterable<string>) {
  return new Map([...paths].map((path) => [path, `cid:${getPersonReportEmailImageId(path)}`]));
}

/** Every image the email can embed: the app icon and one logo per group, without repeats. */
export function getPersonReportEmailImagePaths(report: PersonReportOutput) {
  const paths = report.groups
    .map(getReportGroupLogoPath)
    .filter((path): path is string => Boolean(path));
  return [...new Set([brandIconPath, ...paths])];
}

function describeBalance(balance: PersonReportOutput["balance"]) {
  if (balance.status === "receivable") {
    return { label: "Valor em aberto", amount: currency(balance.receivableAmount), credit: false };
  }
  if (balance.status === "credit") {
    return { label: "Crédito a seu favor", amount: currency(balance.creditAmount), credit: true };
  }
  return { label: "Situação", amount: "Tudo acertado", credit: true };
}

function formatEntryCount(count: number) {
  return count === 1 ? "1 lançamento" : `${count} lançamentos`;
}

function formatIssuedDate(date: Date) {
  return formatDateInBrazil(date, { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function buildPersonReportEmail({
  report,
  senderName,
  message,
  issuedAt,
  partial = false,
  imageSources = new Map(),
  printTitle,
}: PersonReportEmailInput): PersonReportEmailContent {
  const input: TemplateInput = {
    report,
    senderName,
    periodLabel: formatReportPeriod(report.period),
    issuedLabel: formatIssuedDate(issuedAt),
    balance: describeBalance(report.balance),
    personalMessage: message?.trim() || null,
    partial,
    imageSources,
    printTitle: printTitle ?? null,
  };

  return {
    subject: `Resumo ${partial ? "parcial " : ""}de despesas de ${input.periodLabel} · ${senderName}`,
    html: buildHtml(input),
    text: buildText(input),
  };
}

type TemplateInput = {
  report: PersonReportOutput;
  senderName: string;
  periodLabel: string;
  issuedLabel: string;
  balance: ReturnType<typeof describeBalance>;
  personalMessage: string | null;
  partial: boolean;
  imageSources: ReadonlyMap<string, string>;
  printTitle: string | null;
};

function statementTitle(partial: boolean) {
  return partial ? "Extrato parcial" : "Extrato de despesas";
}

function partialNotice(issuedLabel: string) {
  return `O mês ainda está aberto: este extrato mostra os lançamentos registrados até ${issuedLabel} e pode mudar até o fechamento.`;
}

function table(content: string, style = "") {
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;${style}">${content}</table>`;
}

function eyebrow(label: string) {
  return `<span style="font-family:${monoFamily};font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:${colors.muted};">${escapeHtml(label)}</span>`;
}

function sectionTitle(title: string, aside = "") {
  return table(`<tr>
    <td style="padding:32px 0 12px;font-size:16px;font-weight:700;color:${colors.text};">${escapeHtml(title)}</td>
    <td style="padding:32px 0 12px;text-align:right;">${aside}</td>
  </tr>`);
}

function money(amount: number, style = "") {
  const color = amount < 0 ? `color:${colors.success};` : "";
  return `<span style="white-space:nowrap;font-variant-numeric:tabular-nums;${color}${style}">${currency(amount)}</span>`;
}

function logo(path: string | null, label: string, imageSources: ReadonlyMap<string, string>) {
  const source = path ? imageSources.get(path) : undefined;
  if (source) {
    return `<img src="${escapeHtml(source)}" width="32" height="32" alt="" style="display:block;width:32px;height:32px;border-radius:16px;">`;
  }
  const initial = escapeHtml(label.trim().charAt(0).toLocaleUpperCase("pt-BR") || "?");
  return `<div style="width:32px;height:32px;line-height:32px;border-radius:16px;background:${colors.accent};color:${colors.text};font-weight:700;font-size:14px;text-align:center;">${initial}</div>`;
}

function tag(label: string, refund: boolean) {
  const color = refund ? colors.success : colors.muted;
  return `<span style="display:inline-block;margin-left:4px;padding:0 6px;border:1px solid ${refund ? colors.success : colors.border};border-radius:999px;font-family:${monoFamily};font-size:10px;line-height:16px;color:${color};">${escapeHtml(label)}</span>`;
}

function buildHeader({ periodLabel, partial, imageSources }: TemplateInput) {
  const brandSource = imageSources.get(brandIconPath);
  const brand = brandSource
    ? `<img src="${escapeHtml(brandSource)}" width="32" height="32" alt="OpenMonetis" style="display:block;width:32px;height:32px;border-radius:8px;">`
    : "";
  return table(`<tr>
    <td style="width:${brand ? 44 : 0}px;padding:0;vertical-align:middle;">${brand}</td>
    <td style="padding:0;vertical-align:middle;font-size:17px;font-weight:700;letter-spacing:-.01em;color:${colors.text};">OpenMonetis</td>
    <td style="padding:0;vertical-align:middle;text-align:right;">
      ${eyebrow(statementTitle(partial))}<br>
      <span style="font-size:15px;font-weight:700;color:${colors.text};">${escapeHtml(periodLabel)}</span>
    </td>
  </tr>`);
}

function buildStatementDetails({
  report,
  senderName,
  periodLabel,
  issuedLabel,
  partial,
}: TemplateInput) {
  const cell = (label: string, value: string) =>
    `<td width="50%" style="padding:10px 14px;vertical-align:top;">${eyebrow(label)}<br><span style="font-size:14px;font-weight:600;color:${colors.text};">${escapeHtml(value)}</span></td>`;
  return table(
    `<tr>${cell("Para", report.person.name)}${cell("Enviado por", senderName)}</tr>
    <tr>${cell("Competência", periodLabel)}${cell("Emitido em", issuedLabel)}</tr>
    ${partial ? `<tr><td colspan="2" style="padding:0 14px 12px;font-size:12px;color:${colors.muted};">${escapeHtml(partialNotice(issuedLabel))}</td></tr>` : ""}`,
    `margin-top:24px;background:${colors.surface};border-radius:10px;`,
  );
}

function buildBalance({ report, balance }: TemplateInput) {
  const row = (label: string, value: string) => `<tr>
    <td style="padding:6px 0;font-size:14px;color:${colors.muted};">${label}</td>
    <td style="padding:6px 0;font-size:14px;text-align:right;color:${colors.text};">${value}</td>
  </tr>`;
  const settled = report.balance.settledAmount;
  return table(
    `<tr><td style="padding:20px 20px 16px;">
      ${eyebrow(balance.label)}
      <div style="margin-top:4px;font-size:30px;line-height:1.2;font-weight:700;letter-spacing:-.02em;font-variant-numeric:tabular-nums;color:${balance.credit ? colors.success : colors.text};">${escapeHtml(balance.amount)}</div>
      ${table(
        `${row("Total do mês", money(report.balance.dueAmount))}
        ${row("(−) Repasses recebidos", settled > 0 ? money(-settled) : money(0))}
        ${
          report.balance.dueAmount > 0 || report.comparison.previousAmount > 0
            ? row(
                `Comparado a ${escapeHtml(formatReportMonth(report.comparison.previousPeriod))}`,
                escapeHtml(describeReportComparison(report.comparison)),
              )
            : ""
        }`,
        `margin-top:14px;border-top:1px solid ${colors.border};`,
      )}
    </td></tr>`,
    `margin-top:16px;background:${colors.accent};border-left:4px solid ${colors.brand};border-radius:10px;`,
  );
}

function buildMessage({ personalMessage, senderName }: TemplateInput) {
  if (!personalMessage) return "";
  return table(
    `<tr><td style="padding:14px 16px;">
      ${eyebrow(`Mensagem de ${senderName}`)}
      <div style="margin-top:4px;font-size:14px;white-space:pre-line;color:${colors.text};">${escapeHtml(personalMessage)}</div>
    </td></tr>`,
    `margin-top:16px;border:1px solid ${colors.border};border-radius:10px;border-collapse:separate;`,
  );
}

function buildGroup(group: PersonReportGroupOutput, imageSources: ReadonlyMap<string, string>) {
  const label = getReportGroupLabel(group);
  const columnHeader = (text: string, align = "left") =>
    `<td style="padding:6px 12px;text-align:${align};background:${colors.surface};">${eyebrow(text)}</td>`;
  const lines = group.lines
    .map((line) => {
      const amount = getReportLineAmount(line);
      const tags = getReportLineTags(line)
        .map((value) => tag(value, value === "Estorno"))
        .join("");
      return `<tr class="om-keep">
        <td style="width:44px;padding:10px 12px;border-top:1px solid ${colors.border};vertical-align:top;font-family:${monoFamily};font-size:12px;color:${colors.muted};">${formatReportDate(line.purchaseDate)}</td>
        <td style="padding:10px 0;border-top:1px solid ${colors.border};vertical-align:top;font-size:14px;color:${colors.text};">
          ${escapeHtml(line.name)}<br>
          <span style="font-size:12px;color:${colors.muted};">${escapeHtml(line.categoryName ?? "Sem categoria")}</span>${tags}
        </td>
        <td style="padding:10px 12px;border-top:1px solid ${colors.border};vertical-align:top;text-align:right;font-size:15px;font-weight:700;color:${colors.text};">${money(amount)}</td>
      </tr>`;
    })
    .join("");

  return table(
    `<tr class="om-keep om-with-next"><td colspan="3" style="padding:12px;">
      ${table(`<tr>
        <td style="width:44px;padding:0;vertical-align:middle;">${logo(getReportGroupLogoPath(group), label, imageSources)}</td>
        <td style="padding:0;vertical-align:middle;">
          <span style="font-size:15px;font-weight:700;color:${colors.text};">${escapeHtml(label)}</span><br>
          <span style="font-size:12px;color:${colors.muted};">${formatEntryCount(group.lines.length)}${group.dueDate ? ` · vence ${formatReportDate(group.dueDate)}` : ""}</span>
        </td>
        <td style="padding:0;vertical-align:middle;text-align:right;font-size:15px;font-weight:700;color:${colors.text};">${money(group.totalAmount)}</td>
      </tr>`)}
    </td></tr>
    <tr class="om-keep om-with-next">${columnHeader("Data")}<td style="padding:6px 0;background:${colors.surface};">${eyebrow("Descrição")}</td>${columnHeader("Valor", "right")}</tr>
    ${lines}`,
    `margin-top:12px;border:1px solid ${colors.border};border-radius:10px;border-collapse:separate;overflow:hidden;`,
  );
}

function buildCommitments({ report }: TemplateInput) {
  if (!report.commitments.length) return "";
  const rows = report.commitments
    .map(
      (commitment) => `<tr>
        <td style="padding:10px 0;border-top:1px solid ${colors.border};vertical-align:top;font-size:14px;color:${colors.text};">
          ${escapeHtml(formatReportPeriod(commitment.period))}<br>
          <span style="font-size:12px;color:${colors.muted};">${escapeHtml(describeReportCommitment(commitment))}</span>
        </td>
        <td style="padding:10px 0;border-top:1px solid ${colors.border};vertical-align:top;text-align:right;font-size:14px;font-weight:700;color:${colors.text};">${money(commitment.totalAmount)}</td>
      </tr>`,
    )
    .join("");
  return `${sectionTitle("Próximos meses")}
    <p style="margin:-6px 0 8px;font-size:12px;color:${colors.muted};">Parcelas, recorrências e outras despesas já lançadas. Os valores podem mudar até o fechamento de cada mês.</p>
    ${table(rows)}`;
}

function buildSettlements({ report }: TemplateInput) {
  if (!report.settlements.length) return "";
  const rows = report.settlements
    .map(
      (settlement) => `<tr>
        <td style="width:56px;padding:10px 0;border-top:1px solid ${colors.border};font-family:${monoFamily};font-size:12px;color:${colors.muted};">${formatReportDate(settlement.receivedAt)}</td>
        <td style="padding:10px 0;border-top:1px solid ${colors.border};font-size:14px;color:${colors.text};">Repasse recebido</td>
        <td style="padding:10px 0;border-top:1px solid ${colors.border};text-align:right;font-size:14px;">${money(-settlement.amount)}</td>
      </tr>`,
    )
    .join("");
  return `${sectionTitle("Repasses recebidos")}${table(rows)}`;
}

function buildHtml(input: TemplateInput) {
  const { report, senderName, periodLabel, balance, imageSources, printTitle } = input;
  const sender = escapeHtml(senderName);
  const preheader = `${balance.label}: ${balance.amount} · ${formatEntryCount(report.entryCount)}`;

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${escapeHtml(printTitle ?? `Resumo de despesas de ${periodLabel}`)}</title>
${
  printTitle
    ? // On paper the statement fills the page: no email canvas around it nor card border.
      `<style>@page{size:A4;margin:12mm}html,body{-webkit-print-color-adjust:exact;print-color-adjust:exact}body,.om-page{background:${colors.paper}!important}.om-page{padding:0!important}.om-sheet{max-width:none!important}.om-sheet>table{border:0!important;border-radius:0!important}.om-sheet>table>tbody>tr>td{padding-left:0!important;padding-right:0!important}.om-keep{break-inside:avoid}.om-with-next{break-after:avoid}</style>`
    : ""
}
</head>
<body style="margin:0;padding:0;background:${colors.page};color:${colors.text};font-family:${fontFamily};line-height:1.5;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>
  ${table(
    `<tr><td class="om-page" style="padding:24px 12px;">
      <div class="om-sheet" style="max-width:600px;margin:0 auto;">
        ${table(
          `<tr><td style="height:6px;padding:0;background:${colors.brand};font-size:0;line-height:0;">&nbsp;</td></tr>
          <tr><td style="padding:24px 24px 28px;">
            ${buildHeader(input)}
            <p style="margin:28px 0 0;font-size:20px;font-weight:700;color:${colors.text};">Olá, ${escapeHtml(report.person.name)}</p>
            <p style="margin:6px 0 0;font-size:14px;color:${colors.muted};">${sender} compartilhou o extrato das despesas atribuídas a você em ${escapeHtml(periodLabel.toLocaleLowerCase("pt-BR"))}.</p>
            ${buildMessage(input)}
            ${buildStatementDetails(input)}
            ${buildBalance(input)}
            ${sectionTitle("Lançamentos", `<span style="font-size:12px;color:${colors.muted};">${formatEntryCount(report.entryCount)}</span>`)}
            ${report.groups.map((group) => buildGroup(group, imageSources)).join("")}
            ${buildSettlements(input)}
            ${buildCommitments(input)}
          </td></tr>`,
          `background:${colors.paper};border:1px solid ${colors.border};border-radius:14px;border-collapse:separate;overflow:hidden;`,
        )}
        <p style="margin:16px 0 0;text-align:center;font-size:12px;color:${colors.muted};">Dúvidas sobre algum lançamento? ${printTitle ? `Fale com ${sender}.` : `Responda este e-mail para falar com ${sender}.`}</p>
        <p style="margin:4px 0 0;text-align:center;font-size:12px;color:${colors.muted};">Extrato gerado pelo OpenMonetis em ${escapeHtml(input.issuedLabel)}.</p>
      </div>
    </td></tr>`,
    `background:${colors.page};`,
  )}
</body>
</html>`;
}

function buildText({
  report,
  senderName,
  periodLabel,
  issuedLabel,
  balance,
  personalMessage,
  partial,
}: TemplateInput) {
  const lines = [
    `${statementTitle(partial)} · ${periodLabel}`,
    `Para: ${report.person.name}`,
    `Enviado por: ${senderName}`,
    `Emitido em: ${issuedLabel}`,
    ...(partial ? [partialNotice(issuedLabel)] : []),
    "",
    `Olá, ${report.person.name}`,
    `${senderName} compartilhou o extrato das despesas atribuídas a você em ${periodLabel.toLocaleLowerCase("pt-BR")}.`,
    ...(personalMessage ? ["", `Mensagem de ${senderName}:`, personalMessage] : []),
    "",
    `${balance.label}: ${balance.amount}`,
    `Total do mês: ${currency(report.balance.dueAmount)}`,
    `(−) Repasses recebidos: ${currency(-report.balance.settledAmount || 0)}`,
    ...(report.balance.dueAmount > 0 || report.comparison.previousAmount > 0
      ? [
          `Comparado a ${formatReportMonth(report.comparison.previousPeriod)}: ${describeReportComparison(report.comparison)}`,
        ]
      : []),
  ];

  for (const group of report.groups) {
    lines.push(
      "",
      `${getReportGroupLabel(group)} · ${currency(group.totalAmount)}${group.dueDate ? ` · vence ${formatReportDate(group.dueDate)}` : ""}`,
    );
    for (const line of group.lines) {
      const tags = getReportLineTags(line);
      lines.push(
        `${formatReportDate(line.purchaseDate)}  ${line.name}${tags.length ? ` (${tags.join(", ")})` : ""}  ${currency(getReportLineAmount(line))}`,
      );
    }
  }

  if (report.settlements.length) {
    lines.push("", "Repasses recebidos");
    for (const settlement of report.settlements) {
      lines.push(`${formatReportDate(settlement.receivedAt)}  ${currency(-settlement.amount)}`);
    }
  }

  if (report.commitments.length) {
    lines.push("", "Próximos meses");
    for (const commitment of report.commitments) {
      lines.push(
        `${formatReportPeriod(commitment.period)}: ${currency(commitment.totalAmount)} (${describeReportCommitment(commitment)})`,
      );
    }
  }

  lines.push(
    "",
    `Dúvidas sobre algum lançamento? Responda este e-mail para falar com ${senderName}.`,
    `Extrato gerado pelo OpenMonetis em ${issuedLabel}.`,
  );
  return lines.join("\n");
}
