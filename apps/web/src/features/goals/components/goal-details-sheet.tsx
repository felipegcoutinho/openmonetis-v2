import type { GoalContributionOutput, GoalOutput } from "@openmonetis/validators/goals";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Plus,
  RefreshCw,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import { MoneyValue } from "@/components/money-value";
import { usePrivacyMode } from "@/components/privacy-provider";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useDeleteGoalContributionMutation } from "../goals.mutations";
import {
  acceptsGoalContributions,
  formatGoalDate,
  formatGoalHistoryPeriod,
  formatGoalShortDate,
  getGoalContributionErrorMessage,
  getGoalContributionLabel,
} from "../goals.presentation";
import { goalContributionsQueryOptions } from "../goals.queries";

const chartConfig = {
  balance: { label: "Saldo", color: "var(--chart-balance)" },
} satisfies ChartConfig;

const kindIcons = {
  deposit: <ArrowDownLeft aria-hidden="true" className="size-4 text-success" />,
  withdrawal: <ArrowUpRight aria-hidden="true" className="size-4 text-destructive" />,
  adjustment: <SlidersHorizontal aria-hidden="true" className="size-4 text-muted-foreground" />,
} satisfies Record<GoalContributionOutput["kind"], React.ReactNode>;

export function GoalDetailsSheet({
  goal,
  open,
  onOpenChange,
  onContribute,
}: {
  goal: GoalOutput;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onContribute: () => void;
}) {
  const { isPrivacyModeEnabled } = usePrivacyMode();
  const contributionsQuery = useQuery({
    ...goalContributionsQueryOptions(goal.id),
    enabled: open && goal.trackingType === "manual",
  });
  const deleteMutation = useDeleteGoalContributionMutation();
  const [removing, setRemoving] = useState<GoalContributionOutput | null>(null);
  const editable = acceptsGoalContributions(goal);
  const items = contributionsQuery.data?.items ?? [];
  const history = contributionsQuery.data?.history ?? [];

  async function removeContribution(contribution: GoalContributionOutput) {
    try {
      await deleteMutation.mutateAsync({ id: goal.id, contributionId: contribution.id });
      toast.success("Registro removido");
      setRemoving(null);
    } catch (error) {
      toast.error(getGoalContributionErrorMessage(error));
    }
  }

  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{goal.name}</SheetTitle>
          <SheetDescription>
            <MoneyValue amount={goal.currentAmount} /> de <MoneyValue amount={goal.targetAmount} />
            {goal.targetDate ? ` · até ${formatGoalDate(goal.targetDate)}` : ""}
          </SheetDescription>
        </SheetHeader>
        <SheetBody className="grid content-start gap-6">
          {goal.requiredMonthlyAmount ? (
            <p className="rounded-lg border bg-muted/40 px-3 py-2.5 text-sm">
              Guarde <MoneyValue amount={goal.requiredMonthlyAmount} className="font-medium" /> por
              mês para chegar ao objetivo no prazo.
            </p>
          ) : null}

          {goal.trackingType === "account" ? (
            <p className="text-muted-foreground text-sm">
              Esta meta acompanha o saldo de {goal.accountName ?? "uma conta"}. Os movimentos ficam
              no extrato da conta.
            </p>
          ) : contributionsQuery.isLoading ? (
            <div aria-label="Carregando histórico" className="grid gap-3" role="status">
              <Skeleton className="h-44" />
              <Skeleton className="h-12" />
              <Skeleton className="h-12" />
            </div>
          ) : contributionsQuery.isError ? (
            <div className="grid justify-items-start gap-3">
              <p className="text-sm">Não foi possível carregar o histórico.</p>
              <Button
                onClick={() => void contributionsQuery.refetch()}
                size="sm"
                type="button"
                variant="outline"
              >
                <RefreshCw aria-hidden="true" /> Tentar novamente
              </Button>
            </div>
          ) : (
            <>
              <section aria-labelledby={`${goal.id}-history`} className="grid gap-2">
                <h3 className="font-mono text-muted-foreground text-xs" id={`${goal.id}-history`}>
                  Evolução nos últimos 12 meses
                </h3>
                <ChartContainer
                  aria-label="Saldo da meta ao fim de cada mês"
                  className={cn(
                    "h-44 w-full transition-[filter]",
                    isPrivacyModeEnabled && "pointer-events-none blur-sm select-none",
                  )}
                  config={chartConfig}
                >
                  <AreaChart
                    accessibilityLayer
                    data={history}
                    // Side margins fit half of the first/last month label, which sit on the edges.
                    margin={{ left: 16, right: 16, top: 8 }}
                  >
                    <CartesianGrid vertical={false} />
                    <XAxis
                      axisLine={false}
                      dataKey="period"
                      interval={0}
                      tickFormatter={(value) => formatGoalHistoryPeriod(String(value))}
                      tickLine={false}
                      tickMargin={8}
                    />
                    <YAxis domain={[0, "auto"]} hide />
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          formatter={(value) => (
                            <div className="flex min-w-36 items-center justify-between gap-5">
                              <span className="text-muted-foreground">Saldo</span>
                              <MoneyValue amount={Number(value)} className="font-medium" />
                            </div>
                          )}
                          labelFormatter={(value) => formatGoalHistoryPeriod(String(value), true)}
                        />
                      }
                    />
                    <Area
                      dataKey="balance"
                      fill="var(--color-balance)"
                      fillOpacity={0.15}
                      stroke="var(--color-balance)"
                      strokeWidth={2}
                      type="monotone"
                    />
                  </AreaChart>
                </ChartContainer>
              </section>

              <section aria-labelledby={`${goal.id}-contributions`} className="grid gap-2">
                <div className="flex items-center justify-between gap-3">
                  <h3
                    className="font-mono text-muted-foreground text-xs"
                    id={`${goal.id}-contributions`}
                  >
                    Movimentos
                  </h3>
                  {editable ? (
                    <Button onClick={onContribute} size="sm" type="button" variant="outline">
                      <Plus aria-hidden="true" /> Aportar
                    </Button>
                  ) : null}
                </div>
                {items.length ? (
                  <ul className="divide-y rounded-lg border">
                    {items.map((contribution, index) => {
                      const label = getGoalContributionLabel(
                        contribution,
                        index === items.length - 1,
                      );
                      return (
                        <li
                          className="group/row flex items-center gap-3 px-3 py-2.5"
                          key={contribution.id}
                        >
                          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-muted">
                            {kindIcons[contribution.kind]}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm">{label}</p>
                            <p className="truncate text-muted-foreground text-xs">
                              {[formatGoalShortDate(contribution.date), contribution.note]
                                .filter(Boolean)
                                .join(" · ")}
                            </p>
                          </div>
                          <MoneyValue
                            amount={contribution.amount}
                            className="shrink-0 font-medium text-sm"
                            showPositiveSign
                          />
                          {editable ? (
                            <Button
                              aria-label={`Remover ${label.toLowerCase()} de ${formatGoalShortDate(contribution.date)}`}
                              className="transition-opacity duration-150 focus-visible:opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover/row:opacity-100"
                              onClick={() => setRemoving(contribution)}
                              size="icon-sm"
                              type="button"
                              variant="ghost"
                            >
                              <Trash2 aria-hidden="true" />
                            </Button>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="rounded-lg border border-dashed px-3 py-6 text-center text-muted-foreground text-sm">
                    Nenhum movimento registrado ainda.
                  </p>
                )}
              </section>
            </>
          )}
        </SheetBody>
      </SheetContent>

      <AlertDialog
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setRemoving(null);
        }}
        open={removing !== null}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover registro?</AlertDialogTitle>
            <AlertDialogDescription>
              O saldo da meta volta ao valor anterior a este movimento.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteMutation.isPending}
              onClick={() => {
                if (removing) void removeContribution(removing);
              }}
              variant="destructive"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sheet>
  );
}
