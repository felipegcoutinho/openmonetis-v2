import {
  type InboxRuleConditionField,
  inboxRuleConditionFields,
  inboxRuleMaximumConditions,
  inboxRuleNumericConditionOperators,
  inboxRuleTextConditionOperators,
} from "@openmonetis/domain/inbox-rules";
import type { CategoryOutput } from "@openmonetis/validators/categories";
import {
  type CreateInboxRuleInput,
  CreateInboxRuleInputSchema,
  type InboxRuleOutput,
  type ReplaceInboxRuleInput,
  ReplaceInboxRuleInputSchema,
} from "@openmonetis/validators/inbox-rules";
import type { PersonOutput } from "@openmonetis/validators/people";
import { useForm } from "@tanstack/react-form";
import { CircleOff, Info, Plus, Trash2 } from "lucide-react";
import { useId, useState } from "react";
import { toast } from "sonner";
import { MobileFormState } from "@/components/forms/mobile-form-state";
import { MobileSelect as Select } from "@/components/forms/mobile-select";
import { MobileSelectContent as SelectContent } from "@/components/forms/mobile-select-content";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { getCategoryLabel } from "@/features/categories/categories.presentation";
import { CategoryIcon } from "@/features/categories/category-icons";
import { PersonOption } from "@/features/people/components/person-option";
import { showInvalidFormToast } from "@/lib/form-feedback";
import {
  inboxRuleAmountOperatorLabels,
  inboxRuleFieldLabels,
  inboxRuleMatchModeLabels,
  inboxRuleMatchModeOptions,
  inboxRuleTextOperatorLabels,
} from "../inbox-rules.presentation";

type EditableCondition = {
  formKey: string;
  field: InboxRuleConditionField;
  operator: string;
  value: string;
};

