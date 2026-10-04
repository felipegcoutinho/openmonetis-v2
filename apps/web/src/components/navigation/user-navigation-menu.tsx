import { defaultAdminPersonAvatarUrl } from "@openmonetis/domain/people";

import { Copy, LogOut } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import { ReleaseMenuItems } from "@/features/releases/components/release-menu-items";

import type { authClient } from "@/lib/auth-client";

import { getInitials } from "./navigation-initials";

export function UserNavigationMenu({
  user,
  handleSignOut,
  handleCopyUserId,
}: {
  user: NonNullable<ReturnType<typeof authClient.useSession>["data"]>["user"] | undefined;
  handleSignOut: () => Promise<void>;
  handleCopyUserId: () => Promise<void>;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Abrir menu do usuário"
        className="ml-2 inline-flex size-11 items-center justify-center appearance-none rounded-full border-0 bg-transparent p-0 shadow-none outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring md:ml-0 md:size-auto"
      >
        <Avatar className="overflow-hidden max-md:data-[size=lg]:size-9" size="lg">
          <AvatarImage
            alt={user?.name ?? "Usuário"}
            className="scale-[1.06]"
            src={user?.image?.trim() || defaultAdminPersonAvatarUrl}
          />
          <AvatarFallback className="bg-primary/10 font-bold text-foreground">
            {getInitials(user?.name)}
          </AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="grid gap-1 px-2 py-2">
            <span className="flex min-w-0 items-center gap-1">
              <span className="truncate font-medium text-foreground text-sm">
                {user?.name ?? "Usuário"}
              </span>
              <Tooltip>
                <TooltipTrigger
                  aria-label="Copiar ID do usuário"
                  render={
                    <Button
                      className="shrink-0 text-muted-foreground hover:bg-accent hover:text-foreground"
                      disabled={!user?.id}
                      onClick={() => void handleCopyUserId()}
                      size="icon-xs"
                      type="button"
                      variant="ghost"
                    />
                  }
                >
                  <Copy aria-hidden="true" />
                </TooltipTrigger>
                <TooltipContent>Copiar ID do usuário</TooltipContent>
              </Tooltip>
            </span>
            <span className="truncate text-muted-foreground text-xs">{user?.email}</span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <ReleaseMenuItems enabled={Boolean(user)} />
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSignOut} variant="destructive">
          <LogOut className="size-4" aria-hidden="true" />
          Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
