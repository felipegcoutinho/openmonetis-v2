import type {
  NotificationOutput,
  NotificationsOutput,
} from "@openmonetis/validators/notifications";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
  Archive,
  ArchiveRestore,
  Bell,
  Check,
  ClipboardCheck,
  CreditCard,
  Gauge,
  HandCoins,
  Inbox as InboxIcon,
  Mail,
  RefreshCw,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { MoneyValue } from "@/components/money-value";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { EstablishmentLogo } from "@/features/establishments/components/establishment-logo";
import { cn } from "@/lib/utils";
import {
  type UpdateNotificationVariables,
  useUpdateNotificationMutation,
} from "../notifications.mutations";
import {
  getNotificationAmount,
  getNotificationCopy,
  getNotificationTarget,
} from "../notifications.presentation";
import { notificationsQueryOptions } from "../notifications.queries";

type NotificationView = "active" | "archived";

export function NotificationPanel({
  badgeClassName,
  enabled,
  triggerClassName,
}: {
  badgeClassName?: string;
  enabled: boolean;
  triggerClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<NotificationView>("active");
  const query = useQuery(notificationsQueryOptions(enabled));
  const mutation = useUpdateNotificationMutation();
  const navigate = useNavigate();
  const unreadCount = query.data?.unreadCount ?? 0;

  function changeState(state: UpdateNotificationVariables) {
    mutation.mutate(state, {
      onError: () => toast.error("Não foi possível atualizar a notificação."),
    });
  }

  function openNotification(notification: NotificationOutput) {
    if (!notification.isRead) {
      changeState({
        notificationKey: notification.notificationKey,
        fingerprint: notification.fingerprint,
        isRead: true,
      });
    }
    const target = getNotificationTarget(notification);
    setOpen(false);
    void navigate({ to: target.to as never, search: target.search as never });
  }

  return (
    <Sheet onOpenChange={setOpen} open={open}>
      <Tooltip>
        <TooltipTrigger
          aria-label={
            unreadCount > 0
              ? `Abrir notificações, ${unreadCount} não ${unreadCount === 1 ? "lida" : "lidas"}`
              : "Abrir notificações"
          }
          render={
            <SheetTrigger
              render={
                <Button
                  className={cn(
                    "relative text-muted-foreground hover:bg-accent hover:text-foreground",
                    triggerClassName,
                  )}
                  size="icon-sm"
                  type="button"
                  variant="ghost"
                />
              }
            />
          }
        >
          <Bell aria-hidden="true" className="size-4" />
          {unreadCount > 0 ? (
            <span
              className={cn(
                "absolute -top-0.5 -right-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-foreground px-1 font-medium text-[9px] text-background leading-none ring-2 ring-background",
                badgeClassName,
              )}
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          ) : null}
        </TooltipTrigger>
        <TooltipContent>Central de atenção</TooltipContent>
      </Tooltip>

      <SheetContent className="w-[min(30rem,100vw)]! gap-0 sm:max-w-[30rem]!" side="right">
        <SheetHeader className="border-b pr-14">
          <div className="flex items-center gap-2">
            <span className="grid size-9 place-items-center rounded-full bg-brand/10 text-brand-strong">
              <Bell aria-hidden="true" className="size-4" />
            </span>
            <div>
              <SheetTitle>Central de atenção</SheetTitle>
              <SheetDescription>O que merece sua atenção agora.</SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <Tabs
          className="min-h-0 flex-1 gap-0"
          onValueChange={(value) => setView(value as NotificationView)}
          value={view}
        >
          <div className="border-b px-4">
            <TabsList className="h-11" variant="line">
              <TabsTrigger value="active">
                Agora
                {query.data?.activeCount ? (
                  <Badge className="ml-1" variant="secondary">
                    {query.data.activeCount}
                  </Badge>
                ) : null}
              </TabsTrigger>
              <TabsTrigger value="archived">
                Arquivadas
                {query.data?.archivedCount ? (
                  <Badge className="ml-1" variant="outline">
                    {query.data.archivedCount}
                  </Badge>
                ) : null}
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent className="min-h-0 overflow-y-auto" value="active">
            <NotificationPanelBody
              busyKey={mutation.isPending ? mutation.variables.notificationKey : null}
              data={query.data}
              isError={query.isError}
              isLoading={query.isLoading}
              onNavigate={openNotification}
              onRetry={() => void query.refetch()}
              onStateChange={changeState}
              view="active"
            />
          </TabsContent>
          <TabsContent className="min-h-0 overflow-y-auto" value="archived">
            <NotificationPanelBody
              busyKey={mutation.isPending ? mutation.variables.notificationKey : null}
              data={query.data}
              isError={query.isError}
              isLoading={query.isLoading}
              onNavigate={openNotification}
              onRetry={() => void query.refetch()}
              onStateChange={changeState}
              view="archived"
            />
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

function NotificationPanelBody({
  busyKey,
  data,
  isError,
  isLoading,
  onNavigate,
  onRetry,
  onStateChange,
  view,
}: {
  busyKey: string | null;
  data: NotificationsOutput | undefined;
  isError: boolean;
  isLoading: boolean;
  onNavigate: (notification: NotificationOutput) => void;
  onRetry: () => void;
  onStateChange: (state: UpdateNotificationVariables) => void;
  view: NotificationView;
}) {
  if (isLoading) return <NotificationPanelLoading />;
  if (isError) return <NotificationPanelError onRetry={onRetry} />;
  if (!data) return null;

  const items = data.items.filter((item) =>
    view === "archived" ? item.isArchived : !item.isArchived,
  );
  if (items.length === 0) return <NotificationPanelEmpty view={view} />;

  return (
    <NotificationList
      busyKey={busyKey}
      items={items}
      onNavigate={onNavigate}
      onStateChange={onStateChange}
      view={view}
    />
  );
}

function NotificationList({
  busyKey,
  items,
  onNavigate,
  onStateChange,
  view,
}: {
  busyKey: string | null;
  items: NotificationOutput[];
  onNavigate: (notification: NotificationOutput) => void;
  onStateChange: (state: UpdateNotificationVariables) => void;
  view: NotificationView;
}) {
  const urgent = items.filter((item) => item.severity === "critical");
  const upcoming = items.filter((item) => item.severity !== "critical");
  const sections =
    view === "archived"
      ? [{ label: "Arquivadas", items }]
      : [
          { label: "Precisa de atenção", items: urgent },
          { label: "Próximos passos", items: upcoming },
        ];

  return (
    <div className="grid gap-5 px-4 py-5">
      {sections.map((section) =>
        section.items.length > 0 ? (
          <section className="grid gap-2" key={section.label}>
            <h2 className="px-1 font-medium text-muted-foreground text-xs uppercase tracking-wider">
              {section.label}
            </h2>
            <ul className="grid gap-2">
              {section.items.map((notification) => (
                <NotificationRow
                  busy={busyKey === notification.notificationKey}
                  key={notification.notificationKey}
                  notification={notification}
                  onNavigate={onNavigate}
                  onStateChange={onStateChange}
                />
              ))}
            </ul>
          </section>
        ) : null,
      )}
    </div>
  );
}

function NotificationRow({
  busy,
  notification,
  onNavigate,
  onStateChange,
}: {
  busy: boolean;
  notification: NotificationOutput;
  onNavigate: (notification: NotificationOutput) => void;
  onStateChange: (state: UpdateNotificationVariables) => void;
}) {
  const copy = getNotificationCopy(notification);
  const amount = getNotificationAmount(notification);
  const stateInput = {
    notificationKey: notification.notificationKey,
    fingerprint: notification.fingerprint,
  };

  return (
    <li
      className={cn(
        "group rounded-lg border bg-card transition-colors hover:border-brand-strong/30",
        !notification.isRead && "border-brand-strong/20 bg-brand/3",
        busy && "pointer-events-none opacity-60",
      )}
    >
      <div className="flex items-start gap-3 p-3 pb-2">
        <button
          aria-label={`${copy.context}: ${copy.title}`}
          className="flex min-w-0 flex-1 items-start gap-3 rounded-md text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          onClick={() => onNavigate(notification)}
          type="button"
        >
          <NotificationIcon notification={notification} />
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2">
              <span className="truncate font-medium text-sm">{copy.title}</span>
              {!notification.isRead ? (
                <>
                  <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-brand" />
                  <span className="sr-only">Não lida</span>
                </>
              ) : null}
            </span>
            <span
              className={cn(
                "mt-0.5 block text-xs",
                notification.severity === "critical"
                  ? "font-medium text-destructive"
                  : "text-muted-foreground",
              )}
            >
              {copy.context}
            </span>
            <span className="mt-1 block text-muted-foreground text-xs">{copy.detail}</span>
          </span>
          {amount !== null ? (
            <MoneyValue amount={amount} className="shrink-0 font-medium text-sm" />
          ) : null}
        </button>
      </div>
      <div className="flex items-center justify-between border-t px-3 py-1.5">
        <span className="text-muted-foreground text-[11px]">
          {notification.isRead ? "Vista" : "Nova"}
        </span>
        <div className="flex items-center gap-1">
          {!notification.isArchived ? (
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    aria-label={notification.isRead ? "Marcar como não lida" : "Marcar como lida"}
                    onClick={() =>
                      onStateChange({
                        ...stateInput,
                        isRead: !notification.isRead,
                      })
                    }
                    size="icon-xs"
                    type="button"
                    variant="ghost"
                  />
                }
              >
                {notification.isRead ? <Mail aria-hidden="true" /> : <Check aria-hidden="true" />}
              </TooltipTrigger>
              <TooltipContent>
                {notification.isRead ? "Marcar como não lida" : "Marcar como lida"}
              </TooltipContent>
            </Tooltip>
          ) : null}
          {notification.canArchive ? (
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    aria-label={notification.isArchived ? "Restaurar" : "Arquivar"}
                    onClick={() =>
                      onStateChange({
                        ...stateInput,
                        isArchived: !notification.isArchived,
                      })
                    }
                    size="icon-xs"
                    type="button"
                    variant="ghost"
                  />
                }
              >
                {notification.isArchived ? (
                  <ArchiveRestore aria-hidden="true" />
                ) : (
                  <Archive aria-hidden="true" />
                )}
              </TooltipTrigger>
              <TooltipContent>{notification.isArchived ? "Restaurar" : "Arquivar"}</TooltipContent>
            </Tooltip>
          ) : null}
        </div>
      </div>
    </li>
  );
}

function NotificationIcon({ notification }: { notification: NotificationOutput }) {
  if (notification.kind === "bill") {
    return (
      <EstablishmentLogo className="size-9" editable={false} name={notification.name} size={36} />
    );
  }

  if (notification.kind === "invoice") {
    return (
      <Avatar className="size-9" showBorder={false}>
        <AvatarImage
          alt={`Logo do cartão ${notification.cardName}`}
          className="object-contain"
          src={notification.cardLogo ?? undefined}
        />
        <AvatarFallback>
          <CreditCard aria-hidden="true" className="size-4" />
        </AvatarFallback>
      </Avatar>
    );
  }

  const className = cn(
    "grid size-9 shrink-0 place-items-center rounded-full",
    notification.severity === "critical" && "bg-destructive/10 text-destructive",
    notification.severity === "warning" && "bg-warning/10 text-warning",
    notification.severity === "info" && "bg-info/10 text-info",
  );

  return (
    <span className={className}>
      {notification.kind === "budget" ? <Gauge aria-hidden="true" className="size-4" /> : null}
      {notification.kind === "inbox" ? <InboxIcon aria-hidden="true" className="size-4" /> : null}
      {notification.kind === "externalExpenses" ? (
        <HandCoins aria-hidden="true" className="size-4" />
      ) : null}
      {notification.kind === "task" ? (
        <ClipboardCheck aria-hidden="true" className="size-4" />
      ) : null}
    </span>
  );
}

function NotificationPanelLoading() {
  return (
    <div aria-label="Carregando notificações" className="grid gap-3 p-4" role="status">
      {["first", "second", "third"].map((key) => (
        <Skeleton className="h-28" key={key} />
      ))}
    </div>
  );
}

function NotificationPanelError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="grid min-h-80 place-items-center px-8 text-center">
      <div>
        <span className="mx-auto grid size-11 place-items-center rounded-full bg-destructive/10 text-destructive">
          <Bell aria-hidden="true" className="size-5" />
        </span>
        <p className="mt-3 font-medium">Não foi possível carregar as notificações</p>
        <p className="mt-1 text-muted-foreground text-sm">Tente novamente em instantes.</p>
        <Button className="mt-4" onClick={onRetry} size="sm" type="button" variant="outline">
          <RefreshCw aria-hidden="true" /> Tentar novamente
        </Button>
      </div>
    </div>
  );
}

function NotificationPanelEmpty({ view }: { view: NotificationView }) {
  return (
    <div className="grid min-h-80 place-items-center px-8 text-center">
      <div>
        <span className="mx-auto grid size-11 place-items-center rounded-full bg-success/10 text-success">
          <Check aria-hidden="true" className="size-5" />
        </span>
        <p className="mt-3 font-medium">
          {view === "archived" ? "Nenhuma notificação arquivada" : "Tudo em dia por aqui"}
        </p>
        <p className="mt-1 text-muted-foreground text-sm">
          {view === "archived"
            ? "As notificações arquivadas aparecerão neste espaço."
            : "Novos vencimentos e alertas aparecerão quando precisarem de você."}
        </p>
      </div>
    </div>
  );
}
