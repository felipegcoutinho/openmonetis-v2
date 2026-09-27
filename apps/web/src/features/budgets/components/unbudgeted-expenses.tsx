import type { BudgetOverviewOutput } from "@openmonetis/validators/budgets";
import type { CategoryOutput } from "@openmonetis/validators/categories";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { MoneyValue } from "@/components/money-value";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type UnbudgetedExpensesProps = {
  overview: BudgetOverviewOutput;
  categories: CategoryOutput[];
  onCreate: (categoryId: string) => void;
};

export function UnbudgetedExpenses({ overview, categories, onCreate }: UnbudgetedExpensesProps) {
  const [open, setOpen] = useState(false);
  if (overview.unbudgetedCommittedAmount <= 0) return null;

  return (
    <Card className="gap-3 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-medium">
            <MoneyValue amount={overview.unbudgetedCommittedAmount} /> em despesas sem orçamento
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Veja as categorias e escolha onde definir limites.
          </p>
        </div>
        <Button onClick={() => setOpen(true)} variant="outline">
          Ver categorias
        </Button>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Despesas sem orçamento</DialogTitle>
            <DialogDescription>
              Lançamentos e recorrências previstas no mês, fora das categorias acompanhadas.
            </DialogDescription>
          </DialogHeader>
          <ul className="max-h-96 overflow-y-auto divide-y">
            {overview.unbudgetedItems.map((item) => {
              const category = categories.find((category) => category.id === item.categoryId);
              return (
                <li
                  key={item.categoryId ?? "uncategorized"}
                  className="flex flex-wrap items-center justify-between gap-3 py-3"
                >
                  <div>
                    <p className="text-sm font-medium">
                      {category?.name ??
                        (item.categoryId ? "Categoria indisponível" : "Sem categoria")}
                    </p>
                    <MoneyValue
                      amount={item.committedAmount}
                      className="text-sm text-muted-foreground"
                    />
                    {!item.categoryId ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Categorize os lançamentos para definir um limite.
                      </p>
                    ) : null}
                  </div>
                  {category?.type === "expense" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setOpen(false);
                        onCreate(category.id);
                      }}
                    >
                      Definir limite
                    </Button>
                  ) : !item.categoryId ? (
                    <Button asChild size="sm" variant="outline">
                      <Link
                        to="/transactions"
                        search={{ period: overview.period, type: "expense" }}
                      >
                        Ver lançamentos do mês
                      </Link>
                    </Button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
