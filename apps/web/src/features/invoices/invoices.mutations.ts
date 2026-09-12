import type {
  AdjustInvoiceInput,
  CreateInvoicePaymentInput,
  UpdateInvoiceDatesInput,
} from "@openmonetis/validators/invoices";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { refreshFinancialQueries } from "@/lib/financial-query-invalidation";
import {
  adjustInvoice,
  deleteInvoiceAdjustment,
  payInvoice,
  reopenInvoice,
  undoInvoicePayment,
  updateInvoiceDates,
} from "./invoices.api";

export function useAdjustInvoiceMutation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      cardId,
      period,
      input,
    }: {
      cardId: string;
      period: string;
      input: AdjustInvoiceInput;
    }) => adjustInvoice(cardId, period, input),
    onSuccess: () => refreshFinancialQueries(client),
  });
}

export function usePayInvoiceMutation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      cardId,
      period,
      input,
    }: {
      cardId: string;
      period: string;
      input: CreateInvoicePaymentInput;
    }) => payInvoice(cardId, period, input),
    onSuccess: () => refreshFinancialQueries(client),
  });
}

export function useReopenInvoiceMutation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ cardId, period }: { cardId: string; period: string }) =>
      reopenInvoice(cardId, period),
    onSuccess: () => refreshFinancialQueries(client),
  });
}

export function useDeleteInvoiceAdjustmentMutation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      cardId,
      period,
      adjustmentId,
    }: {
      cardId: string;
      period: string;
      adjustmentId: string;
    }) => deleteInvoiceAdjustment(cardId, period, adjustmentId),
    onSuccess: () => refreshFinancialQueries(client),
  });
}

export function useUndoInvoicePaymentMutation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      cardId,
      period,
      paymentId,
    }: {
      cardId: string;
      period: string;
      paymentId: string;
    }) => undoInvoicePayment(cardId, period, paymentId),
    onSuccess: () => refreshFinancialQueries(client),
  });
}

export function useUpdateInvoiceDatesMutation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      cardId,
      period,
      input,
    }: {
      cardId: string;
      period: string;
      input: UpdateInvoiceDatesInput;
    }) => updateInvoiceDates(cardId, period, input),
    onSuccess: () => refreshFinancialQueries(client),
  });
}
