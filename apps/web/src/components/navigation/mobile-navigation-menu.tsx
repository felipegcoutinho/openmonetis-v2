import { Calculator, Eye, EyeOff, Menu, Settings } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { dashboardNavItem, navSections } from "./nav-items";
import { NavLink } from "./nav-link";
import { headerIconButtonClassName } from "./navbar-options";
import { NavigationSectionItems } from "./navigation-section-items";

export function MobileNavigationMenu({
  setCalculatorOpen,
  isPrivacyModeEnabled,
  togglePrivacyMode,
  location,
  mobileNavigationOpen,
  setMobileNavigationOpen,
}: {
  setCalculatorOpen: Dispatch<SetStateAction<boolean>>;
  isPrivacyModeEnabled: boolean;
  togglePrivacyMode: () => void;
  location: { pathname: string };
  mobileNavigationOpen: boolean;
  setMobileNavigationOpen: Dispatch<SetStateAction<boolean>>;
}) {
  return (
    <Sheet onOpenChange={setMobileNavigationOpen} open={mobileNavigationOpen}>
      <SheetTrigger
        aria-label="Abrir navegação"
        className="hidden md:inline-flex xl:hidden"
        render={
          <Button
            className={headerIconButtonClassName}
            size="icon-sm"
            type="button"
            variant="ghost"
          />
        }
      >
        <Menu aria-hidden="true" className="size-4.5" />
      </SheetTrigger>
      <SheetContent className="w-[min(24rem,90vw)]! overflow-y-auto" side="right">
        <SheetHeader className="border-b pr-14">
          <SheetTitle>Navegação</SheetTitle>
          <SheetDescription>Acesse as áreas do seu controle financeiro.</SheetDescription>
        </SheetHeader>
        <nav aria-label="Navegação principal" className="grid gap-5 px-4 pb-6">
          <section className="grid gap-2 md:hidden">
            <h2 className="px-1 font-medium text-muted-foreground text-xs tracking-wider">
              Ferramentas
            </h2>
            <div className="grid grid-cols-3 gap-2">
              <Button
                className="h-20! w-full! flex-col gap-2 rounded-lg p-2 hover:bg-accent"
                onClick={() => {
                  setMobileNavigationOpen(false);
                  setCalculatorOpen(true);
                }}
                type="button"
                variant="outline"
              >
                <Calculator aria-hidden="true" className="size-5 text-brand-strong" />
                <span className="text-xs">Calculadora</span>
              </Button>
              <Button
                aria-label={isPrivacyModeEnabled ? "Mostrar valores" : "Ocultar valores"}
                aria-pressed={isPrivacyModeEnabled}
                className="h-20! w-full! flex-col gap-2 rounded-lg p-2 hover:bg-accent"
                onClick={togglePrivacyMode}
                type="button"
                variant="outline"
              >
                {isPrivacyModeEnabled ? (
                  <EyeOff aria-hidden="true" className="size-5 text-brand-strong" />
                ) : (
                  <Eye aria-hidden="true" className="size-5 text-brand-strong" />
                )}
                <span className="text-xs">Valores</span>
              </Button>
              <ThemeToggle card />
            </div>
          </section>
          <NavLink
            className={cn(
              "flex min-h-11 items-center rounded-md px-3 font-medium text-sm transition-colors hover:bg-accent",
              location.pathname === dashboardNavItem.href && "bg-accent",
            )}
            href={dashboardNavItem.href}
            onClick={() => setMobileNavigationOpen(false)}
            preservePeriod
          >
            {dashboardNavItem.label}
          </NavLink>
          {navSections.map((section) => (
            <section className="grid gap-1" key={section.label}>
              <h2 className="px-3 pb-1 font-medium text-muted-foreground text-xs  tracking-wider">
                {section.label}
              </h2>
              <NavigationSectionItems
                items={section.items}
                onNavigate={() => setMobileNavigationOpen(false)}
                pathname={location.pathname}
              />
            </section>
          ))}
          <NavLink
            className={cn(
              "flex min-h-12 items-center gap-3 rounded-md border-t px-3 font-medium text-sm transition-colors hover:bg-accent md:hidden",
              location.pathname === "/settings" && "bg-accent",
            )}
            href="/settings"
            onClick={() => setMobileNavigationOpen(false)}
          >
            <Settings aria-hidden="true" className="size-5" />
            Ajustes
          </NavLink>
        </nav>
      </SheetContent>
    </Sheet>
  );
}
