import { ArrowLeftRight, LayoutDashboard, Menu } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";
import type { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { MobileShortcut } from "./mobile-shortcut";
import { MobileTransactionButton } from "./mobile-transaction-button";
import { isPathActive } from "./nav-items";
import { NavLink } from "./nav-link";

export function MobileNavigation({
  isMobile,
  mobileNavigationHidden,
  location,
  user,
  mobileNavigationOpen,
  setMobileNavigationOpen,
}: {
  isMobile: boolean | null;
  mobileNavigationHidden: boolean;
  location: { pathname: string };
  user: NonNullable<ReturnType<typeof authClient.useSession>["data"]>["user"] | undefined;
  mobileNavigationOpen: boolean;
  setMobileNavigationOpen: Dispatch<SetStateAction<boolean>>;
}) {
  return (
    <nav
      aria-label="Navegação principal mobile"
      className={cn(
        "fixed inset-x-0 bottom-0 z-50 grid grid-cols-5 border-t bg-popover/80 px-2 pt-1 pb-[max(0.3rem,env(safe-area-inset-bottom))] shadow-[0_-8px_24px_-18px_rgb(0_0_0/0.5)] backdrop-blur-sm transition-transform duration-300 ease-out motion-reduce:transition-none md:hidden",
        isMobile && mobileNavigationHidden && "pointer-events-none translate-y-full",
      )}
      inert={Boolean(isMobile && mobileNavigationHidden)}
    >
      <NavLink
        className={cn(
          "flex min-h-14 flex-col items-center justify-center gap-1 rounded-md px-1 text-muted-foreground text-[0.68rem]",
          location.pathname === "/dashboard" && "text-primary",
        )}
        href="/dashboard"
        preservePeriod
      >
        <LayoutDashboard aria-hidden="true" className="size-5" />
        <span className="max-w-full truncate">Visão geral</span>
      </NavLink>
      <NavLink
        className={cn(
          "flex min-h-14 flex-col items-center justify-center gap-1 rounded-md px-1 text-muted-foreground text-[0.68rem]",
          isPathActive(location.pathname, "/transactions") && "text-primary",
        )}
        href="/transactions"
        preservePeriod
      >
        <ArrowLeftRight aria-hidden="true" className="size-5" />
        <span className="max-w-full truncate">Lançamentos</span>
      </NavLink>
      <MobileTransactionButton />
      <MobileShortcut enabled={Boolean(user)} />
      <button
        aria-label="Abrir menu"
        className={cn(
          "flex min-h-14 flex-col items-center justify-center gap-1 rounded-md px-1 text-muted-foreground text-[0.68rem]",
          mobileNavigationOpen && "text-primary",
        )}
        onClick={() => setMobileNavigationOpen(true)}
        type="button"
      >
        <Menu aria-hidden="true" className="size-5" />
        Menu
      </button>
    </nav>
  );
}
