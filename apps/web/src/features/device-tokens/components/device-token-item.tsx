import type { DeviceTokenOutput } from "@openmonetis/validators/device-tokens";
import { Image } from "@unpic/react";
import type { LucideIcon } from "lucide-react";
import { CalendarClock, History, Inbox, RefreshCw, Unplug } from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  formatDeviceTokenDate,
  formatDeviceTokenLastUsed,
  formatDeviceTokenRecentCaptures,
} from "../device-tokens.presentation";

const androidHeadIconPath = "/images/android-head-3d.svg";

function DeviceTokenDetail({
  children,
  className,
  icon: Icon,
}: {
  children: ReactNode;
  className?: string;
  icon: LucideIcon;
}) {
  return (
    <li className={cn("flex items-center gap-1.5", className)}>
      <Icon aria-hidden="true" className="size-3.5 shrink-0" />
      {children}
    </li>
  );
}

function DeviceTokenAction({
  children,
  className,
  disabled,
  label,
  onClick,
  tooltip,
}: {
  children: ReactNode;
  className?: string;
  disabled: boolean;
  label: string;
  onClick: () => void;
  tooltip: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            aria-label={label}
            className={cn("text-muted-foreground", className)}
            disabled={disabled}
            onClick={onClick}
            size="icon"
            type="button"
            variant="ghost"
          />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
}

export function DeviceTokenItem({
  actionsDisabled,
  onRevoke,
  onRotate,
  token,
}: {
  actionsDisabled: boolean;
  onRevoke: () => void;
  onRotate: () => void;
  token: DeviceTokenOutput;
}) {
  const connected = Boolean(token.lastUsedAt);

  return (
    <li className="flex items-start gap-3 p-4">
      <span className="grid size-10 shrink-0 place-items-center">
        <Image
          alt=""
          className={cn(
            "h-6 w-7 object-contain transition-[filter,opacity]",
            connected ? undefined : "opacity-60 grayscale",
          )}
          height={16}
          layout="fixed"
          src={androidHeadIconPath}
          width={28}
        />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <p className="truncate font-medium text-sm" title={token.name}>
            {token.name}
          </p>
          {connected ? null : (
            <Badge className="font-mono shrink-0" variant="outline">
              Aguardando conexão
            </Badge>
          )}
          {token.expiresSoon ? (
            <Badge
              className="font-mono shrink-0 border-warning/30 bg-warning/10 text-warning"
              variant="outline"
            >
              Expira em breve
            </Badge>
          ) : null}
        </div>
        <ul className="font-mono mt-1.5 flex flex-col gap-1 text-muted-foreground text-xs sm:flex-row sm:flex-wrap sm:gap-x-4">
          <DeviceTokenDetail icon={History}>
            {formatDeviceTokenLastUsed(token.lastUsedAt)}
          </DeviceTokenDetail>
          <DeviceTokenDetail icon={Inbox}>
            {formatDeviceTokenRecentCaptures(token.recentCaptureCount)}
          </DeviceTokenDetail>
          <DeviceTokenDetail
            className={token.expiresSoon ? "text-warning" : undefined}
            icon={CalendarClock}
          >
            Expira em {formatDeviceTokenDate(token.expiresAt)}
          </DeviceTokenDetail>
        </ul>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <DeviceTokenAction
          disabled={actionsDisabled}
          label={`Renovar token de ${token.name}`}
          onClick={onRotate}
          tooltip="Renovar token"
        >
          <RefreshCw aria-hidden="true" />
        </DeviceTokenAction>
        <DeviceTokenAction
          className="hover:bg-destructive/10 hover:text-destructive"
          disabled={actionsDisabled}
          label={`Revogar acesso de ${token.name}`}
          onClick={onRevoke}
          tooltip="Revogar acesso"
        >
          <Unplug aria-hidden="true" />
        </DeviceTokenAction>
      </div>
    </li>
  );
}
