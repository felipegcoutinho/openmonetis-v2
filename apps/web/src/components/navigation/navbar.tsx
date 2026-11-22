import { useQueryClient } from "@tanstack/react-query";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { Calculator, Eye, EyeOff, Search, Settings } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { CalculatorDialog } from "@/components/calculator/calculator-dialog";
import { clearCalculatorHistory } from "@/components/calculator/calculator-history";
import { CommandMenu } from "@/components/command-menu/command-menu";
import { OpenMonetisLogo } from "@/components/openmonetis-logo";
import { usePrivacyMode } from "@/components/privacy-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { NotificationPanel } from "@/features/notifications/components/notification-panel";
import { ReleaseNotice } from "@/features/releases/components/release-notice";
import { useCompactPageTitle } from "@/hooks/useCompactPageTitle";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useMobileNavigationVisibility } from "@/hooks/useMobileNavigationVisibility";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { DesktopNavigation } from "./desktop-navigation";
import { MobileNavigation } from "./mobile-navigation";
import { MobileNavigationMenu } from "./mobile-navigation-menu";
import { headerIconButtonClassName } from "./navbar-options";
import { scrollToTop } from "./scroll-to-top";
import { SkipToContent } from "./skip-to-content";
import { UserNavigationMenu } from "./user-navigation-menu";

export function Navbar() {
  const isMobile = useIsMobile();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const session = authClient.useSession();
  const user = session.data?.user;
  const { isPrivacyModeEnabled, togglePrivacyMode } = usePrivacyMode();
  const [calculatorOpen, setCalculatorOpen] = useState(false);
  const [commandMenuOpen, setCommandMenuOpen] = useState(false);
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);
  const mobileNavigationHidden = useMobileNavigationVisibility(isMobile);
  const compactTitle = useCompactPageTitle();
  const showCompactTitle = Boolean(isMobile && compactTitle?.visible);
  const [openNavigationSection, setOpenNavigationSection] = useState<string | null>(null);

  async function handleSignOut() {
    try {
      const result = await authClient.signOut();

      if (result.error) {
        throw new Error(result.error.message);
      }

      queryClient.clear();
      clearCalculatorHistory();
      toast.success("Sessão encerrada");
      await navigate({ to: "/" });
    } catch (error) {
      toast.error("Não foi possível encerrar a sessão.", {
        description: error instanceof Error ? error.message : "Tente novamente em instantes.",
      });
    }
  }

  async function handleCopyUserId() {
    if (!user?.id) return false;

    try {
      await navigator.clipboard.writeText(user.id);
      toast.success("ID do usuário copiado");
      return true;
    } catch {
      toast.error("Não foi possível copiar o ID do usuário.");
      return false;
    }
  }

  return (
    <>
      <header className="app-navbar material fixed inset-x-0 top-0 z-50 border-b border-border pt-(--safe-top) text-foreground">
        <SkipToContent />
        <div className="project-container grid h-(--navbar-height) grid-cols-[1fr_auto] items-center gap-3 pr-[max(clamp(1rem,3.5vw,3rem),var(--safe-right))] pl-[max(clamp(1rem,3.5vw,3rem),var(--safe-left))] xl:grid-cols-[1fr_auto_1fr]">
          {/* On phones the page title takes the logo's place once the large title scrolls away. */}
          <div className="relative flex min-w-0 items-center justify-self-stretch">
            <Link
              aria-label="OpenMonetis, ir para a visão geral"
              className={cn(
                "flex min-h-11 min-w-11 items-center gap-2 text-foreground transition-[opacity,translate] duration-(--duration-base) ease-(--ease-out-strong) motion-reduce:transition-none",
                showCompactTitle && "pointer-events-none -translate-y-1 opacity-0",
              )}
              inert={showCompactTitle}
              to="/dashboard"
            >
              <OpenMonetisLogo className="max-md:[&>img:first-child]:h-10" compactOnMobile />
            </Link>
            {compactTitle ? (
              <button
                aria-label={`${compactTitle.title}, voltar ao topo`}
                className={cn(
                  "absolute inset-y-0 left-0 max-w-full truncate text-left font-heading font-semibold text-[1.0625rem] tracking-[-0.012em] outline-none transition-[opacity,translate] duration-(--duration-base) ease-(--ease-out-strong) focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none md:hidden",
                  !showCompactTitle && "pointer-events-none translate-y-1 opacity-0",
                )}
                inert={!showCompactTitle}
                onClick={scrollToTop}
                type="button"
              >
                {compactTitle.title}
              </button>
            ) : null}
          </div>

          <DesktopNavigation
            location={location}
            openNavigationSection={openNavigationSection}
            setOpenNavigationSection={setOpenNavigationSection}
          />

          <div className="flex justify-self-end items-center gap-0 md:gap-1">
            <Tooltip>
              <TooltipTrigger
                aria-keyshortcuts="Control+K Meta+K"
                aria-label="Buscar"
                render={
                  <Button
                    className={headerIconButtonClassName}
                    onClick={() => setCommandMenuOpen(true)}
                    size="icon-sm"
                    type="button"
                    variant="ghost"
                  />
                }
              >
                <Search aria-hidden="true" className="size-5 md:size-4.5" />
              </TooltipTrigger>
              <TooltipContent>Buscar (Ctrl K ou ⌘K)</TooltipContent>
            </Tooltip>

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
                <Calculator aria-hidden="true" className="size-4.5" />
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
                {isPrivacyModeEnabled ? (
                  <EyeOff aria-hidden="true" className="size-5 md:size-4.5" />
                ) : (
                  <Eye aria-hidden="true" className="size-5 md:size-4.5" />
                )}
              </TooltipTrigger>
              <TooltipContent>
                {isPrivacyModeEnabled ? "Mostrar valores" : "Ocultar valores"}
              </TooltipContent>
            </Tooltip>

            <NotificationPanel
              badgeClassName="bg-primary text-primary-foreground ring-0 max-md:right-2"
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
                <Settings aria-hidden="true" className="size-5 md:size-4.5" />
              </TooltipTrigger>
              <TooltipContent>Ajustes</TooltipContent>
            </Tooltip>
            <UserNavigationMenu
              user={user}
              handleSignOut={handleSignOut}
              handleCopyUserId={handleCopyUserId}
            />
            <MobileNavigationMenu
              setCalculatorOpen={setCalculatorOpen}
              isPrivacyModeEnabled={isPrivacyModeEnabled}
              togglePrivacyMode={togglePrivacyMode}
              location={location}
              mobileNavigationOpen={mobileNavigationOpen}
              setMobileNavigationOpen={setMobileNavigationOpen}
            />
          </div>
        </div>
      </header>
      {/* The translucent menu sheet would show the tab bar through its lower rows, so it steps aside. */}
      <MobileNavigation
        isMobile={isMobile}
        mobileNavigationHidden={mobileNavigationHidden || mobileNavigationOpen}
        location={location}
        user={user}
        mobileNavigationOpen={mobileNavigationOpen}
        setMobileNavigationOpen={setMobileNavigationOpen}
      />
      <div aria-hidden="true" className="h-[calc(var(--navbar-height)+var(--safe-top))]" />
      {/* The user menu already flags a new version; the banner only greets on the overview. */}
      {location.pathname === "/dashboard" ? <ReleaseNotice enabled={Boolean(user)} /> : null}
      <CalculatorDialog onOpenChange={setCalculatorOpen} open={calculatorOpen} />
      <CommandMenu
        enabled={Boolean(user)}
        onOpenChange={setCommandMenuOpen}
        open={commandMenuOpen}
      />
    </>
  );
}
