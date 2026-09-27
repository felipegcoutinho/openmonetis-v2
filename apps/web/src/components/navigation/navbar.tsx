import { defaultAdminPersonAvatarUrl } from "@openmonetis/domain/people";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeftRight,
  Calculator,
  Copy,
  Eye,
  EyeOff,
  Landmark,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { CalculatorDialog } from "@/components/calculator/calculator-dialog";
import { OpenMonetisLogo } from "@/components/openmonetis-logo";
import { usePrivacyMode } from "@/components/privacy-provider";
import { ThemeToggle } from "@/components/theme-toggle";
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
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { NotificationPanel } from "@/features/notifications/components/notification-panel";
import { ReleaseMenuItems } from "@/features/releases/components/release-menu-items";
import { ReleaseNotice } from "@/features/releases/components/release-notice";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import {
  dashboardNavItem,
  isPathActive,
  type NavItem,
  type NavLinkItem,
  navSections,
} from "./nav-items";
import { NavLink } from "./nav-link";
import { PreviewNavigationMenu } from "./preview-navigation-menu";

function getInitials(name?: string | null) {
  if (!name) {
    return "OM";
  }

  const [first = "", second = ""] = name.trim().split(/\s+/);
  return `${first[0] ?? ""}${second[0] ?? ""}`.toUpperCase() || "OM";
}

const headerIconButtonClassName =
  "max-md:size-11 text-muted-foreground hover:bg-primary/10 hover:text-foreground aria-expanded:bg-primary/10 aria-expanded:text-foreground focus-visible:border-primary/40 focus-visible:ring-primary/25";

const desktopNavigationItemClassName =
  "inline-flex h-9 items-center justify-center rounded-full border-0 bg-transparent px-3.5 text-sm font-medium text-foreground transition-colors hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-reduce:transition-none";

const desktopNavigationActiveClassName =
  "bg-brand/10 text-brand-strong hover:bg-brand/15 focus:bg-brand/10 data-open:bg-brand/15 data-popup-open:bg-brand/15 data-open:hover:bg-brand/15 data-popup-open:hover:bg-brand/15 data-open:focus:bg-brand/15";

const desktopNavigationPopupClassName =
  "rounded-sm bg-popover/95 shadow-xl ring-border/80 backdrop-blur-sm";

const previewNavigationSections = new Set(["Finanças", "Organização"]);

