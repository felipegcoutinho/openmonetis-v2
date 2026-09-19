import { defaultAdminPersonAvatarUrl } from "@openmonetis/domain/people";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { Calculator, Copy, Eye, EyeOff, LogOut, Menu, Settings } from "lucide-react";
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
  "text-muted-foreground hover:bg-primary/10 hover:text-foreground aria-expanded:bg-primary/10 aria-expanded:text-foreground focus-visible:border-primary/40 focus-visible:ring-primary/25";

const desktopNavigationItemClassName =
  "group/header-nav inline-flex h-9 items-center rounded-sm border-0 bg-transparent px-1 font-medium text-foreground text-sm tracking-tight hover:bg-transparent hover:text-foreground focus:bg-transparent focus:text-foreground focus-visible:ring-2 focus-visible:ring-primary/40";

const desktopNavigationLabelClassName =
  "relative inline-flex pb-px after:absolute after:inset-x-0 after:bottom-0 after:h-px after:origin-left after:scale-x-0 after:bg-primary after:transition-transform after:duration-300 after:ease-[cubic-bezier(0.165,0.84,0.44,1)] motion-reduce:after:transition-none";

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
      <header className="app-navbar fixed inset-x-0 top-0 z-50 border-b bg-background/80 text-foreground backdrop-blur-sm dark:bg-background/80 dark:text-foreground">
        <div className="project-container grid h-16 grid-cols-[1fr_auto] items-center gap-3 px-[clamp(1rem,3vw,2.5rem)] xl:h-17.5 xl:grid-cols-[1fr_auto_1fr]">
          <Link
            className="flex justify-self-start items-center gap-2 text-foreground"
            to="/dashboard"
          >
            <OpenMonetisLogo compactOnMobile />
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
              <NavigationMenuList className="gap-5">
                <NavigationMenuItem>
                  <NavLink
                    className={desktopNavigationItemClassName}
                    href={dashboardNavItem.href}
                    preservePeriod
                  >
                    <span
                      className={cn(
                        desktopNavigationLabelClassName,
                        location.pathname === dashboardNavItem.href &&
                          "after:scale-x-100 after:bg-primary",
                      )}
                    >
                      {dashboardNavItem.label}
                    </span>
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
                          "bg-transparent! hover:bg-transparent! focus:bg-transparent! data-open:bg-transparent! data-open:text-foreground data-popup-open:bg-transparent! data-popup-open:text-foreground",
                        )}
                      >
                        <span
                          className={cn(
                            desktopNavigationLabelClassName,
                            sectionActive && "after:scale-x-100 after:bg-primary",
                          )}
                        >
                          {section.label}
                        </span>
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

          <div className="flex justify-self-end items-center gap-2">
            <Tooltip>
              <TooltipTrigger
                aria-label="Abrir calculadora"
                render={
                  <Button
                    className={headerIconButtonClassName}
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
            <ThemeToggle className={headerIconButtonClassName} />

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
                className="appearance-none rounded-full border-0 bg-transparent p-0 shadow-none outline-none focus-visible:ring-3 focus-visible:ring-primary/30"
              >
                <Avatar className="overflow-hidden" showBorder={false} size="lg">
                  <AvatarImage
                    alt={user?.name ?? "Usuário"}
                    className="scale-[1.06]"
                    src={user?.image?.trim() || defaultAdminPersonAvatarUrl}
                  />
                  <AvatarFallback className="bg-primary/10 font-semibold text-foreground">
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
                className="xl:hidden"
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
      <div aria-hidden="true" className="h-16 xl:h-17.5" />
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
