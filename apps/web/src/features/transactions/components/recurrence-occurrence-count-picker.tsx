import {
  maximumRecurrenceOccurrenceCount,
  minimumRecurrenceOccurrenceCount,
  type RecurrenceEndDateQuery,
  RecurrenceEndDateQuerySchema,
} from "@openmonetis/validators/transactions";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ListOrdered, LoaderCircle } from "lucide-react";
import { useDeferredValue, useId, useState } from "react";
import {
  MobilePicker as Popover,
  MobilePickerContent as PopoverContent,
  MobilePickerTrigger as PopoverTrigger,
} from "@/components/forms/mobile-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDate } from "../transactions.presentation";
import { recurrenceEndDateQueryOptions } from "../transactions.queries";

const defaultOccurrenceCount = "12";

export function RecurrenceOccurrenceCountPicker({
  disabled,
  onApply,
  query,
}: {
  disabled: boolean;
  onApply: (result: { endDate: string; occurrenceCount: number }) => void;
  query: Omit<RecurrenceEndDateQuery, "occurrenceCount">;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [occurrenceCount, setOccurrenceCount] = useState(defaultOccurrenceCount);
  const deferredOccurrenceCount = useDeferredValue(occurrenceCount);
  const parsed = RecurrenceEndDateQuerySchema.safeParse({
    ...query,
    occurrenceCount: deferredOccurrenceCount,
  });
  const preview = useQuery({
    ...recurrenceEndDateQueryOptions(
      parsed.success ? parsed.data : { ...query, occurrenceCount: 0 },
    ),
    enabled: open && parsed.success,
    placeholderData: keepPreviousData,
  });
  const endDate = parsed.success ? preview.data?.endDate : undefined;
  const isCountInvalid = occurrenceCount !== "" && !parsed.success;
  const canApply =
    Boolean(endDate) && !preview.isPlaceholderData && deferredOccurrenceCount === occurrenceCount;

  const apply = () => {
    if (!parsed.success || !endDate || !canApply) return;
    onApply({ endDate, occurrenceCount: parsed.data.occurrenceCount });
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-auto shrink-0 px-1.5 py-0.5 text-muted-foreground text-xs"
            disabled={disabled}
          />
        }
      >
        <ListOrdered className="size-3.5" aria-hidden="true" />
        Definir por quantidade
      </PopoverTrigger>
      <PopoverContent title="Repetir por quantidade" align="end" className="w-72 gap-3 p-3">
        <div className="grid gap-1.5">
          <Label htmlFor={`${id}-count`}>Quantidade de ocorrências</Label>
          <Input
            id={`${id}-count`}
            inputMode="numeric"
            min={minimumRecurrenceOccurrenceCount}
            max={maximumRecurrenceOccurrenceCount}
            type="number"
            value={occurrenceCount}
            aria-invalid={isCountInvalid}
            onChange={(event) => setOccurrenceCount(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              event.preventDefault();
              apply();
            }}
          />
          <p className="text-muted-foreground text-xs">
            Contando a partir de {formatDate(query.startDate)}.
          </p>
        </div>
        <p className="min-h-5 text-sm" role="status">
          {isCountInvalid ? (
            <span className="text-destructive">
              Informe de {minimumRecurrenceOccurrenceCount} a {maximumRecurrenceOccurrenceCount}{" "}
              ocorrências.
            </span>
          ) : preview.isError ? (
            <span className="text-destructive">Não foi possível calcular a data final.</span>
          ) : endDate === null ? (
            <span className="text-muted-foreground">
              Com esse vencimento, nenhuma data final mantém essa quantidade. Escolha a data no
              calendário.
            </span>
          ) : endDate ? (
            <>
              Termina em <span className="font-medium">{formatDate(endDate)}</span>
            </>
          ) : preview.isFetching ? (
            <LoaderCircle
              aria-label="Calculando data final"
              className="size-4 animate-spin text-muted-foreground"
            />
          ) : null}
        </p>
        <Button type="button" onClick={apply} disabled={!canApply}>
          Aplicar
        </Button>
      </PopoverContent>
    </Popover>
  );
}
