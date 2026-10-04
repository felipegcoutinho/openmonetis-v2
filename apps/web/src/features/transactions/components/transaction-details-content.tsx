import type { TransactionOutput } from "@openmonetis/validators/transactions";
import {
  CalendarDays,
  Clock3,
  FileText,
  Layers3,
  Paperclip,
  ReceiptText,
  RefreshCw,
  Users,
} from "lucide-react";
import type { Dispatch, SetStateAction } from "react";

import { MoneyValue } from "@/components/money-value";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

import { TransactionAttachments } from "@/features/attachments/components/transaction-attachments";
import { CategoryIcon } from "@/features/categories/category-icons";

import {
  formatDate,
  formatDateTime,
  formatPaymentMethod,
  formatPeriod,
  recurrenceFrequencyLabels,
  transactionConditionLabels,
  transactionOriginLabels,
} from "../transactions.presentation";
import { TransactionDetailsActions } from "./transaction-details-actions";
import { DetailRow, DetailsSection, SectionTitle } from "./transaction-details-section";
import type { TransactionDetailsSheetProps } from "./transaction-details-sheet.types";
import { TransactionSummary } from "./transaction-details-summary";
import { FinancialRelation } from "./transaction-financial-relation";
import { TransactionTypeBadge } from "./transaction-type-badge";
export function TransactionDetailsContent({
  detail,
  detailQuery,
  mobileActions,
  hasMobileActions,
  openRelatedAction,
  setDeleteOpen,
  setInstallmentDeleteOpen,
  setRecurringAction,
}: {
  detail: TransactionOutput;
  detailQuery: { isError: boolean };
  mobileActions: TransactionDetailsSheetProps["mobileActions"];
  hasMobileActions: string | boolean | null | undefined;
  openRelatedAction: (action: () => void) => void;
  setDeleteOpen: Dispatch<SetStateAction<boolean>>;
  setInstallmentDeleteOpen: Dispatch<SetStateAction<boolean>>;
  setRecurringAction: Dispatch<SetStateAction<"pause" | "cancel" | null>>;
}) {
  return (
    <div className="grid gap-6 p-5 pt-3 sm:gap-5 sm:p-4">
      {detailQuery.isError ? (
        <div className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm">
          <p className="font-medium">Os dados mais recentes não puderam ser carregados.</p>
          <p className="mt-1 text-muted-foreground text-xs">
            As informações exibidas podem estar desatualizadas.
          </p>
        </div>
      ) : null}

      <TransactionSummary transaction={detail} />

      <TransactionDetailsActions
        detail={detail}
        mobileActions={mobileActions}
        hasMobileActions={hasMobileActions}
        openRelatedAction={openRelatedAction}
        setDeleteOpen={setDeleteOpen}
        setInstallmentDeleteOpen={setInstallmentDeleteOpen}
        setRecurringAction={setRecurringAction}
      />

      <DetailsSection icon={<ReceiptText />} title="Informações">
        <DetailRow label="Tipo" value={<TransactionTypeBadge type={detail.type} />} />
        <DetailRow label="Data da compra" value={formatDate(detail.purchaseDate)} />
        <DetailRow label="Competência" value={formatPeriod(detail.period)} />
        <DetailRow label="Condição" value={transactionConditionLabels[detail.condition]} />
        <DetailRow
          label="Forma de pagamento"
          value={formatPaymentMethod(detail.paymentMethod, detail.origin)}
        />
        <DetailRow label="Origem" value={transactionOriginLabels[detail.origin]} />
      </DetailsSection>

      <DetailsSection icon={<Layers3 />} title="Classificação">
        <DetailRow
          label="Categoria"
          value={
            detail.categoryName ? (
              <span className="inline-flex items-center gap-2">
                <span className="grid size-7 place-items-center rounded-full bg-muted">
                  <CategoryIcon className="size-4" name={detail.categoryIcon} />
                </span>
                {detail.categoryName}
              </span>
            ) : (
              "Não se aplica"
            )
          }
        />
        <DetailRow
          label="Responsável"
          value={
            <span className="inline-flex items-center gap-2">
              <Avatar size="sm">
                <AvatarImage alt="" src={detail.personAvatarUrl ?? undefined} />
                <AvatarFallback>{detail.personName.slice(0, 1).toUpperCase()}</AvatarFallback>
              </Avatar>
              {detail.personName}
            </span>
          }
        />
        {detail.type === "transfer" ? (
          <>
            <DetailRow
              label="Conta de origem"
              value={
                <FinancialRelation
                  kind="account"
                  logo={detail.sourceAccountLogo}
                  name={detail.sourceAccountName}
                />
              }
            />
            <DetailRow
              label="Conta de destino"
              value={
                <FinancialRelation
                  kind="account"
                  logo={detail.destinationAccountLogo}
                  name={detail.destinationAccountName}
                />
              }
            />
          </>
        ) : (
          <DetailRow
            label={detail.cardName ? "Cartão" : "Conta"}
            value={
              <FinancialRelation
                kind={detail.cardName ? "card" : "account"}
                logo={detail.cardLogo ?? detail.accountLogo}
                name={detail.cardName ?? detail.accountName}
              />
            }
          />
        )}
        {detail.invoicePaymentCardName ? (
          <DetailRow
            label="Fatura paga"
            value={
              <FinancialRelation
                kind="card"
                logo={detail.invoicePaymentCardLogo}
                name={detail.invoicePaymentCardName}
              />
            }
          />
        ) : null}
      </DetailsSection>

      {detail.condition === "installment" &&
      detail.currentInstallment !== null &&
      detail.installmentCount !== null ? (
        <DetailsSection icon={<CalendarDays />} title="Parcelamento">
          <DetailRow
            label="Parcela"
            value={`${detail.currentInstallment} de ${detail.installmentCount}`}
          />
          <DetailRow label="Fatura" value={formatPeriod(detail.period)} />
          {detail.installmentEndPeriod ? (
            <DetailRow
              label="Previsão de término"
              value={formatPeriod(detail.installmentEndPeriod)}
            />
          ) : null}
          <DetailRow
            label="Antecipação"
            value={detail.anticipationId ? "Parcela antecipada" : "Não antecipada"}
          />
        </DetailsSection>
      ) : null}

      {detail.condition === "recurring" && detail.recurrenceFrequency ? (
        <DetailsSection icon={<RefreshCw />} title="Recorrência">
          <DetailRow
            label="Frequência"
            value={recurrenceFrequencyLabels[detail.recurrenceFrequency]}
          />
          <DetailRow label="Ocorrência" value={formatDate(detail.purchaseDate)} />
        </DetailsSection>
      ) : null}

      {detail.paymentMethod === "boleto" && (detail.dueDate || detail.boletoPaymentDate) ? (
        <DetailsSection icon={<Clock3 />} title="Boleto">
          {detail.dueDate ? (
            <DetailRow label="Vencimento" value={formatDate(detail.dueDate)} />
          ) : null}
          {detail.boletoPaymentDate ? (
            <DetailRow label="Data do pagamento" value={formatDate(detail.boletoPaymentDate)} />
          ) : null}
        </DetailsSection>
      ) : null}

      {detail.splitShares.length > 0 ? (
        <section aria-labelledby="transaction-details-split" className="grid gap-2">
          <SectionTitle icon={<Users />} id="transaction-details-split">
            Divisão
          </SectionTitle>
          <div className="grid gap-1 rounded-xl border p-2">
            {detail.splitShares.map((share) => (
              <div
                className="flex items-center justify-between gap-3 rounded-lg px-2 py-2"
                key={share.personId}
              >
                <span className="inline-flex min-w-0 items-center gap-2">
                  <Avatar size="sm">
                    <AvatarImage alt="" src={share.personAvatarUrl ?? undefined} />
                    <AvatarFallback>{share.personName.slice(0, 1).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <span className="truncate">{share.personName}</span>
                </span>
                <MoneyValue amount={share.amount} className="shrink-0 font-medium" />
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {detail.refundedAmount > 0 ? (
        <DetailsSection icon={<RefreshCw />} title="Reembolsos">
          <DetailRow
            label="Valor reembolsado"
            value={<MoneyValue amount={detail.refundedAmount} />}
          />
          <DetailRow
            label="Ainda reembolsável"
            value={<MoneyValue amount={detail.refundableAmount} />}
          />
        </DetailsSection>
      ) : null}

      {detail.note ? (
        <section aria-labelledby="transaction-details-note" className="grid gap-2">
          <SectionTitle icon={<FileText />} id="transaction-details-note">
            Observação
          </SectionTitle>
          <p className="whitespace-pre-wrap wrap-break-word rounded-xl border p-3 text-sm leading-relaxed">
            {detail.note}
          </p>
        </section>
      ) : null}

      {detail.hasAttachments && detail.recordId ? (
        <section aria-labelledby="transaction-details-attachments" className="grid gap-2">
          <SectionTitle icon={<Paperclip />} id="transaction-details-attachments">
            Anexos
          </SectionTitle>
          <TransactionAttachments readOnly transactionId={detail.recordId} />
        </section>
      ) : null}

      {detail.createdAt || detail.updatedAt ? (
        <div className="grid gap-1 border-t pt-4 text-muted-foreground text-xs">
          {detail.createdAt ? <span>Criado em {formatDateTime(detail.createdAt)}</span> : null}
          {detail.updatedAt && detail.updatedAt !== detail.createdAt ? (
            <span>Atualizado em {formatDateTime(detail.updatedAt)}</span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
