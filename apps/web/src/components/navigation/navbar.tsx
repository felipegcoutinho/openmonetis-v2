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
import { dashboardNavItem, type NavItem, type NavLinkItem, navSections } from "./nav-items";
import { NavLink } from "./nav-link";
import { PreviewNavigationMenu } from "./preview-navigation-menu";

function isPathActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function getInitials(name?: string | null) {
  if (!name) {
    return "OM";
  }

  const [first = "", second = ""] = name.trim().split(/\s+/);
  return `${first[0] ?? ""}${second[0] ?? ""}`.toUpperCase() || "OM";
}

const headerIconButtonClassName =
  "text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground aria-expanded:bg-primary-foreground/10 aria-expanded:text-primary-foreground focus-visible:border-primary-foreground/40 focus-visible:ring-primary-foreground/30 dark:text-card-foreground dark:hover:bg-card-foreground/10 dark:hover:text-card-foreground dark:aria-expanded:bg-card-foreground/10 dark:aria-expanded:text-card-foreground dark:focus-visible:border-card-foreground/40 dark:focus-visible:ring-card-foreground/30";

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
      <header className="fixed inset-x-0 top-0 z-50 bg-primary text-primary-foreground dark:border-b dark:bg-linear-to-b dark:from-card dark:to-background dark:text-card-foreground">
        <div className="project-container grid h-20 grid-cols-[auto_1fr_auto] items-center gap-3 px-[clamp(1rem,3vw,2.5rem)]">
          <Link
            className="flex justify-self-start items-center gap-2 text-primary-foreground dark:text-card-foreground"
            to="/dashboard"
          >
            <OpenMonetisLogo compactOnMobile onPrimary />
          </Link>

          <nav
            aria-label="Navegação principal"
            className="hidden min-w-0 items-center justify-start pl-6 xl:flex"
          >
            <NavigationMenu
              className="justify-start"
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
                  : undefined
              }
            >
              <NavigationMenuList className="justify-start gap-1">
                <NavigationMenuItem>
                  <NavLink
                    className={cn(
                      "inline-flex h-20 items-center gap-2 border-transparent border-b-2 bg-transparent px-3 font-medium text-sm text-primary-foreground/70 tracking-tight transition-colors hover:bg-transparent hover:text-primary-foreground focus:bg-transparent focus:text-primary-foreground dark:text-card-foreground/70 dark:hover:text-card-foreground dark:focus:text-card-foreground",
                      location.pathname === dashboardNavItem.href &&
                        "border-primary-foreground text-primary-foreground dark:border-primary dark:text-card-foreground",
                    )}
                    href={dashboardNavItem.href}
                    preservePeriod
                  >
                    {dashboardNavItem.label}
                  </NavLink>
                </NavigationMenuItem>

                {navSections.map((section) => {
                  const sectionActive = section.items.some(
                    (item) => "href" in item && isPathActive(location.pathname, item.href),
                  );

                  return (
                    <NavigationMenuItem key={section.label} value={section.label}>
                      <NavigationMenuTrigger
                        className={cn(
                          "h-20 rounded-none border-transparent border-b-2 bg-transparent! px-3 text-sm text-primary-foreground/70 tracking-tight hover:bg-transparent! hover:text-primary-foreground focus:bg-transparent! focus:text-primary-foreground data-open:bg-transparent! data-open:text-primary-foreground data-popup-open:bg-transparent! data-popup-open:text-primary-foreground dark:text-card-foreground/70 dark:hover:text-card-foreground dark:focus:text-card-foreground dark:data-open:text-card-foreground dark:data-popup-open:text-card-foreground",
                          sectionActive &&
                            "border-primary-foreground text-primary-foreground dark:border-primary dark:text-card-foreground",
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
                            className="w-80"
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
              badgeClassName="bg-primary-foreground text-white ring-0 dark:bg-card-foreground dark:text-card"
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
                className="appearance-none rounded-full border-0 bg-transparent p-0 shadow-none outline-none focus-visible:ring-3 focus-visible:ring-primary-foreground/30 dark:focus-visible:ring-card-foreground/30"
              >
                <Avatar className="overflow-hidden" showBorder={false} size="lg">
                  <AvatarImage
                    alt={user?.name ?? "Usuário"}
                    className="scale-[1.06]"
                    src={user?.image?.trim() || defaultAdminPersonAvatarUrl}
                  />
                  <AvatarFallback className="bg-primary-foreground/10 font-semibold text-primary-foreground dark:bg-card-foreground/10 dark:text-card-foreground">
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
      <div aria-hidden="true" className="h-20" />
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
        const active = isPathActive(pathname, item.href);

        return (
          <NavLink
            className={cn(
              "flex items-center gap-3 rounded-sm px-3 py-3 text-sm transition-colors hover:bg-accent hover:text-accent-foreground",
              active && "bg-accent text-accent-foreground",
            )}
            href={item.href}
            key={item.href}
            onClick={onNavigate}
            preservePeriod={item.preservePeriod}
            search={item.search}
          >
            <span className="shrink-0 text-brand-strong">{item.icon}</span>
            <span className="grid min-w-0 gap-1">
              <span className="font-medium">{item.label}</span>
              <span className="truncate text-muted-foreground text-xs">{item.description}</span>
            </span>
          </NavLink>
        );
      })}
    </div>
  );
}
