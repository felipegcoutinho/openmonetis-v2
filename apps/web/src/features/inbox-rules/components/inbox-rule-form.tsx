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
import { CircleOff, Plus, Trash2 } from "lucide-react";
import { useId, useState } from "react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { CategoryIcon } from "@/features/categories/category-icons";
import { showInvalidFormToast } from "@/lib/form-feedback";
import {
  inboxRuleAmountOperatorLabels,
  inboxRuleFieldLabels,
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
      className="grid gap-5"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_7rem]">
        <form.Field name="name">
          {(field) => (
            <div className="grid gap-1.5">
              <Label htmlFor={`${id}-name`}>Nome da regra</Label>
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
              <Label htmlFor={`${id}-priority`}>Ordem de aplicação</Label>
              <p className="text-muted-foreground text-xs">
                Números menores são aplicados primeiro.
              </p>
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

      <form.Field name="matchMode">
        {(field) => (
          <div className="grid gap-1.5">
            <Label htmlFor={`${id}-match-mode`}>Aplicar quando</Label>
            <Select
              onValueChange={(value) => value && field.handleChange(value)}
              value={field.state.value}
            >
              <SelectTrigger className="w-full" id={`${id}-match-mode`}>
                <SelectValue>
                  {field.state.value === "all"
                    ? "Todas as condições coincidirem"
                    : "Qualquer condição coincidir"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as condições coincidirem</SelectItem>
                <SelectItem value="any">Qualquer condição coincidir</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </form.Field>

      <form.Field mode="array" name="conditions">
        {(conditionsField) => (
          <fieldset className="grid gap-3">
            <div className="flex items-center justify-between gap-3">
              <legend className="font-medium text-sm tracking-tight">Condições</legend>
              <Button
                disabled={conditionsField.state.value.length >= inboxRuleMaximumConditions}
                onClick={() => conditionsField.pushValue(createEmptyCondition())}
                size="sm"
                type="button"
                variant="outline"
              >
                <Plus aria-hidden="true" /> Adicionar
              </Button>
            </div>
            {conditionsField.state.value.map((condition, index) => {
              const numeric = condition.field === "parsedAmount";
              return (
                <div
                  className="grid gap-2 rounded-lg border bg-muted/20 p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end"
                  key={condition.formKey}
                >
                  <form.Field name={`conditions[${index}].field`}>
                    {(field) => (
                      <div className="grid gap-1.5">
                        <Label htmlFor={`${id}-condition-${index}-field`}>Campo</Label>
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
                          <SelectTrigger className="w-full" id={`${id}-condition-${index}-field`}>
                            <SelectValue>{inboxRuleFieldLabels[field.state.value]}</SelectValue>
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
                      <div className="grid gap-1.5">
                        <Label htmlFor={`${id}-condition-${index}-operator`}>Operador</Label>
                        <Select
                          onValueChange={(value) => value && field.handleChange(value)}
                          value={field.state.value}
                        >
                          <SelectTrigger
                            className="w-full"
                            id={`${id}-condition-${index}-operator`}
                          >
                            <SelectValue>{getOperatorLabel(field.state.value)}</SelectValue>
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
                      <div className="grid gap-1.5 sm:col-span-2">
                        <Label htmlFor={`${id}-condition-${index}-value`}>Valor</Label>
                        <Input
                          id={`${id}-condition-${index}-value`}
                          inputMode={numeric ? "decimal" : undefined}
                          maxLength={numeric ? undefined : 500}
                          onChange={(event) => field.handleChange(event.target.value)}
                          placeholder={numeric ? "0,00" : "Texto a identificar"}
                          type="text"
                          value={field.state.value}
                        />
                      </div>
                    )}
                  </form.Field>
                  <Button
                    aria-label={`Remover condição ${index + 1}`}
                    disabled={conditionsField.state.value.length === 1}
                    onClick={() => conditionsField.removeValue(index)}
                    size="icon"
                    type="button"
                    variant="ghost"
                  >
                    <Trash2 aria-hidden="true" />
                  </Button>
                </div>
              );
            })}
          </fieldset>
        )}
      </form.Field>

      <fieldset className="grid gap-3">
        <legend className="font-medium text-sm tracking-tight">Preencher</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <form.Field name="categoryId">
            {(field) => (
              <div className="grid gap-1.5">
                <Label htmlFor={`${id}-category`}>Categoria</Label>
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
                <Label htmlFor={`${id}-person`}>Pessoa</Label>
                <Select
                  onValueChange={(value) => value && field.handleChange(value)}
                  value={field.state.value}
                >
                  <SelectTrigger className="w-full" id={`${id}-person`}>
                    <SelectValue>
                      <PersonOption
                        person={people.find((person) => person.id === field.state.value)}
                      />
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">
                      <PersonOption />
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
        <p className="text-muted-foreground text-xs">
          Escolha ao menos um campo. Se mais de uma regra coincidir, o menor número de prioridade
          preenche primeiro cada campo.
        </p>
      </fieldset>

      <form.Field name="isActive">
        {(field) => (
          <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
            <div>
              <Label htmlFor={`${id}-active`}>Regra ativa</Label>
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
          <div className="grid grid-cols-2 gap-2 [&>*]:w-full">
            <Button disabled={submitting} onClick={onCancel} type="button" variant="outline">
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
      <span className="truncate">{category?.name ?? "Não preencher"}</span>
    </span>
  );
}

function PersonOption({ person }: { person?: PersonOutput }) {
  if (!person) {
    return (
      <span className="flex min-w-0 items-center gap-2">
        <span className="grid size-6 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
          <CircleOff aria-hidden="true" className="size-3.5" />
        </span>
        <span>Não preencher</span>
      </span>
    );
  }

  return (
    <span className="flex min-w-0 items-center gap-2">
      <Avatar size="sm">
        <AvatarImage alt={`Avatar de ${person.name}`} src={person.avatarUrl ?? undefined} />
        <AvatarFallback>{getPersonInitials(person.name)}</AvatarFallback>
      </Avatar>
      <span className="truncate">{person.name}</span>
    </span>
  );
}

function getPersonInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toLocaleUpperCase("pt-BR");
}
