import { CreateCardInputSchema, ReplaceCardInputSchema } from "@openmonetis/validators/cards";
import { useForm } from "@tanstack/react-form";
import { useId, useState } from "react";
import { toast } from "sonner";

import { showInvalidFormToast } from "@/lib/form-feedback";

import { parseCurrencyInput } from "./cards.presentation";
import type { CardFormProps } from "./components/card-form.types";
import { initialValues } from "./components/card-form-values";

export function useCardForm({ accounts, card, onSubmit }: CardFormProps) {
  const id = useId();
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const isEditing = Boolean(card);
  const form = useForm({
    defaultValues: initialValues(card, accounts),
    onSubmitInvalid: showInvalidFormToast,
    onSubmit: async ({ value }) => {
      setSubmissionError(null);
      const input = {
        name: value.name.trim(),
        brand: value.brand,
        status: value.status,
        limit: parseCurrencyInput(value.limit),
        closingRuleType: value.closingRuleType,
        closingDayPurchasesNextInvoice: value.closingDayPurchasesNextInvoice,
        closingDay: value.closingRuleType === "fixedDay" ? Number(value.closingDay) : null,
        closingOffsetDays:
          value.closingRuleType === "daysBeforeDue" ? Number(value.closingOffsetDays) : null,
        closingOffsetMode:
          value.closingRuleType === "daysBeforeDue" ? value.closingOffsetMode : null,
        dueDay: Number(value.dueDay),
        accountId: value.accountId,
        logo: value.logo,
        note: value.note.trim() || null,
      };
      const result = (isEditing ? ReplaceCardInputSchema : CreateCardInputSchema).safeParse(input);
      if (!result.success) {
        showInvalidFormToast();
        return;
      }
      try {
        await onSubmit(result.data);
        toast.success(isEditing ? "Cartão atualizado" : "Cartão criado");
      } catch {
        setSubmissionError("Não foi possível salvar.");
        toast.error("Não foi possível salvar.");
      }
    },
  });
  const fieldId = (name: string) => `${id}-${name}`;

  return { id, submissionError, isEditing, form, fieldId };
}

export type CardFormApi = ReturnType<typeof useCardForm>["form"];
