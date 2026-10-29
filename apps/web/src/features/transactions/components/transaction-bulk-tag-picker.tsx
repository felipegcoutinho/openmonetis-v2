import type { TagOutput } from "@openmonetis/validators/tags";
import { Loader2, Minus, Plus, Tag } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  MobilePicker,
  MobilePickerContent,
  MobilePickerTrigger,
} from "@/components/forms/mobile-picker";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

type TagOperation = "add" | "remove";

const operations = {
  add: { label: "Adicionar", icon: Plus, verb: "Adiciona a" },
  remove: { label: "Remover", icon: Minus, verb: "Remove de" },
} satisfies Record<TagOperation, { label: string; icon: typeof Plus; verb: string }>;

export function TransactionBulkTagPicker({
  blockedReason,
  busy,
  pending,
  tags,
  targetCount,
  onSelect,
}: {
  blockedReason: string | null;
  busy: boolean;
  pending: boolean;
  tags: TagOutput[];
  targetCount: number;
  onSelect: (tagId: string, operation: TagOperation) => void;
}) {
  const [open, setOpen] = useState(false);
  const [operation, setOperation] = useState<TagOperation>("add");
  const OperationIcon = operations[operation].icon;

  return (
    <MobilePicker
      open={open}
      onOpenChange={(next) => {
        if (next && blockedReason) {
          toast.info(blockedReason);
          return;
        }
        if (next) setOperation("add");
        setOpen(next);
      }}
    >
      <MobilePickerTrigger
        render={
          <Button
            aria-expanded={open}
            aria-label="Etiquetas"
            aria-disabled={Boolean(blockedReason)}
            className="aria-disabled:opacity-50"
            disabled={busy}
            size="icon-sm"
            type="button"
            variant="ghost"
          />
        }
      >
        {pending ? (
          <Loader2 aria-hidden="true" className="animate-spin" />
        ) : (
          <Tag aria-hidden="true" />
        )}
      </MobilePickerTrigger>
      <MobilePickerContent
        align="start"
        className="w-[min(18rem,calc(100vw-2rem))] gap-0 overflow-hidden p-0"
        side="top"
        title="Etiquetas"
      >
        <Tabs
          className="p-2 pb-0"
          onValueChange={(value) => setOperation(value as TagOperation)}
          value={operation}
        >
          <TabsList aria-label="Ação com a etiqueta" className="h-8! w-full">
            {(["add", "remove"] as const).map((value) => {
              const Icon = operations[value].icon;
              return (
                <TabsTrigger className="text-xs" key={value} value={value}>
                  <Icon aria-hidden="true" className="size-3.5" />
                  {operations[value].label}
                </TabsTrigger>
              );
            })}
          </TabsList>
        </Tabs>
        <Command className="rounded-none">
          <CommandInput
            aria-label="Buscar etiqueta"
            className="h-10 text-base md:text-sm"
            placeholder="Buscar etiqueta"
          />
          <CommandList className="max-h-60 p-1">
            <CommandEmpty>Nenhuma etiqueta encontrada.</CommandEmpty>
            <CommandGroup className="p-0">
              {tags.map((tag) => (
                <CommandItem
                  className="min-h-11 gap-2 md:min-h-9"
                  key={tag.id}
                  onSelect={() => {
                    setOpen(false);
                    onSelect(tag.id, operation);
                  }}
                  value={`${tag.name} ${tag.id}`}
                >
                  <Tag aria-hidden="true" className="size-4 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate">{tag.name}</span>
                  <OperationIcon
                    aria-hidden="true"
                    className={cn(
                      "size-4 opacity-0 transition-opacity group-data-[selected=true]/command-item:opacity-100",
                      operation === "remove" ? "text-destructive" : "text-muted-foreground",
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
        <p className="border-t px-3 py-2 text-muted-foreground text-xs">
          {operations[operation].verb} {targetCount} lançamento{targetCount === 1 ? "" : "s"}
        </p>
      </MobilePickerContent>
    </MobilePicker>
  );
}
