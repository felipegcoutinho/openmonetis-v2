import type { NotificationOutput } from "@openmonetis/validators/notifications";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

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

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import { cn } from "@/lib/utils";
import {
  type UpdateNotificationVariables,
  useUpdateNotificationMutation,
} from "../notifications.mutations";
import { getNotificationTarget } from "../notifications.presentation";
import { notificationsQueryOptions } from "../notifications.queries";
import type { NotificationView } from "./notification-panel.types";
import { NotificationPanelBody } from "./notification-panel-body";

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
          <Bell aria-hidden="true" className="size-5 md:size-4.5" />
          {unreadCount > 0 ? (
            <span
              className={cn(
                "absolute top-0 right-0 grid size-4.5 place-items-center rounded-full bg-foreground font-semibold text-[10px] text-background leading-none ring-2 ring-background",
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
