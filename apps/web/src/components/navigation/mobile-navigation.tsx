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
        "fixed inset-x-0 bottom-0 z-50 grid grid-cols-[1fr_1.25fr_0.75fr_1fr_1fr] material border-t px-2 pt-1 pb-[max(0.3rem,env(safe-area-inset-bottom))] transition-transform duration-300 ease-(--ease-drawer) motion-reduce:transition-none md:hidden",
        isMobile && mobileNavigationHidden && "pointer-events-none translate-y-full",
      )}
      inert={Boolean(isMobile && mobileNavigationHidden)}
    >
      <NavLink
        className={cn(
          "flex min-h-14 flex-col items-center justify-center gap-1 rounded-md px-1 text-muted-foreground text-2xs",
          location.pathname === "/dashboard" && "text-brand-strong",
        )}
        href="/dashboard"
        preservePeriod
      >
        <LayoutDashboard aria-hidden="true" className="size-5" />
        <span className="max-w-full truncate">Visão geral</span>
      </NavLink>
      <NavLink
        className={cn(
          "flex min-h-14 flex-col items-center justify-center gap-1 rounded-md px-1 text-muted-foreground text-2xs",
          isPathActive(location.pathname, "/transactions") && "text-brand-strong",
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
          "flex min-h-14 flex-col items-center justify-center gap-1 rounded-md px-1 text-muted-foreground text-2xs",
          mobileNavigationOpen && "text-brand-strong",
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