export function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const session = authClient.useSession();
  const user = session.data?.user;
  const { isPrivacyModeEnabled, togglePrivacyMode } = usePrivacyMode();
  const [calculatorOpen, setCalculatorOpen] = useState(false);
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);
  const [openNavigationSection, setOpenNavigationSection] = useState<string | null>(null);
  const [navigationPopupVariant, setNavigationPopupVariant] = useState<"default" | "preview">(
    "default",
  );

  async function handleSignOut() {
    try {
      const result = await authClient.signOut();

      if (result.error) {
        throw new Error(result.error.message);
      }

      queryClient.clear();
      toast.success("Sessão encerrada");
      await navigate({ to: "/" });
    } catch (error) {
      toast.error("Não foi possível encerrar a sessão.", {
        description: error instanceof Error ? error.message : "Tente novamente em instantes.",
      });
    }
  }

  async function handleCopyUserId() {
    if (!user?.id) return;

    try {
      await navigator.clipboard.writeText(user.id);
      toast.success("ID do usuário copiado");
    } catch {
      toast.error("Não foi possível copiar o ID do usuário.");
    }
  }

  return (
    <>
      <header className="app-navbar fixed inset-x-0 top-0 z-50 border-b border-border/50 bg-background/95 text-foreground backdrop-blur-md">
        <div className="project-container grid h-16 grid-cols-[1fr_auto] items-center gap-3 px-[clamp(1rem,3vw,2.5rem)] xl:grid-cols-[1fr_auto_1fr]">
          <Link
            className="flex justify-self-start items-center gap-2 text-foreground"
            to="/dashboard"
          >
            <OpenMonetisLogo className="max-md:[&_img]:h-7" compactOnMobile />
          </Link>

          <nav
            aria-label="Navegação principal"
            className="hidden min-w-0 justify-self-center xl:flex"
          >
            <NavigationMenu
              className="justify-start"
              closeDelay={50}
              delay={30}
              onValueChange={(value) => {
                const nextSection = String(value ?? "") || null;
                setOpenNavigationSection(nextSection);
                if (nextSection) {
                  setNavigationPopupVariant(
                    previewNavigationSections.has(nextSection) ? "preview" : "default",
                  );
                }
              }}
              popupClassName={
                navigationPopupVariant === "preview"
                  ? "bg-transparent shadow-none ring-0"
                  : desktopNavigationPopupClassName
              }
            >
              <NavigationMenuList className="gap-1">
                <NavigationMenuItem>
                  <NavLink
                    aria-current={location.pathname === dashboardNavItem.href ? "page" : undefined}
                    className={cn(
                      desktopNavigationItemClassName,
                      location.pathname === dashboardNavItem.href &&
                        desktopNavigationActiveClassName,
                    )}
                    href={dashboardNavItem.href}
                    preservePeriod
                  >
                    {dashboardNavItem.label}
                  </NavLink>
                </NavigationMenuItem>

                {navSections.map((section) => {
                  const sectionActive = section.items.some(
                    (item) =>
                      "href" in item &&
                      !item.isShortcut &&
                      isPathActive(location.pathname, item.href),
                  );

                  return (
                    <NavigationMenuItem key={section.label} value={section.label}>
                      <NavigationMenuTrigger
                        className={cn(
                          desktopNavigationItemClassName,
                          "focus:bg-muted/70 data-open:bg-muted/70 data-popup-open:bg-muted/70 [&>svg]:size-3 [&>svg]:text-current",
                          sectionActive && desktopNavigationActiveClassName,
                        )}
                      >
                        {section.label}
                      </NavigationMenuTrigger>
                      <NavigationMenuContent
                        className={previewNavigationSections.has(section.label) ? "p-0" : "p-2"}
                      >
                        {previewNavigationSections.has(section.label) ? (
                          <PreviewNavigationMenu
                            isOpen={openNavigationSection === section.label}
                            items={section.items.filter(
                              (item): item is NavLinkItem => "href" in item,
                            )}
                            pathname={location.pathname}
                          />
                        ) : (
                          <NavigationSectionItems
                            className="w-92 max-w-[calc(100vw-2rem)]"
                            items={section.items}
                            pathname={location.pathname}
                          />
                        )}
                      </NavigationMenuContent>
                    </NavigationMenuItem>
                  );
                })}
              </NavigationMenuList>
            </NavigationMenu>
          </nav>

          <div className="flex justify-self-end items-center gap-1 sm:gap-2">
            <Tooltip>
              <TooltipTrigger
                aria-label="Abrir calculadora"
                render={
                  <Button
                    className={cn("hidden md:inline-flex", headerIconButtonClassName)}
                    onClick={() => setCalculatorOpen(true)}
                    size="icon-sm"
                    type="button"
                    variant="ghost"
                  />
                }
              >
                <Calculator aria-hidden="true" />
              </TooltipTrigger>
              <TooltipContent>Calculadora</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger
                aria-label={isPrivacyModeEnabled ? "Mostrar valores" : "Ocultar valores"}
                render={
                  <Button
                    className={headerIconButtonClassName}
                    onClick={togglePrivacyMode}
                    size="icon-sm"
                    type="button"
                    variant="ghost"
                  />
                }
              >
                {isPrivacyModeEnabled ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
              </TooltipTrigger>
              <TooltipContent>
                {isPrivacyModeEnabled ? "Mostrar valores" : "Ocultar valores"}
              </TooltipContent>
            </Tooltip>

            <NotificationPanel
              badgeClassName="bg-primary text-primary-foreground ring-0"
              enabled={Boolean(user)}
              triggerClassName={headerIconButtonClassName}
            />
            <ThemeToggle className={cn("hidden md:inline-flex", headerIconButtonClassName)} />

            <Tooltip>
              <TooltipTrigger
                aria-label="Abrir ajustes"
                render={
                  <Button
                    className={cn("hidden sm:inline-flex", headerIconButtonClassName)}
                    onClick={() => navigate({ to: "/settings" })}
                    size="icon-sm"
                    type="button"
                    variant="ghost"
                  />
                }
              >
                <Settings aria-hidden="true" />
              </TooltipTrigger>
              <TooltipContent>Ajustes</TooltipContent>
            </Tooltip>
            <DropdownMenu>
              <DropdownMenuTrigger
                aria-label="Abrir menu do usuário"
                className="inline-flex size-11 items-center justify-center appearance-none rounded-full border-0 bg-transparent p-0 shadow-none outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring md:size-auto"
              >
                <Avatar className="overflow-hidden max-md:data-[size=lg]:size-8" size="lg">
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
                <Menu aria-hidden="true" />
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
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>
      <nav
        aria-label="Navegação principal mobile"
        className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-4 border-t bg-background/95 px-2 pt-1 pb-[max(0.3rem,env(safe-area-inset-bottom))] shadow-[0_-8px_24px_-18px_rgb(0_0_0/0.5)] backdrop-blur-md md:hidden"
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
          Visão geral
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
          Lançamentos
        </NavLink>
        <NavLink
          className={cn(
            "flex min-h-14 flex-col items-center justify-center gap-1 rounded-md px-1 text-muted-foreground text-[0.68rem]",
            isPathActive(location.pathname, "/accounts") && "text-primary",
          )}
          href="/accounts"
          preservePeriod
        >
          <Landmark aria-hidden="true" className="size-5" />
          Contas
        </NavLink>
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
      <div aria-hidden="true" className="h-16" />
      <ReleaseNotice enabled={Boolean(user)} />
      <CalculatorDialog onOpenChange={setCalculatorOpen} open={calculatorOpen} />
    </>
  );
}

function NavigationSectionItems({
  className,
  items,
  onNavigate,
  pathname,
}: {
  className?: string;
  items: NavItem[];
  onNavigate?: () => void;
  pathname: string;
}) {
  return (
    <div className={cn("grid gap-1", className)}>
      {items.map((item) => {
        const active = !item.isShortcut && isPathActive(pathname, item.href);

        return (
          <NavLink
            className={cn(
              "flex items-start gap-3 rounded-md px-3 py-2.5 text-sm transition-colors hover:bg-accent hover:text-accent-foreground",
              active && "bg-accent text-accent-foreground",
            )}
            href={item.href}
            key={item.href}
            onClick={onNavigate}
            preservePeriod={item.preservePeriod}
            search={item.search}
          >
            <span className="mt-0.5 shrink-0 text-brand-strong">{item.icon}</span>
            <span className="grid min-w-0 gap-0.5">
              <span className="font-medium">{item.label}</span>
              <span className="text-muted-foreground text-xs leading-snug xl:whitespace-nowrap">
                {item.description}
              </span>
            </span>
          </NavLink>
        );
      })}
    </div>
  );
}
