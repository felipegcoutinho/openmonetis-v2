import { useQuery } from "@tanstack/react-query";
import { Tag } from "lucide-react";
import { FilterChip } from "@/features/transactions/components/transaction-filter-chip";
import { FilterToggle } from "@/features/transactions/components/transaction-filter-toggle";
import {
  parseFilterSlugs,
  serializeFilterSlugs,
  type TransactionsSearch,
} from "@/features/transactions/transactions.presentation";
import { tagsQueryOptions } from "../tags.queries";
import { TagsPicker } from "./tags-picker";
export function TagsFilter({
  search,
  onChange,
  chips = false,
}: {
  search: TransactionsSearch;
  onChange: (next: Partial<TransactionsSearch>) => void;
  chips?: boolean;
}) {
  const query = useQuery(tagsQueryOptions());
  const tags = query.data ?? [];
  const slugs = parseFilterSlugs(search.tags);
  if (chips)
    return (
      <>
        {search.withoutTags ? (
          <FilterChip
            icon={Tag}
            label="Sem etiquetas"
            onRemove={() => onChange({ withoutTags: undefined, page: undefined })}
          />
        ) : null}
        {slugs.map((slug) => (
          <FilterChip
            key={slug}
            icon={Tag}
            label={`Etiqueta: ${tags.find((tag) => tag.id === slug)?.name ?? "Indisponível"}`}
            onRemove={() =>
              onChange({
                tags: serializeFilterSlugs(slugs.filter((value) => value !== slug)),
                page: undefined,
              })
            }
          />
        ))}
      </>
    );
  return (
    <div className="grid gap-2 sm:col-span-2">
      <span className="font-medium text-muted-foreground text-xs">Etiquetas</span>
      <FilterToggle
        checked={Boolean(search.withoutTags)}
        label="Sem etiquetas"
        onChange={(checked) =>
          onChange({ withoutTags: checked ? true : undefined, tags: undefined, page: undefined })
        }
      />
      <TagsPicker
        includeInactive
        tags={tags}
        selected={slugs}
        disabled={query.isPending || query.isError || Boolean(search.withoutTags)}
        emptyLabel="Todas"
        onChange={(ids) =>
          onChange({
            tags: serializeFilterSlugs(ids),
            withoutTags: undefined,
            page: undefined,
          })
        }
      />
      <p className="text-muted-foreground text-xs">
        {search.withoutTags
          ? "Exibe somente lançamentos que ainda não possuem etiquetas."
          : "Exibe lançamentos com pelo menos uma das etiquetas selecionadas."}
      </p>
    </div>
  );
}
