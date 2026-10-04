import type { ExternalExpenseOutput } from "@openmonetis/validators/external-expenses";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import { ExternalExpenseRow } from "./external-expense-row";

export function ExternalExpensesTable({
  importPending,
  items,
  onImport,
  onReview,
  onPageChange,
  page,
  total,
  totalPages,
}: {
  importPending: boolean;
  items: ExternalExpenseOutput[];
  onImport: (item: ExternalExpenseOutput) => void;
  onReview: (item: ExternalExpenseOutput) => void;
  onPageChange: (page: number) => void;
  page: number;
  total: number;
  totalPages: number;
}) {
  return (
    <Card className="py-2">
      <CardContent className="px-2 sm:px-4">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Estabelecimento</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Condição</TableHead>
                <TableHead>Forma de pagamento</TableHead>
                <TableHead>Pessoa</TableHead>
                <TableHead>Conta/Cartão</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <ExternalExpenseRow
                  importPending={importPending}
                  item={item}
                  key={item.id}
                  onImport={() => onImport(item)}
                  onReview={() => onReview(item)}
                />
              ))}
            </TableBody>
          </Table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t px-1 pt-3 text-muted-foreground text-sm">
          <span>
            {total} {total === 1 ? "lançamento" : "lançamentos"}
          </span>
          {totalPages > 1 ? (
            <div className="flex items-center gap-2">
              <Button
                aria-label="Página anterior"
                disabled={page <= 1}
                onClick={() => onPageChange(page - 1)}
                size="icon-sm"
                variant="outline"
              >
                <ChevronLeft aria-hidden="true" />
              </Button>
              <span>
                Página {page} de {totalPages}
              </span>
              <Button
                aria-label="Próxima página"
                disabled={page >= totalPages}
                onClick={() => onPageChange(page + 1)}
                size="icon-sm"
                variant="outline"
              >
                <ChevronRight aria-hidden="true" />
              </Button>
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
