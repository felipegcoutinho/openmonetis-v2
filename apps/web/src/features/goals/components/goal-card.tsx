import type { GoalOutput, UpdateGoalInput } from "@openmonetis/validators/goals";
import {
  Archive,
  Check,
  Ellipsis,
  Goal,
  Pause,
  Pencil,
  Play,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { MoneyValue } from "@/components/money-value";
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
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { formatGoalDate, goalPaceLabels, goalStatusLabels } from "../goals.presentation";
import { GoalAccountLogo } from "./goal-account-logo";

type GoalCardProps = {
  goal: GoalOutput;
  busy: boolean;
  onEdit: (goal: GoalOutput) => void;
  onUpdate: (id: string, input: UpdateGoalInput) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
};

export function GoalCard({ goal, busy, onEdit, onUpdate, onRemove }: GoalCardProps) {
  const [removeOpen, setRemoveOpen] = useState(false);
  const statusAction =
    goal.status === "active"
      ? { label: "Pausar", icon: Pause, status: "paused" as const }
      : goal.status === "paused"
        ? { label: "Retomar", icon: Play, status: "active" as const }
        : goal.status === "archived"
          ? { label: "Restaurar", icon: RotateCcw, status: "active" as const }
          : null;

  return (
    <Card className="h-full gap-5 border">
      <CardHeader className="gap-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand/10 text-brand-strong">
              <Goal aria-hidden="true" className="size-5" />
            </span>
            <div className="min-w-0">
              <CardTitle className="truncate">{goal.name}</CardTitle>
              <p className="mt-0.5 flex items-center gap-1.5 text-muted-foreground text-xs">
                {goal.trackingType === "account" ? (
                  <>
                    <GoalAccountLogo
                      logo={goal.accountLogo}
                      name={goal.accountName ?? "Conta"}
                      size={18}
                    />
                    <span className="truncate">Saldo de {goal.accountName}</span>
                  </>
                ) : (
                  "Acompanhamento manual"
                )}
              </p>
            </div>
          </div>
          <Badge variant="secondary">{goalStatusLabels[goal.status]}</Badge>
        </div>
      </CardHeader>
      <CardContent className="grid flex-1 content-start gap-5">
        <div>
          <p className="text-muted-foreground text-xs">Valor economizado</p>
          <p className="mt-1 text-2xl font-medium">
            <MoneyValue amount={goal.currentAmount} />{" "}
            <span className="text-sm text-muted-foreground">
              de <MoneyValue amount={goal.targetAmount} />
            </span>
          </p>
          <p className="mt-2 text-muted-foreground text-sm">
            {goal.status === "completed" && goal.remainingAmount > 0 ? (
              "Concluída antes do valor alvo"
            ) : goal.remainingAmount > 0 ? (
              <>
                Faltam <MoneyValue amount={goal.remainingAmount} />
              </>
            ) : (
              "Objetivo alcançado"
            )}
          </p>
        </div>
        <div className="grid gap-2">
          <div className="flex justify-between text-xs">
            <span className="font-medium tabular-nums">
              {goal.progressPercentage.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%
            </span>
            <span className="text-muted-foreground">
              {goal.targetDate ? `Até ${formatGoalDate(goal.targetDate)}` : "Sem prazo"}
            </span>
          </div>
          <Progress
            aria-label={`${goal.progressPercentage}% da meta ${goal.name} alcançada`}
            indicatorClassName={cn(
              goal.paceStatus === "overdue" || goal.paceStatus === "behind"
                ? "bg-warning"
                : "bg-brand",
            )}
            value={Math.min(goal.progressPercentage, 100)}
          />
          <p
            className={cn(
              "min-h-4 text-xs",
              goal.paceStatus === "overdue" || goal.paceStatus === "behind"
                ? "text-warning"
                : "text-muted-foreground",
            )}
          >
            {goal.paceStatus ? goalPaceLabels[goal.paceStatus] : "\u00a0"}
          </p>
        </div>
      </CardContent>
      <CardFooter className="mt-auto flex flex-wrap items-center gap-3 border-t pt-3">
        <button
          className="inline-flex items-center gap-1 rounded-sm px-1 py-0.5 font-medium text-brand-strong text-sm transition-opacity hover:opacity-80 focus-visible:ring-3 focus-visible:ring-ring/50"
          disabled={busy}
          onClick={() => onEdit(goal)}
          type="button"
        >
          <Pencil aria-hidden="true" className="size-3.5" /> Editar
        </button>
        {statusAction ? (
          <button
            className="inline-flex items-center gap-1 rounded-sm px-1 py-0.5 font-medium text-brand-strong text-sm transition-opacity hover:opacity-80 focus-visible:ring-3 focus-visible:ring-ring/50"
            disabled={busy}
            onClick={() => void onUpdate(goal.id, { status: statusAction.status })}
            type="button"
          >
            <statusAction.icon aria-hidden="true" className="size-3.5" /> {statusAction.label}
          </button>
        ) : null}
        <DropdownMenu>
          <DropdownMenuTrigger
            disabled={busy}
            render={
              <button
                aria-label={`Mais ações para ${goal.name}`}
                className="ml-auto inline-flex items-center rounded-sm px-1 py-0.5 text-muted-foreground transition-opacity hover:opacity-80 focus-visible:ring-3 focus-visible:ring-ring/50"
                type="button"
              />
            }
          >
            <Ellipsis aria-hidden="true" className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-44">
            {goal.status === "active" || goal.status === "paused" ? (
              <DropdownMenuItem onClick={() => void onUpdate(goal.id, { status: "completed" })}>
                <Check aria-hidden="true" /> Concluir
              </DropdownMenuItem>
            ) : null}
            {goal.status !== "archived" ? (
              <DropdownMenuItem onClick={() => void onUpdate(goal.id, { status: "archived" })}>
                <Archive aria-hidden="true" /> Arquivar
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setRemoveOpen(true)} variant="destructive">
              <Trash2 aria-hidden="true" /> Excluir meta
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardFooter>
      <AlertDialog onOpenChange={setRemoveOpen} open={removeOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir meta?</AlertDialogTitle>
            <AlertDialogDescription>
              A meta “{goal.name}” será excluída. O saldo da conta e os lançamentos não serão
              alterados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={() => {
                void onRemove(goal.id)
                  .then(() => setRemoveOpen(false))
                  .catch(() => {});
              }}
              variant="destructive"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
