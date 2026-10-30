import type { DueDateRule } from "@openmonetis/domain/due-date-rules";
import type { DueDateRuleOptions } from "@openmonetis/validators/due-date-rules";
import { useId, useState } from "react";
import { MobileSelect as Select } from "@/components/forms/mobile-select";
import { MobileSelectContent as SelectContent } from "@/components/forms/mobile-select-content";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { dueDateAdjustmentLabels, dueDateTargetLabels } from "../due-date-rules.presentation";
export function DueDateRuleFields({
  rule,
  options,
  disabled,
  onChange,
}: {
  rule: DueDateRule;
  options: DueDateRuleOptions;
  disabled: boolean;
  onChange: (rule: DueDateRule) => void;
}) {
  const id = useId();
  const [search, setSearch] = useState("");
  const matchesSearch = (name: string) =>
    name.toLocaleLowerCase("pt-BR").includes(search.trim().toLocaleLowerCase("pt-BR"));
  const cards = options.cards.filter((item) => matchesSearch(item.name));
  const payables = options.payables.filter((item) => matchesSearch(item.name));
  const selectedCount = rule.cardIds.length + rule.transactionIds.length + rule.seriesIds.length;
  const update = (changes: Partial<DueDateRule>) => onChange({ ...rule, ...changes });
  return (
    <fieldset disabled={disabled} className="grid min-w-0 gap-4">
      <legend className="sr-only">{rule.name || "Nova regra"}</legend>
      <div className="grid min-w-0 gap-4 xl:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor={`${id}-name`}>Nome da regra</Label>
          <Input
            id={`${id}-name`}
            maxLength={100}
            value={rule.name}
            onChange={(event) => update({ name: event.target.value })}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`${id}-target`}>Aplicar a</Label>
          <Select
            value={rule.target}
            disabled={disabled}
            onValueChange={(value) => {
              if (value === "invoice" || value === "payable") {
                setSearch("");
                update({
                  target: value,
                  scope: "all",
                  cardIds: [],
                  transactionIds: [],
                  seriesIds: [],
                });
              }
            }}
          >
            <SelectTrigger id={`${id}-target`} className="w-full min-w-0">
              <SelectValue>{dueDateTargetLabels[rule.target]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="payable">Contas a pagar</SelectItem>
              <SelectItem value="invoice">Faturas de cartão</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`${id}-scope`}>Abrangência</Label>
          <Select
            value={rule.scope}
            disabled={disabled}
            onValueChange={(value) => {
              if (value === "all" || value === "selected")
                update({ scope: value, cardIds: [], transactionIds: [], seriesIds: [] });
            }}
          >
            <SelectTrigger id={`${id}-scope`} className="w-full min-w-0">
              <SelectValue>
                {rule.scope === "all"
                  ? rule.target === "invoice"
                    ? "Todos os cartões"
                    : "Todas as contas a pagar"
                  : rule.target === "invoice"
                    ? "Cartões selecionados"
                    : "Contas a pagar selecionadas"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                {rule.target === "invoice" ? "Todos os cartões" : "Todas as contas a pagar"}
              </SelectItem>
              <SelectItem value="selected">
                {rule.target === "invoice" ? "Cartões selecionados" : "Contas a pagar selecionadas"}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`${id}-adjustment`}>Ajustar para</Label>
          <Select
            value={rule.adjustment}
            disabled={disabled}
            onValueChange={(value) => {
              if (value === "next" || value === "previous" || value === "none")
                update({ adjustment: value });
            }}
          >
            <SelectTrigger id={`${id}-adjustment`} className="w-full min-w-0">
              <SelectValue>{dueDateAdjustmentLabels[rule.adjustment]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="next">Próximo dia útil</SelectItem>
              <SelectItem value="previous">Dia útil anterior</SelectItem>
              <SelectItem value="none">Manter data original</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      {rule.adjustment !== "none" ? (
        <div className="grid gap-2">
          <p className="font-medium text-sm">Quando o vencimento cair em</p>
          <div className="flex flex-wrap gap-4">
            <Label htmlFor={`${id}-weekends`}>
              <Checkbox
                id={`${id}-weekends`}
                checked={rule.weekends}
                disabled={disabled}
                onCheckedChange={(value) => update({ weekends: value === true })}
              />
              Final de semana
            </Label>
            <Label htmlFor={`${id}-holidays`}>
              <Checkbox
                id={`${id}-holidays`}
                checked={rule.holidays}
                disabled={disabled}
                onCheckedChange={(value) => update({ holidays: value === true })}
              />
              Feriado
            </Label>
          </div>
        </div>
      ) : null}
      {rule.scope === "selected" ? (
        <div className="grid min-w-0 gap-2">
          <Label htmlFor={`${id}-search`}>
            Buscar {rule.target === "invoice" ? "cartões" : "contas a pagar"}
          </Label>
          <Input
            id={`${id}-search`}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Digite um nome"
          />
          <p className="text-muted-foreground text-xs">
            {selectedCount === 1 ? "1 item selecionado" : `${selectedCount} itens selecionados`}
          </p>
          <fieldset
            className="grid max-h-56 gap-3 overflow-y-auto rounded-md border p-3"
            aria-label="Itens abrangidos pela regra"
          >
            {rule.target === "invoice" ? (
              cards.length ? (
                cards.map((card) => (
                  <Label key={card.id} htmlFor={`${id}-${card.id}`}>
                    <Checkbox
                      id={`${id}-${card.id}`}
                      disabled={disabled}
                      checked={rule.cardIds.includes(card.id)}
                      onCheckedChange={(checked) =>
                        update({
                          cardIds:
                            checked === true
                              ? [...rule.cardIds, card.id]
                              : rule.cardIds.filter((value) => value !== card.id),
                        })
                      }
                    />
                    {card.name}
                  </Label>
                ))
              ) : (
                <p className="text-muted-foreground text-sm">
                  {search ? "Nenhum cartão encontrado." : "Nenhum cartão disponível."}
                </p>
              )
            ) : payables.length ? (
              payables.map((payable) => {
                const key = payable.kind === "series" ? "seriesIds" : "transactionIds";
                return (
                  <Label
                    key={`${payable.kind}-${payable.id}`}
                    htmlFor={`${id}-${payable.kind}-${payable.id}`}
                  >
                    <Checkbox
                      id={`${id}-${payable.kind}-${payable.id}`}
                      disabled={disabled}
                      checked={rule[key].includes(payable.id)}
                      onCheckedChange={(checked) =>
                        update({
                          [key]:
                            checked === true
                              ? [...rule[key], payable.id]
                              : rule[key].filter((value) => value !== payable.id),
                        })
                      }
                    />
                    {payable.name}
                    {payable.kind === "series" ? " · recorrência" : ""}
                  </Label>
                );
              })
            ) : (
              <p className="text-muted-foreground text-sm">
                {search ? "Nenhuma conta a pagar encontrada." : "Nenhuma conta a pagar disponível."}
              </p>
            )}
          </fieldset>
        </div>
      ) : null}
    </fieldset>
  );
}
