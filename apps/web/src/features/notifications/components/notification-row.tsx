import type { NotificationOutput } from "@openmonetis/validators/notifications";

import {
  Archive,
  ArchiveRestore,
  ClipboardCheck,
  CreditCard,
  HandCoins,
  Inbox as InboxIcon,
  Mail,
  MailOpen,
  Target,
} from "lucide-react";

import { MoneyValue } from "@/components/money-value";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

import { Button } from "@/components/ui/button";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { EstablishmentLogo } from "@/features/establishments/components/establishment-logo";
import { cn } from "@/lib/utils";
import type { UpdateNotificationVariables } from "../notifications.mutations";
import { getNotificationAmount, getNotificationCopy } from "../notifications.presentation";

export function NotificationRow({
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
                {notification.isRead ? (
                  <Mail aria-hidden="true" />
                ) : (
                  <MailOpen aria-hidden="true" />
                )}
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

export function NotificationIcon({ notification }: { notification: NotificationOutput }) {
  if (notification.kind === "bill") {
    return (
      <EstablishmentLogo className="size-9" editable={false} name={notification.name} size={36} />
    );
  }

  if (notification.kind === "invoice") {
    return (
      <Avatar className="size-9">
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
      {notification.kind === "budget" ? <Target aria-hidden="true" className="size-4" /> : null}
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
