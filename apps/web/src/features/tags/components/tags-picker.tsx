import type { TagOutput } from "@openmonetis/validators/tags";
import { ChevronDown, Plus, Tag, X } from "lucide-react";
import { useId, useState } from "react";
import {
  MobilePicker,
  MobilePickerContent,
  MobilePickerTrigger,
} from "@/components/forms/mobile-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { TagColorIcon } from "./tag-color-icon";
export function TagsPicker({
  tags,
  selected,
  onChange,
  disabled = false,
  emptyLabel = "Selecionar etiquetas",
  maximum,
  onCreate,
  invalid,
  includeInactive = false,
}: {
  tags: TagOutput[];
  selected: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
  emptyLabel?: string;
  maximum?: number;
  onCreate?: () => void;
  invalid?: boolean;
  /** Filters show inactive tags; assignment pickers only keep the ones already selected. */
  includeInactive?: boolean;
}) {
  const id = useId();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const visible = tags.filter(
    (tag) =>
      (includeInactive || tag.status === "active" || selected.includes(tag.id)) &&
      tag.name.toLocaleLowerCase("pt-BR").includes(search.trim().toLocaleLowerCase("pt-BR")),
  );
  return (
    <div className="grid min-w-0 gap-2">
      <MobilePicker
        open={open}
        onOpenChange={(next) => {
          if (next) setSearch("");
          setOpen(next);
        }}
      >
        <MobilePickerTrigger
          data-slot="tags-picker-trigger"
          render={
            <Button
              type="button"
              variant="outline"
              className="w-full justify-start gap-2 overflow-hidden font-normal"
              disabled={disabled}
              aria-invalid={invalid}
              aria-label={
                selected.length
                  ? `Selecionar etiquetas: ${selected.length} selecionadas`
                  : "Selecionar etiquetas"
              }
            />
          }
        >
          <Tag aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1 truncate text-left">
            {selected.length
              ? `${selected.length} ${selected.length === 1 ? "etiqueta selecionada" : "etiquetas selecionadas"}`
              : emptyLabel}
          </span>
          <ChevronDown aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
        </MobilePickerTrigger>
        <MobilePickerContent title="Etiquetas" align="start" className="min-w-64 gap-2 p-3">
          <Input
            aria-label="Buscar etiquetas"
            placeholder="Buscar etiquetas"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <div className="grid max-h-56 gap-1 overflow-y-auto">
            {visible.map((tag) => (
              <label
                className="flex items-center gap-2 rounded-md p-2 hover:bg-accent"
                htmlFor={`${id}-${tag.id}`}
                key={tag.id}
              >
                <Checkbox
                  id={`${id}-${tag.id}`}
                  disabled={
                    !selected.includes(tag.id) &&
                    maximum !== undefined &&
                    selected.length >= maximum
                  }
                  checked={selected.includes(tag.id)}
                  onCheckedChange={(checked) =>
                    onChange(
                      checked === true
                        ? [...selected, tag.id]
                        : selected.filter((value) => value !== tag.id),
                    )
                  }
                />
                <TagColorIcon color={tag.color} />
                <span className="min-w-0 break-words text-sm">
                  {tag.name}
                  {tag.status === "inactive" ? (
                    <span className="text-muted-foreground"> (inativa)</span>
                  ) : null}
                </span>
              </label>
            ))}
            {!visible.length ? (
              <div className="grid justify-items-start gap-1 p-2" role="status">
                <p className="text-muted-foreground text-sm">
                  {tags.length ? "Nenhuma etiqueta encontrada." : "Nenhuma etiqueta cadastrada."}
                </p>
                {search.trim() ? (
                  <Button type="button" size="sm" variant="ghost" onClick={() => setSearch("")}>
                    Limpar busca
                  </Button>
                ) : null}
              </div>
            ) : null}
          </div>
          {selected.length ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onChange([])}
              type="button"
              disabled={disabled}
            >
              Limpar etiquetas
            </Button>
          ) : null}
          {onCreate ? (
            <div className="border-t pt-2">
              <Button
                className="w-full justify-start"
                variant="ghost"
                size="sm"
                type="button"
                disabled={disabled}
                onClick={() => {
                  setOpen(false);
                  onCreate();
                }}
              >
                <Plus aria-hidden="true" className="size-4" />
                Criar etiqueta…
              </Button>
            </div>
          ) : null}
        </MobilePickerContent>
      </MobilePicker>
      {selected.length ? (
        <div className="flex min-w-0 flex-wrap gap-1.5">
          {selected.map((tagId) => {
            const tag = tags.find((item) => item.id === tagId);
            const name = tag?.name ?? "Etiqueta indisponível";
            return (
              <Badge variant="secondary" className="h-auto max-w-full gap-1 py-1 pr-1" key={tagId}>
                <TagColorIcon className="size-3" color={tag?.color ?? "neutral"} />
                <span className="min-w-0 truncate" title={name}>
                  {name}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  className="size-6 shrink-0 rounded-full p-0"
                  aria-label={`Remover etiqueta ${name}`}
                  disabled={disabled}
                  onClick={() => onChange(selected.filter((value) => value !== tagId))}
                >
                  <X aria-hidden="true" className="size-3" />
                </Button>
              </Badge>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
