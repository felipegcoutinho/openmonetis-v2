import type { TagOutput, TagsReportOutput } from "@openmonetis/validators/tags";
import { Link } from "@tanstack/react-router";
import { Archive, ArchiveRestore, ArrowUpRight, Pencil, Trash2 } from "lucide-react";
import { MoneyValue } from "@/components/money-value";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDashboardTransactionCount } from "@/features/dashboard/dashboard.presentation";
import { cn } from "@/lib/utils";
import { tagColorTokens } from "../tags.presentation";
import { TagColorIcon } from "./tag-color-icon";

const reportColumns = [
  { key: "income", label: "Receitas" },
  { key: "expenses", label: "Despesas" },
  { key: "transfers", label: "Transferências" },
  { key: "balance", label: "Resultado" },
] as const;

export function TagsList({
  tags,
  period,
  report,
  loading,
  onEdit,
  onRemove,
  onToggleStatus,
  pendingTagId,
}: {
  tags: TagOutput[];
  period: string;
  report: TagsReportOutput | undefined;
  loading: boolean;
  onEdit: (tag: TagOutput) => void;
  onRemove: (tag: TagOutput) => void;
  onToggleStatus: (tag: TagOutput) => void;
  pendingTagId: string | null;
}) {
  const totalsByTag = new Map(report?.items.map((item) => [item.tagId, item]));
  function tagLink(tag: TagOutput) {
    return (
      <Link
        className="group/tag inline-flex min-w-0 items-center gap-2.5 rounded-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        to="/transactions"
        search={{ period, tags: tag.id }}
        title="Ver lançamentos com esta etiqueta"
      >
        <span
          className="grid size-8 shrink-0 place-items-center rounded-full"
          style={{
            backgroundColor: `color-mix(in srgb, ${tagColorTokens[tag.color]} 16%, transparent)`,
          }}
        >
          <TagColorIcon color={tag.color} />
        </span>
        <span className="grid min-w-0">
          <span className="[overflow-wrap:anywhere] group-hover/tag:underline">{tag.name}</span>
          <span className="font-normal text-muted-foreground text-xs">
            {transactionCountLabel(tag.id)}
          </span>
        </span>
        <ArrowUpRight
          aria-hidden="true"
          className="size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover/tag:opacity-100 group-focus-visible/tag:opacity-100"
        />
      </Link>
    );
  }
  function tagActions(tag: TagOutput) {
    return (
      <div className="flex shrink-0 items-center justify-end gap-1">
        <Button
          variant="ghost"
          size="icon-sm"
          className="max-md:size-11"
          aria-label={`Editar ${tag.name}`}
          onClick={() => onEdit(tag)}
        >
          <Pencil aria-hidden="true" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          className="max-md:size-11"
          aria-label={`${tag.status === "active" ? "Inativar" : "Reativar"} ${tag.name}`}
          disabled={pendingTagId === tag.id}
          onClick={() => onToggleStatus(tag)}
          title={tag.status === "active" ? "Inativar" : "Reativar"}
        >
          {tag.status === "active" ? (
            <Archive aria-hidden="true" />
          ) : (
            <ArchiveRestore aria-hidden="true" />
          )}
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          className="max-md:size-11"
          aria-label={`Excluir ${tag.name}`}
          onClick={() => onRemove(tag)}
        >
          <Trash2 aria-hidden="true" className="text-destructive" />
        </Button>
      </div>
    );
  }
  function transactionCountLabel(tagId: string) {
    const totals = totalsByTag.get(tagId);
    if (!totals) return loading ? "Carregando..." : "";
    return totals.transactionCount
      ? `${formatDashboardTransactionCount(totals.transactionCount)} no mês`
      : "Sem lançamentos no mês";
  }
  function reportValue(tagId: string, key: (typeof reportColumns)[number]["key"]) {
    const totals = totalsByTag.get(tagId);
    if (!totals) {
      return loading ? (
        <Skeleton className="mx-auto h-4 w-20 max-md:mr-0" />
      ) : (
        <span className="text-muted-foreground text-sm">Indisponível</span>
      );
    }
    const amount = totals[key];
    return (
      <MoneyValue
        amount={amount}
        className={cn(
          amount === 0 && "text-muted-foreground",
          key === "balance" && "font-medium",
          key === "balance" && amount > 0 && "text-success",
          key === "balance" && amount < 0 && "text-destructive",
        )}
      />
    );
  }
  return (
    <>
      <ul className="grid min-w-0 gap-3 md:hidden" aria-label="Etiquetas">
        {tags.map((tag) => (
          <li className="min-w-0" key={tag.id}>
            <Card className="min-w-0 gap-3 p-4">
              <div className="flex min-w-0 items-center justify-between gap-2">
                {tagLink(tag)}
                {tagActions(tag)}
              </div>
              <dl className="grid gap-2">
                {reportColumns.map(({ key, label }) => (
                  <div className="flex items-baseline justify-between gap-3" key={key}>
                    <dt className="text-muted-foreground text-sm">{label}</dt>
                    <dd>{reportValue(tag.id, key)}</dd>
                  </div>
                ))}
              </dl>
            </Card>
          </li>
        ))}
      </ul>
      <Card className="hidden min-w-0 overflow-hidden py-2 md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Etiqueta</TableHead>
              {reportColumns.map(({ key, label }) => (
                <TableHead className="text-center" key={key}>
                  {label}
                </TableHead>
              ))}
              <TableHead className="w-32 text-right">
                <span className="sr-only">Ações</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tags.map((tag) => (
              <TableRow key={tag.id}>
                <TableCell className="max-w-72">{tagLink(tag)}</TableCell>
                {reportColumns.map(({ key }) => (
                  <TableCell className="text-center" key={key}>
                    {reportValue(tag.id, key)}
                  </TableCell>
                ))}
                <TableCell>{tagActions(tag)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
