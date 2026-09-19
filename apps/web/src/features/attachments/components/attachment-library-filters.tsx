import type { PaginatedAttachmentsOutput } from "@openmonetis/validators/attachments";
import { FileImage, FileText, Paperclip, UserRound, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AttachmentsSearch } from "../attachments.presentation";

type AttachmentLibraryFiltersProps = {
  counts: PaginatedAttachmentsOutput["counts"];
  people: PaginatedAttachmentsOutput["people"];
  search: AttachmentsSearch;
  onSearchChange: (search: Partial<AttachmentsSearch>) => void;
};

const allPeopleValue = "all";

export function AttachmentLibraryFilters({
  counts,
  people,
  search,
  onSearchChange,
}: AttachmentLibraryFiltersProps) {
  const hasFilters = Boolean(search.q || search.kind || search.personId);
  const typeFilters = [
    { value: undefined, label: "Todos", count: counts.all, icon: Paperclip },
    { value: "image" as const, label: "Imagens", count: counts.images, icon: FileImage },
    { value: "pdf" as const, label: "PDFs", count: counts.pdfs, icon: FileText },
  ];

  return (
    <fieldset aria-label="Filtros de anexos" className="flex min-w-0 flex-wrap items-center gap-2">
      <Input
        className="w-full sm:w-64"
        aria-label="Buscar anexos"
        placeholder="Buscar arquivo ou lançamento"
        value={search.q ?? ""}
        onChange={(event) =>
          onSearchChange({ q: event.target.value || undefined, page: undefined })
        }
      />
      <Select
        onValueChange={(value) =>
          onSearchChange({
            personId: value && value !== allPeopleValue ? value : undefined,
            page: undefined,
          })
        }
        value={search.personId ?? allPeopleValue}
      >
        <SelectTrigger className="min-w-44 flex-1 sm:flex-none" size="sm">
          <UserRound aria-hidden="true" className="text-muted-foreground" />
          <SelectValue placeholder="Pessoa">
            {search.personId
              ? (people.find((person) => person.id === search.personId)?.name ?? "Pessoa")
              : "Todas as pessoas"}
          </SelectValue>
        </SelectTrigger>
        <SelectContent align="end">
          <SelectItem value={allPeopleValue}>Todas as pessoas</SelectItem>
          {people.map((person) => (
            <SelectItem key={person.id} value={person.id}>
              {person.name} ({person.count})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="flex items-center gap-1 rounded-lg border bg-background p-1">
        {typeFilters.map(({ value, label, count, icon: Icon }) => {
          const selected = search.kind === value;

          return (
            <Button
              aria-label={`${label}: ${count}`}
              aria-pressed={selected}
              className="gap-1.5"
              key={label}
              onClick={() => onSearchChange({ kind: value, page: undefined })}
              size="sm"
              type="button"
              variant={selected ? "secondary" : "ghost"}
            >
              <Icon aria-hidden="true" />
              <span className="hidden sm:inline">{label}</span>
              <span className="text-xs tabular-nums opacity-70">{count}</span>
            </Button>
          );
        })}
      </div>

      {hasFilters ? (
        <Button
          aria-label="Limpar filtros"
          onClick={() => {
            onSearchChange({
              q: undefined,
              kind: undefined,
              personId: undefined,
              page: undefined,
            });
          }}
          size="icon-sm"
          title="Limpar filtros"
          type="button"
          variant="ghost"
        >
          <X aria-hidden="true" />
        </Button>
      ) : null}
    </fieldset>
  );
}
