import type { PersonReportDeliveryOutput } from "@openmonetis/validators/person-reports";
import {
  CalendarClock,
  ChevronDown,
  Loader,
  MailCheck,
  MailX,
  Paperclip,
  Send,
} from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatPeriod } from "@/lib/period-presentation";
import { cn } from "@/lib/utils";
import {
  formatPersonReportDeliveryMoment,
  personReportDeliveryStatusLabels,
} from "../person-reports.presentation";

/** Past this many deliveries the history scrolls instead of growing the card. */
const scrollThreshold = 5;

const statusStyles = {
  sent: { icon: MailCheck, className: "bg-success/15 text-success" },
  failed: { icon: MailX, className: "bg-destructive/10 text-destructive" },
  pending: { icon: Loader, className: "bg-muted text-muted-foreground" },
} as const satisfies Record<PersonReportDeliveryOutput["status"], unknown>;

export function PersonReportDeliveriesCard({
  deliveries,
  isError,
}: {
  deliveries: PersonReportDeliveryOutput[];
  isError: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Send aria-hidden="true" className="size-4 text-brand-strong" />
          Envios por e-mail
        </CardTitle>
        <CardDescription className="text-xs">Os últimos extratos enviados.</CardDescription>
      </CardHeader>
      <CardContent>
        {isError ? (
          <p className="text-destructive text-sm" role="alert">
            Não foi possível carregar os envios.
          </p>
        ) : deliveries.length ? (
          <DeliveryHistory deliveries={deliveries} />
        ) : (
          <p className="rounded-md border border-dashed px-3 py-4 text-center text-muted-foreground text-sm">
            Nenhum extrato enviado ainda. Envie agora ou programe o envio automático.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function DeliveryHistory({ deliveries }: { deliveries: PersonReportDeliveryOutput[] }) {
  const scrollable = deliveries.length > scrollThreshold;
  // Ephemeral UI state: whether older deliveries are still hidden below the visible area.
  const [hasMoreBelow, setHasMoreBelow] = useState(true);
  const showMoreHint = scrollable && hasMoreBelow;

  return (
    <div className="grid gap-2">
      <div className="relative">
        <section
          aria-label="Histórico de envios"
          className={cn(scrollable && "-mr-2 max-h-88 overflow-y-auto overscroll-contain pr-2")}
          onScroll={(event) => {
            const element = event.currentTarget;
            setHasMoreBelow(element.scrollTop + element.clientHeight < element.scrollHeight - 4);
          }}
          // A scrollable region must be reachable by keyboard.
          tabIndex={scrollable ? 0 : undefined}
        >
          <ol className="relative grid gap-4 before:absolute before:top-4 before:bottom-4 before:left-4 before:w-px before:bg-border">
            {deliveries.map((delivery) => (
              <DeliveryItem delivery={delivery} key={delivery.id} />
            ))}
          </ol>
        </section>
        {scrollable ? (
          <div
            aria-hidden="true"
            className={cn(
              "pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-linear-to-t from-card to-transparent transition-opacity duration-200",
              showMoreHint ? "opacity-100" : "opacity-0",
            )}
          />
        ) : null}
      </div>
      {scrollable ? (
        <p
          className={cn(
            "flex items-center justify-center gap-1 text-muted-foreground text-xs transition-opacity duration-200",
            showMoreHint ? "opacity-100" : "opacity-0",
          )}
        >
          <ChevronDown aria-hidden="true" className="size-3.5" />
          Role para ver os {deliveries.length} envios
        </p>
      ) : null}
    </div>
  );
}

function DeliveryItem({ delivery }: { delivery: PersonReportDeliveryOutput }) {
  const status = statusStyles[delivery.status];
  const StatusIcon = status.icon;
  return (
    <li className="relative grid grid-cols-[2rem_minmax(0,1fr)] gap-3">
      {/* Opaque base, so the timeline line does not show through the tinted icon. */}
      <span className="z-10 size-8 rounded-full bg-card ring-4 ring-card">
        <span className={cn("grid size-full place-items-center rounded-full", status.className)}>
          <StatusIcon aria-hidden="true" className="size-4" />
        </span>
      </span>
      <div className="grid min-w-0 gap-0.5 pt-0.5">
        <p className="flex items-baseline justify-between gap-2">
          <span className="truncate font-medium text-sm">{formatPeriod(delivery.period)}</span>
          <time
            className="shrink-0 text-muted-foreground text-xs"
            dateTime={delivery.sentAt ?? delivery.createdAt}
          >
            {formatPersonReportDeliveryMoment(delivery.sentAt ?? delivery.createdAt)}
          </time>
        </p>
        <p className="truncate text-muted-foreground text-xs">
          <span className={cn(delivery.status === "failed" && "text-destructive")}>
            {personReportDeliveryStatusLabels[delivery.status]}
          </span>{" "}
          para {delivery.recipientEmail}
        </p>
        {delivery.trigger === "scheduled" || delivery.includesSpreadsheet ? (
          <span className="mt-1 flex flex-wrap gap-1.5">
            {delivery.trigger === "scheduled" ? (
              <Badge variant="secondary">
                <CalendarClock aria-hidden="true" />
                Automático
              </Badge>
            ) : null}
            {delivery.includesSpreadsheet ? (
              <Badge variant="outline">
                <Paperclip aria-hidden="true" />
                Planilha
              </Badge>
            ) : null}
          </span>
        ) : null}
      </div>
    </li>
  );
}