export function InboxRuleForm({
  categories,
  people,
  rule,
  onCancel,
  onSubmit,
}: {
  categories: CategoryOutput[];
  people: PersonOutput[];
  rule: InboxRuleOutput | null;
  onCancel: () => void;
  onSubmit: (input: CreateInboxRuleInput | ReplaceInboxRuleInput) => Promise<void>;
}) {
  const id = useId();
  const [error, setError] = useState<string | null>(null);
  const form = useForm({
    defaultValues: {
      name: rule?.name ?? "",
      priority: String(rule?.priority ?? 100),
      isActive: rule?.isActive ?? true,
      matchMode: rule?.matchMode ?? ("all" as const),
      conditions: (rule?.conditions.map((condition) => ({
        formKey: crypto.randomUUID(),
        field: condition.field,
        operator: condition.operator,
        value: String(condition.value),
      })) ?? [createEmptyCondition()]) as EditableCondition[],
      categoryId: rule?.category?.id ?? "none",
      personId: rule?.person?.id ?? "none",
    },
    onSubmitInvalid: showInvalidFormToast,
    onSubmit: async ({ value }) => {
      setError(null);
      const candidate = {
        name: value.name,
        priority: Number(value.priority),
        isActive: value.isActive,
        matchMode: value.matchMode,
        conditions: value.conditions.map((condition) =>
          condition.field === "parsedAmount"
            ? {
                field: condition.field,
                operator: condition.operator,
                value: Number(condition.value.replace(",", ".")),
              }
            : {
                field: condition.field,
                operator: condition.operator,
                value: condition.value,
              },
        ),
        categoryId: value.categoryId === "none" ? null : value.categoryId,
        personId: value.personId === "none" ? null : value.personId,
        ...(rule ? { expectedVersion: rule.version } : {}),
      };
      const parsed = (rule ? ReplaceInboxRuleInputSchema : CreateInboxRuleInputSchema).safeParse(
        candidate,
      );
      if (!parsed.success) {
        showInvalidFormToast();
        setError("Revise os campos da regra.");
        return;
      }
      try {
        await onSubmit(parsed.data);
        toast.success(rule ? "Regra atualizada" : "Regra criada");
      } catch {
        setError("Não foi possível salvar a regra.");
        toast.error("Não foi possível salvar a regra.");
      }
    },
  });

  return (
    <form
      data-mobile-page-form
      className="grid gap-5"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <form.Subscribe
        selector={(state) => ({ isDirty: !state.isDefaultValue, isSubmitting: state.isSubmitting })}
      >
        {(state) => <MobileFormState {...state} />}
      </form.Subscribe>
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_10rem]">
        <form.Field name="name">
          {(field) => (
            <div className="grid gap-1.5">
              <Label className="font-mono" htmlFor={`${id}-name`}>
                Nome da regra
              </Label>
              <Input
                id={`${id}-name`}
                maxLength={120}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
                placeholder="Ex.: Compras no iFood"
                value={field.state.value}
              />
            </div>
          )}
        </form.Field>
        <form.Field name="priority">
          {(field) => (
            <div className="grid gap-1.5">
              <div className="flex items-center gap-1.5">
                <Label className="font-mono" htmlFor={`${id}-priority`}>
                  Ordem de aplicação
                </Label>
                <Tooltip>
                  <TooltipTrigger
                    aria-label="Informações sobre a ordem de aplicação"
                    render={
                      <button
                        className="text-muted-foreground transition-colors hover:text-foreground"
                        type="button"
                      />
                    }
                  >
                    <Info aria-hidden="true" className="size-3.5" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    Números menores são aplicados primeiro. Se mais de uma regra coincidir, cada
                    campo fica com a sugestão da regra de menor número.
                  </TooltipContent>
                </Tooltip>
              </div>
              <Input
                id={`${id}-priority`}
                inputMode="numeric"
                max={9999}
                min={0}
                onChange={(event) => field.handleChange(event.target.value)}
                type="number"
                value={field.state.value}
              />
            </div>
          )}
        </form.Field>
      </div>

      <form.Field mode="array" name="conditions">
        {(conditionsField) => {
          const conditionCount = conditionsField.state.value.length;
          return (
            <fieldset className="grid gap-3">
              <legend className="sr-only">Condições</legend>
              <div className="flex flex-wrap items-end justify-between gap-x-3 gap-y-2">
                <div className="grid gap-0.5">
                  <p aria-hidden="true" className="font-medium text-sm tracking-tight">
                    Condições
                  </p>
                  <p className="text-muted-foreground text-xs">
                    Compare os dados capturados pela notificação.
                  </p>
                </div>
                <form.Field name="matchMode">
                  {(field) => (
                    <Select
                      onValueChange={(value) => value && field.handleChange(value)}
                      value={field.state.value}
                    >
                      <SelectTrigger
                        aria-label="Aplicar quando"
                        className="w-full sm:w-auto"
                        size="sm"
                      >
                        <SelectValue>{inboxRuleMatchModeOptions[field.state.value]}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{inboxRuleMatchModeOptions.all}</SelectItem>
                        <SelectItem value="any">{inboxRuleMatchModeOptions.any}</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </form.Field>
              </div>

              <div className="grid gap-2 rounded-lg border bg-muted/20 p-3">
                <div
                  aria-hidden="true"
                  className="hidden gap-2 font-mono text-muted-foreground text-xs sm:grid sm:grid-cols-[minmax(0,1.25fr)_minmax(0,0.9fr)_minmax(0,1fr)_2.25rem]"
                >
                  <span>Campo</span>
                  <span>Operador</span>
                  <span>Valor</span>
                </div>
                <form.Subscribe selector={(state) => state.values.matchMode}>
                  {(matchMode) =>
                    conditionsField.state.value.map((condition, index) => {
                      const numeric = condition.field === "parsedAmount";
                      return (
                        <div className="grid gap-2" key={condition.formKey}>
                          {index > 0 ? (
                            <span
                              aria-hidden="true"
                              className="eyebrow flex items-center gap-2 text-muted-foreground before:h-px before:flex-1 before:bg-border after:h-px after:flex-1 after:bg-border"
                            >
                              {inboxRuleMatchModeLabels[matchMode].connector}
                            </span>
                          ) : null}
                          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_2.25rem] items-center gap-2 sm:grid-cols-[minmax(0,1.25fr)_minmax(0,0.9fr)_minmax(0,1fr)_2.25rem]">
                            <form.Field name={`conditions[${index}].field`}>
                              {(field) => (
                                <div className="min-w-0">
                                  <Label
                                    className="sr-only"
                                    htmlFor={`${id}-condition-${index}-field`}
                                  >
                                    Campo da condição {index + 1}
                                  </Label>
                                  <Select
                                    onValueChange={(value) => {
                                      if (!value) return;
                                      field.handleChange(value);
                                      form.setFieldValue(
                                        `conditions[${index}].operator`,
                                        value === "parsedAmount" ? "equals" : "contains",
                                      );
                                    }}
                                    value={field.state.value}
                                  >
                                    <SelectTrigger
                                      className="w-full"
                                      id={`${id}-condition-${index}-field`}
                                    >
                                      <SelectValue>
                                        {inboxRuleFieldLabels[field.state.value]}
                                      </SelectValue>
                                    </SelectTrigger>
                                    <SelectContent>
                                      {inboxRuleConditionFields.map((item) => (
                                        <SelectItem key={item} value={item}>
                                          {inboxRuleFieldLabels[item]}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              )}
                            </form.Field>
                            <form.Field name={`conditions[${index}].operator`}>
                              {(field) => (
                                <div className="min-w-0">
                                  <Label
                                    className="sr-only"
                                    htmlFor={`${id}-condition-${index}-operator`}
                                  >
                                    Operador da condição {index + 1}
                                  </Label>
                                  <Select
                                    onValueChange={(value) => value && field.handleChange(value)}
                                    value={field.state.value}
                                  >
                                    <SelectTrigger
                                      className="w-full"
                                      id={`${id}-condition-${index}-operator`}
                                    >
                                      <SelectValue>
                                        {getOperatorLabel(field.state.value)}
                                      </SelectValue>
                                    </SelectTrigger>
                                    <SelectContent>
                                      {(numeric
                                        ? inboxRuleNumericConditionOperators
                                        : inboxRuleTextConditionOperators
                                      ).map((operator) => (
                                        <SelectItem key={operator} value={operator}>
                                          {getOperatorLabel(operator)}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              )}
                            </form.Field>
                            <form.Field name={`conditions[${index}].value`}>
                              {(field) => (
                                <div className="order-last col-span-3 min-w-0 sm:order-none sm:col-span-1">
                                  <Label
                                    className="sr-only"
                                    htmlFor={`${id}-condition-${index}-value`}
                                  >
                                    Valor da condição {index + 1}
                                  </Label>
                                  <Input
                                    id={`${id}-condition-${index}-value`}
                                    inputMode={numeric ? "decimal" : undefined}
                                    maxLength={numeric ? undefined : 500}
                                    onChange={(event) => field.handleChange(event.target.value)}
                                    placeholder={numeric ? "0,00" : "Ex.: 8139"}
                                    type="text"
                                    value={field.state.value}
                                  />
                                </div>
                              )}
                            </form.Field>
                            <Tooltip>
                              <TooltipTrigger
                                aria-label={`Remover condição ${index + 1}`}
                                disabled={conditionCount === 1}
                                onClick={() => conditionsField.removeValue(index)}
                                render={
                                  <Button
                                    className="text-muted-foreground hover:text-destructive"
                                    size="icon"
                                    type="button"
                                    variant="ghost"
                                  />
                                }
                              >
                                <Trash2 aria-hidden="true" />
                              </TooltipTrigger>
                              <TooltipContent>Remover condição</TooltipContent>
                            </Tooltip>
                          </div>
                        </div>
                      );
                    })
                  }
                </form.Subscribe>
                <Button
                  className="mt-1 w-full border-dashed"
                  disabled={conditionCount >= inboxRuleMaximumConditions}
                  onClick={() => conditionsField.pushValue(createEmptyCondition())}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  <Plus aria-hidden="true" />
                  {conditionCount >= inboxRuleMaximumConditions
                    ? `Limite de ${inboxRuleMaximumConditions} condições`
                    : "Adicionar condição"}
                </Button>
              </div>
            </fieldset>
          );
        }}
      </form.Field>

      <fieldset className="grid gap-3">
        <legend className="sr-only">Sugerir no lançamento</legend>
        <div aria-hidden="true" className="grid gap-0.5">
          <p className="font-medium text-sm tracking-tight">Sugerir no lançamento</p>
          <p className="text-muted-foreground text-xs">
            Escolha ao menos um campo. Você sempre revisa antes de confirmar.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <form.Field name="categoryId">
            {(field) => (
              <div className="grid gap-1.5">
                <Label className="font-mono" htmlFor={`${id}-category`}>
                  Categoria
                </Label>
                <Select
                  onValueChange={(value) => value && field.handleChange(value)}
                  value={field.state.value}
                >
                  <SelectTrigger className="w-full" id={`${id}-category`}>
                    <SelectValue>
                      <CategoryOption
                        category={categories.find((category) => category.id === field.state.value)}
                      />
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">
                      <CategoryOption />
                    </SelectItem>
                    {categories
                      .filter((category) => category.type === "expense")
                      .map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          <CategoryOption category={category} />
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </form.Field>
          <form.Field name="personId">
            {(field) => (
              <div className="grid gap-1.5">
                <Label className="font-mono" htmlFor={`${id}-person`}>
                  Pessoa
                </Label>
                <Select
                  onValueChange={(value) => value && field.handleChange(value)}
                  value={field.state.value}
                >
                  <SelectTrigger className="w-full" id={`${id}-person`}>
                    <SelectValue>
                      <PersonOption
                        person={people.find((person) => person.id === field.state.value)}
                        placeholder={<NotFilledOption />}
                      />
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">
                      <NotFilledOption />
                    </SelectItem>
                    {people
                      .filter((person) => person.status === "active")
                      .map((person) => (
                        <SelectItem key={person.id} value={person.id}>
                          <PersonOption person={person} />
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </form.Field>
        </div>
      </fieldset>

      <form.Field name="isActive">
        {(field) => (
          <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
            <div>
              <Label className="font-mono" htmlFor={`${id}-active`}>
                Regra ativa
              </Label>
              <p className="mt-1 text-muted-foreground text-xs">
                Regras inativas ficam salvas, mas não sugerem valores.
              </p>
            </div>
            <Switch
              checked={field.state.value}
              id={`${id}-active`}
              onCheckedChange={field.handleChange}
            />
          </div>
        )}
      </form.Field>

      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}

      <form.Subscribe selector={(state) => state.isSubmitting}>
        {(submitting) => (
          <div data-mobile-form-actions className="grid grid-cols-2 gap-2 [&>*]:w-full">
            <Button
              data-mobile-cancel
              disabled={submitting}
              onClick={onCancel}
              type="button"
              variant="outline"
            >
              Cancelar
            </Button>
            <Button disabled={submitting} type="submit">
              {submitting ? "Salvando..." : rule ? "Atualizar" : "Salvar"}
            </Button>
          </div>
        )}
      </form.Subscribe>
    </form>
  );
}

function createEmptyCondition(): EditableCondition {
  return {
    formKey: crypto.randomUUID(),
    field: "originalText",
    operator: "contains",
    value: "",
  };
}

function getOperatorLabel(operator: string) {
  return (
    inboxRuleAmountOperatorLabels[operator as keyof typeof inboxRuleAmountOperatorLabels] ??
    inboxRuleTextOperatorLabels[operator as keyof typeof inboxRuleTextOperatorLabels]
  );
}

function NotFilledOption() {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <span className="grid size-6 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
        <CircleOff aria-hidden="true" className="size-3.5" />
      </span>
      <span>Não preencher</span>
    </span>
  );
}

function CategoryOption({ category }: { category?: CategoryOutput }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <span className="grid size-6 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
        {category ? (
          <CategoryIcon className="size-3.5" name={category.icon} />
        ) : (
          <CircleOff aria-hidden="true" className="size-3.5" />
        )}
      </span>
      <span className="truncate">{category ? getCategoryLabel(category) : "Não preencher"}</span>
    </span>
  );
}
