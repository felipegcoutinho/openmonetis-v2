import type { PersonOutput } from "@openmonetis/validators/people";
import type {
  PersonReportGroupOutput,
  PersonReportOutput,
  PersonReportScheduleStateOutput,
} from "@openmonetis/validators/person-reports";
import { useQuery } from "@tanstack/react-query";
import { Image } from "@unpic/react";
import {
  ArrowDownLeft,
  CalendarClock,
  CalendarRange,
  CreditCard,
  FileText,
  HandCoins,
  Info,
  Mail,
  Minus,
  ReceiptText,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { useState } from "react";
import { MoneyValue } from "@/components/money-value";
import { StatCard } from "@/components/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PersonBalanceIcon } from "@/features/person-settlements/components/person-balance-icon";
import {
  getPersonBalanceAmount,
  personBalanceLabel,
} from "@/features/person-settlements/person-settlements.presentation";
import { formatPeriod } from "@/lib/period-presentation";
import { cn } from "@/lib/utils";
import {
  describePersonReportCommitment,
  describePersonReportComparison,
  describePersonReportSchedule,
  formatPersonReportDate,
  formatPersonReportLineCount,
  formatPersonReportScheduleDate,
  getPersonReportEmailUnavailableReason,
  getPersonReportGroupLabel,
  getPersonReportLineAmount,
  getPersonReportLineTags,
  getPersonReportScheduleUnavailableReason,
  isPersonReportPartial,
} from "../person-reports.presentation";
import {
  personReportDeliveriesQueryOptions,
  personReportQueryOptions,
  personReportScheduleQueryOptions,
} from "../person-reports.queries";
import { PersonReportDeliveriesCard } from "./person-report-deliveries-card";
import { PersonReportDeliveryDialog } from "./person-report-delivery-dialog";
import { PersonReportPdfButton } from "./person-report-pdf-button";
import { PersonReportScheduleDialog } from "./person-report-schedule-dialog";

export function PersonReportPanel({ person, period }: { person: PersonOutput; period: string }) {
  const reportQuery = useQuery(personReportQueryOptions(person.id, period));
  const deliveriesQuery = useQuery(personReportDeliveriesQueryOptions(person.id));
  const scheduleQuery = useQuery(personReportScheduleQueryOptions(person.id));
  const [openDialog, setOpenDialog] = useState<"send" | "schedule" | null>(null);
  const closeDialog = (open: boolean) => {
    if (!open) setOpenDialog(null);
  };

  if (reportQuery.isLoading) return <PersonReportLoading />;
  if (reportQuery.isError || !reportQuery.data) {
    return (
      <Card>
        <CardContent className="py-8 text-destructive text-sm" role="alert">
          Não foi possível carregar o extrato.
        </CardContent>
      </Card>
    );
  }

  const report = reportQuery.data;
  const deliveries = deliveriesQuery.data;
  const emailEnabled = deliveries?.emailEnabled ?? scheduleQuery.data?.emailEnabled;
  const sendUnavailableReason =
    emailEnabled === undefined
      ? null
      : getPersonReportEmailUnavailableReason({
          emailEnabled,
          person,
          entryCount: report.entryCount,
        });
  const scheduleUnavailableReason =
    emailEnabled === undefined
      ? null
      : getPersonReportScheduleUnavailableReason({ emailEnabled, person });

  return (
    <div className="grid gap-4">
      <PersonReportSummary
        canSend={emailEnabled !== undefined && !sendUnavailableReason}
        notice={sendUnavailableReason}
        onConfigureSchedule={() => setOpenDialog("schedule")}
        onSend={() => setOpenDialog("send")}
        personId={person.id}
        report={report}
        schedule={scheduleQuery.data}
      />

      <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:items-start">
        <PersonReportEntries personName={person.name} report={report} />
        <div className="grid min-w-0 gap-4">
          <PersonReportDeliveriesCard
            deliveries={deliveries?.deliveries ?? []}
            isError={deliveriesQuery.isError}
          />
          <PersonReportCommitments commitments={report.commitments} />
          <PersonReportSettlements settlements={report.settlements} />
        </div>
      </div>

      {person.email && !sendUnavailableReason ? (
        <PersonReportDeliveryDialog
          onOpenChange={closeDialog}
          open={openDialog === "send"}
          period={period}
          person={{ id: person.id, name: person.name, email: person.email }}
        />
      ) : null}
      {scheduleQuery.data ? (
        <PersonReportScheduleDialog
          onOpenChange={closeDialog}
          open={openDialog === "schedule"}
          person={person}
          state={scheduleQuery.data}
          unavailableReason={scheduleUnavailableReason}
        />
      ) : null}
    </div>
  );
}

function PersonReportSummary({
  canSend,
  notice,
  onConfigureSchedule,
  onSend,
  personId,
  report,
  schedule,
}: {
  canSend: boolean;
  notice: string | null;
  onConfigureSchedule: () => void;
  onSend: () => void;
  personId: string;
  report: PersonReportOutput;
  schedule: PersonReportScheduleStateOutput | undefined;
}) {
  const activeSchedule = schedule?.schedule?.enabled ? schedule.schedule : null;
  const nextDelivery = schedule?.nextDeliveryDates[0];
  const { balance } = report;
  const partial = isPersonReportPartial(report.period);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="grid gap-1">
            <CardTitle className="flex items-center gap-2 text-lg">
              <FileText aria-hidden="true" className="size-4 text-brand-strong" />
              Extrato do mês
            </CardTitle>
            <CardDescription className="flex flex-wrap items-center gap-2 text-xs">
              {formatPeriod(report.period)}
              {partial ? <Badge variant="outline">Mês em aberto</Badge> : null}
            </CardDescription>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0">
            <PersonReportPdfButton
              disabled={report.entryCount === 0}
              period={report.period}
              personId={personId}
            />
            <Button disabled={!schedule} onClick={onConfigureSchedule} size="sm" variant="outline">
              <CalendarClock aria-hidden="true" />
              Envio automático
              {activeSchedule ? (
                <>
                  <span aria-hidden="true" className="size-1.5 rounded-full bg-success" />
                  <span className="sr-only">(ativo)</span>
                </>
              ) : null}
            </Button>
            <Button className="col-span-2" disabled={!canSend} onClick={onSend} size="sm">
              <Mail aria-hidden="true" />
              Enviar por e-mail
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <StatCard
            className="shadow-none"
            description={<PersonReportComparison comparison={report.comparison} />}
            icon={<CalendarRange />}
            label="Total do mês"
            value={<MoneyValue amount={balance.dueAmount} />}
          />
          <StatCard
            className="shadow-none"
            icon={<ArrowDownLeft />}
            label="Repasses recebidos"
            value={<MoneyValue amount={balance.settledAmount} />}
          />
          <StatCard
            className="shadow-none"
            icon={<PersonBalanceIcon status={balance.status} />}
            label={personBalanceLabel(balance.status)}
            value={<MoneyValue amount={getPersonBalanceAmount(balance)} />}
          />
        </div>
        {partial || notice || activeSchedule ? (
          <div className="grid gap-1.5 text-muted-foreground text-xs">
            {activeSchedule && schedule ? (
              <p className="flex items-start gap-1.5">
                <CalendarClock aria-hidden="true" className="mt-px size-3.5 shrink-0" />
                <span>
                  {[
                    `Envio automático: ${describePersonReportSchedule(activeSchedule).toLocaleLowerCase("pt-BR")}, às ${schedule.sendingHour}h`,
                    nextDelivery
                      ? `próximo em ${formatPersonReportScheduleDate(nextDelivery)}`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </p>
            ) : null}
            {partial ? (
              <p>O mês ainda está aberto: novos lançamentos podem mudar o extrato.</p>
            ) : null}
            {notice ? (
              <p className="flex items-start gap-1.5">
                <Info aria-hidden="true" className="mt-px size-3.5 shrink-0" />
                {notice}
              </p>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

const comparisonIcons = {
  up: TrendingUp,
  down: TrendingDown,
  equal: Minus,
  none: Minus,
} as const;

function PersonReportComparison({ comparison }: { comparison: PersonReportOutput["comparison"] }) {
  const { trend, text } = describePersonReportComparison(comparison);
  const TrendIcon = comparisonIcons[trend];
  return (
    <span className="flex items-center gap-1">
      <TrendIcon aria-hidden="true" className="size-3.5 shrink-0" />
      {text}
    </span>
  );
}

function PersonReportEntries({
  personName,
  report,
}: {
  personName: string;
  report: PersonReportOutput;
}) {
  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ReceiptText aria-hidden="true" className="size-4 text-brand-strong" />
          Lançamentos
        </CardTitle>
        <CardDescription className="text-xs">
          {formatPersonReportLineCount(report.entryCount)}, por cartão ou forma de pagamento.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {report.entryCount === 0 ? (
          <p className="rounded-md border border-dashed px-3 py-4 text-center text-muted-foreground text-sm">
            Nenhuma despesa de {personName} neste mês. Atribua lançamentos a esta pessoa ou divida
            uma despesa com ela para montar o extrato.
          </p>
        ) : (
          report.groups.map((group) => <PersonReportGroup group={group} key={group.key} />)
        )}
      </CardContent>
    </Card>
  );
}

function PersonReportGroup({ group }: { group: PersonReportGroupOutput }) {
  const GroupIcon = group.cardId ? CreditCard : ReceiptText;

  return (
    <section className="overflow-hidden rounded-lg border">
      <header className="flex items-center justify-between gap-3 border-b bg-muted/20 px-3 py-2.5">
        <span className="flex min-w-0 items-center gap-2.5">
          {group.cardLogo ? (
            <Image
              alt=""
              className="size-7 shrink-0 rounded-full object-contain"
              height={28}
              layout="fixed"
              src={group.cardLogo}
              width={28}
            />
          ) : (
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
              <GroupIcon aria-hidden="true" className="size-3.5" />
            </span>
          )}
          <span className="grid min-w-0">
            <span className="truncate font-medium text-sm">{getPersonReportGroupLabel(group)}</span>
            <span className="text-muted-foreground text-xs">
              {formatPersonReportLineCount(group.lines.length)}
              {group.dueDate ? ` · vence ${formatPersonReportDate(group.dueDate)}` : ""}
            </span>
          </span>
        </span>
        <MoneyValue amount={group.totalAmount} className="font-semibold text-sm" />
      </header>
      <ul className="divide-y">
        {group.lines.map((line) => {
          const tags = getPersonReportLineTags(line);
          const amount = getPersonReportLineAmount(line);

          return (
            <li
              className="grid grid-cols-[2.75rem_minmax(0,1fr)_auto] items-start gap-3 px-3 py-2.5"
              key={line.id}
            >
              <span className="pt-0.5 font-mono text-muted-foreground text-xs tabular-nums">
                {formatPersonReportDate(line.purchaseDate)}
              </span>
              <span className="grid min-w-0 gap-1">
                <span className="line-clamp-2 break-words text-sm">{line.name}</span>
                <span className="flex min-w-0 flex-wrap items-center gap-1.5 text-muted-foreground text-xs">
                  <span className="truncate">{line.categoryName ?? "Sem categoria"}</span>
                  {tags.map((tag) => (
                    <Badge
                      className={cn(tag === "Estorno" && "text-success")}
                      key={tag}
                      variant="outline"
                    >
                      {tag}
                    </Badge>
                  ))}
                </span>
              </span>
              <MoneyValue
                amount={amount}
                className={cn("font-semibold text-sm", amount < 0 && "text-success")}
              />
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function PersonReportCommitments({
  commitments,
}: {
  commitments: PersonReportOutput["commitments"];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarRange aria-hidden="true" className="size-4 text-brand-strong" />
          Próximos meses
        </CardTitle>
        <CardDescription className="text-xs">
          Parcelas, recorrências e outras despesas já lançadas.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {commitments.length ? (
          <div className="divide-y">
            {commitments.map((commitment) => (
              <div
                className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
                key={commitment.period}
              >
                <div className="min-w-0">
                  <p className="font-medium text-sm">{formatPeriod(commitment.period)}</p>
                  <p className="text-muted-foreground text-xs">
                    {describePersonReportCommitment(commitment)}
                  </p>
                </div>
                <MoneyValue amount={commitment.totalAmount} className="font-semibold text-sm" />
              </div>
            ))}
          </div>
        ) : (
          <p className="rounded-md border border-dashed px-3 py-4 text-center text-muted-foreground text-sm">
            Nada lançado para os próximos meses.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function PersonReportSettlements({
  settlements,
}: {
  settlements: PersonReportOutput["settlements"];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <HandCoins aria-hidden="true" className="size-4 text-brand-strong" />
          Repasses recebidos
        </CardTitle>
      </CardHeader>
      <CardContent>
        {settlements.length ? (
          <div className="divide-y">
            {settlements.map((settlement) => (
              <div
                className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
                key={settlement.id}
              >
                <span className="text-muted-foreground text-xs">
                  {formatPersonReportDate(settlement.receivedAt)}
                  {settlement.source === "invoicePayment" ? " · Fatura" : " · Manual"}
                </span>
                <MoneyValue amount={settlement.amount} className="font-medium text-sm" />
              </div>
            ))}
          </div>
        ) : (
          <p className="rounded-md border border-dashed px-3 py-4 text-center text-muted-foreground text-sm">
            Nenhum repasse neste mês.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function PersonReportLoading() {
  return (
    <div aria-busy="true" aria-label="Carregando extrato" className="grid gap-4" role="status">
      <Skeleton className="h-40 w-full rounded-xl" />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <Skeleton className="h-72 w-full rounded-xl" />
        <Skeleton className="h-72 w-full rounded-xl" />
      </div>
    </div>
  );
}
