import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { useTransactionImportReview } from "../useTransactionImportReview";
import { TransactionImportReviewRow } from "./transaction-import-review-row";

import type { Props } from "./transaction-import-screen.types";

export function TransactionImportReviewTable({
  rows,
  setRows,
  selectableCategories,
  allAvailableSelected,
  people,
}: {
  rows: ReturnType<typeof useTransactionImportReview>["rows"];
  setRows: ReturnType<typeof useTransactionImportReview>["setRows"];
  selectableCategories: ReturnType<typeof useTransactionImportReview>["selectableCategories"];
  allAvailableSelected: ReturnType<typeof useTransactionImportReview>["allAvailableSelected"];
  people: Props["people"];
}) {
  return (
    <Card className="gap-0 border py-0" size="sm">
      <CardHeader className="border-b py-4">
        <CardTitle>Lançamentos do arquivo</CardTitle>
        <CardDescription>Selecione e revise os dados antes de importar.</CardDescription>
        <CardAction>
          <Badge variant="outline">{rows.length} lançamentos</Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="max-h-128 overflow-auto px-0">
        <Table className="min-w-230">
          <TableHeader className="sticky top-0 z-10 bg-background">
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  aria-label="Selecionar todos"
                  checked={allAvailableSelected}
                  onCheckedChange={(checked) =>
                    setRows((current) =>
                      current.map((row) => (row.isDuplicate ? row : { ...row, selected: checked })),
                    )
                  }
                />
              </TableHead>
              <TableHead className="w-28">Data</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead className="w-56">Pessoa</TableHead>
              <TableHead className="w-48">Categoria</TableHead>
              <TableHead className="w-24">Tipo</TableHead>
              <TableHead className="w-32 text-right">Valor</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, index) => (
              <TransactionImportReviewRow
                key={row.rowKey}
                row={row}
                index={index}
                setRows={setRows}
                selectableCategories={selectableCategories}
                people={people}
              />
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
