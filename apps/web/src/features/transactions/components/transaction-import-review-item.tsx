import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/money-presentation";
import { cn } from "@/lib/utils";
import type { useTransactionImportReview } from "../useTransactionImportReview";
import { RowCategorySelect } from "./transaction-import-category-select";
import { RowSelect } from "./transaction-import-person-select";
import { updateRow } from "./transaction-import-review";
import type { Props, ReviewRow } from "./transaction-import-screen.types";
import { formatDate } from "./transaction-import-screen-options";
import { TransactionTypeBadge } from "./transaction-type-badge";

/** Phone layout of a review row: the same fields as the table, stacked in one card. */
export function TransactionImportReviewItem({
  row,
  index,
  setRows,
  selectableCategories,
  people,
}: {
  row: ReviewRow;
  index: number;
  setRows: ReturnType<typeof useTransactionImportReview>["setRows"];
  selectableCategories: ReturnType<typeof useTransactionImportReview>["selectableCategories"];
  people: Props["people"];
}) {
  const fieldId = `import-row-${row.rowKey}`;
  return (
    <li className={cn("grid gap-3 px-4 py-4", !row.selected && "opacity-60")}>
      <div className="flex items-start gap-3">
        <Checkbox
          aria-label={`Selecionar ${row.name}`}
          checked={row.selected}
          className="mt-1"
          disabled={row.isDuplicate}
          onCheckedChange={(checked) =>
            setRows((current) =>
              current.map((item, itemIndex) =>
                itemIndex === index ? { ...item, selected: checked } : item,
              ),
            )
          }
        />
        <div className="grid min-w-0 flex-1 gap-1">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="text-muted-foreground">{formatDate(row.purchaseDate)}</span>
            <span
              className={cn("font-medium tabular-nums", row.type === "income" && "text-success")}
            >
              {formatCurrency(row.type === "expense" ? -row.amount : row.amount)}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <TransactionTypeBadge type={row.type} />
            {row.isDuplicate ? <Badge variant="outline">Já importado</Badge> : null}
          </div>
        </div>
      </div>
      <div className="grid gap-1.5">
        <label className="text-muted-foreground text-xs" htmlFor={`${fieldId}-name`}>
          Descrição
        </label>
        <Input
          disabled={!row.selected}
          enterKeyHint="done"
          id={`${fieldId}-name`}
          onChange={(event) => updateRow(setRows, index, { name: event.target.value })}
          value={row.name}
        />
      </div>
      <div className="grid grid-cols-2 gap-3 [&_[data-slot=select-trigger]]:w-full">
        <div className="grid min-w-0 gap-1.5">
          <span className="text-muted-foreground text-xs">Pessoa</span>
          <RowSelect
            disabled={!row.selected}
            onChange={(personId) => updateRow(setRows, index, { personId })}
            people={people}
            value={row.personId}
          />
        </div>
        <div className="grid min-w-0 gap-1.5">
          <span className="text-muted-foreground text-xs">Categoria</span>
          <RowCategorySelect
            categories={selectableCategories.filter((category) => category.type === row.type)}
            disabled={!row.selected}
            onChange={(categoryId) => updateRow(setRows, index, { categoryId })}
            value={row.categoryId}
          />
        </div>
      </div>
    </li>
  );
}
