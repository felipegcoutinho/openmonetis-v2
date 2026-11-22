import { ArrowLeftRight, LayoutDashboard, Menu } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";
import type { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { MobileNavigationIcon } from "./mobile-navigation-icon";
import { MobileShortcut } from "./mobile-shortcut";
import { MobileTransactionButton } from "./mobile-transaction-button";
import { isPathActive } from "./nav-items";
import { NavLink } from "./nav-link";
import { mobileNavigationItemClassName } from "./navbar-options";
import { scrollToTopWhenCurrent } from "./scroll-to-top";

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
  // Icons only, in five equal columns, so the new-transaction button sits on the centre line.
  // Each destination keeps its name for assistive technology.
  return (
    <nav
      aria-label="Navegação principal mobile"
      className={cn(
        "app-tabbar fixed inset-x-0 bottom-0 z-50 grid grid-cols-5 material border-t pt-1 pr-[max(0.5rem,var(--safe-right))] pb-[max(0.3rem,var(--safe-bottom))] pl-[max(0.5rem,var(--safe-left))] transition-transform duration-300 ease-(--ease-drawer) motion-reduce:transition-none md:hidden",
        isMobile && mobileNavigationHidden && "pointer-events-none translate-y-full",
      )}
      inert={Boolean(isMobile && mobileNavigationHidden)}
    >
      <NavLink
        aria-current={location.pathname === "/dashboard" ? "page" : undefined}
        className={mobileNavigationItemClassName(location.pathname === "/dashboard")}
        href="/dashboard"
        onClick={(event) => scrollToTopWhenCurrent(event, location.pathname, "/dashboard")}
        preservePeriod
      >
        <MobileNavigationIcon active={location.pathname === "/dashboard"}>
          <LayoutDashboard aria-hidden="true" className="size-6" />
        </MobileNavigationIcon>
        <span className="sr-only">Visão geral</span>
      </NavLink>
      <NavLink
        aria-current={isPathActive(location.pathname, "/transactions") ? "page" : undefined}
        className={mobileNavigationItemClassName(isPathActive(location.pathname, "/transactions"))}
        href="/transactions"
        onClick={(event) => scrollToTopWhenCurrent(event, location.pathname, "/transactions")}
        preservePeriod
      >
        <MobileNavigationIcon active={isPathActive(location.pathname, "/transactions")}>
          <ArrowLeftRight aria-hidden="true" className="size-6" />
        </MobileNavigationIcon>
        <span className="sr-only">Lançamentos</span>
      </NavLink>
      <MobileTransactionButton />
      <MobileShortcut enabled={Boolean(user)} />
      <button
        aria-expanded={mobileNavigationOpen}
        aria-haspopup="dialog"
        className={mobileNavigationItemClassName(mobileNavigationOpen)}
        onClick={() => setMobileNavigationOpen(true)}
        type="button"
      >
        <MobileNavigationIcon active={mobileNavigationOpen}>
          <Menu aria-hidden="true" className="size-6" />
        </MobileNavigationIcon>
        <span className="sr-only">Menu</span>
      </button>
    </nav>
  );
}
