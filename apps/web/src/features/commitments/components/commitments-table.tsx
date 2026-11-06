import type { CommitmentsOutput } from "@openmonetis/validators/commitments";
import { MoneyValue } from "@/components/money-value";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatPeriod } from "@/lib/period-presentation";
import { cn } from "@/lib/utils";
import {
  commitmentStatusClassName,
  commitmentStatusLabel,
  commitmentStatusVariant,
  formatCommitmentPercentage,
} from "../commitments.presentation";

export function CommitmentsTable({ report }: { report: CommitmentsOutput }) {
  const hasCredits = report.months.some((month) => month.creditsAmount > 0);
  return (
    <Card className="gap-0 overflow-x-auto py-0 shadow-none">
      <Table aria-label="Compromissos por mês">
        <TableHeader>
          <TableRow>
            <TableHead className="font-mono">Mês</TableHead>
            <TableHead className="font-mono text-right">Parcelas</TableHead>
            <TableHead className="font-mono text-right">Recorrentes</TableHead>
            <TableHead className="font-mono text-right">Contas avulsas</TableHead>
            {hasCredits ? (
              <TableHead className="font-mono text-right">Estornos e descontos</TableHead>
            ) : null}
            <TableHead className="font-mono text-right">Comprometido</TableHead>
            <TableHead className="font-mono text-right">Receita prevista</TableHead>
            <TableHead className="font-mono text-right">Folga</TableHead>
            <TableHead className="font-mono text-right">% da receita</TableHead>
            <TableHead className="font-mono">Situação</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {report.months.map((month) => (
            <TableRow key={month.period}>
              <TableHead scope="row">{formatPeriod(month.period)}</TableHead>
              <TableCell className="text-right">
                <MoneyValue amount={month.installmentsAmount} />
              </TableCell>
              <TableCell className="text-right">
                <MoneyValue amount={month.recurringAmount} />
              </TableCell>
              <TableCell className="text-right">
                <MoneyValue amount={month.billsAmount} />
              </TableCell>
              {hasCredits ? (
                <TableCell className="text-right">
                  <MoneyValue amount={-month.creditsAmount} />
                </TableCell>
              ) : null}
              <TableCell className="text-right font-medium">
                <MoneyValue amount={month.committedAmount} />
              </TableCell>
              <TableCell className="text-right">
                <MoneyValue amount={month.incomeAmount} />
              </TableCell>
              <TableCell className="text-right">
                <MoneyValue
                  amount={month.freeAmount}
                  className={cn(month.freeAmount < 0 && "text-destructive")}
                />
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatCommitmentPercentage(month.commitmentPercentage)}
              </TableCell>
              <TableCell>
                <Badge
                  className={commitmentStatusClassName(month.status)}
                  variant={commitmentStatusVariant(month.status)}
                >
                  {commitmentStatusLabel(month.status)}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}
