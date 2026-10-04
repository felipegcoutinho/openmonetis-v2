import { useQueryClient } from "@tanstack/react-query";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { Calculator, Eye, EyeOff, Settings } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { CalculatorDialog } from "@/components/calculator/calculator-dialog";
import { OpenMonetisLogo } from "@/components/openmonetis-logo";
import { usePrivacyMode } from "@/components/privacy-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { NotificationPanel } from "@/features/notifications/components/notification-panel";
import { ReleaseNotice } from "@/features/releases/components/release-notice";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useMobileNavigationVisibility } from "@/hooks/useMobileNavigationVisibility";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { DesktopNavigation } from "./desktop-navigation";
import { MobileNavigation } from "./mobile-navigation";
import { MobileNavigationMenu } from "./mobile-navigation-menu";
import { headerIconButtonClassName } from "./navbar-options";
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
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);
  const mobileNavigationHidden = useMobileNavigationVisibility(isMobile);
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
            <OpenMonetisLogo className="max-md:[&>img:first-child]:h-10" compactOnMobile />
          </Link>

          <DesktopNavigation
            location={location}
            openNavigationSection={openNavigationSection}
            navigationPopupVariant={navigationPopupVariant}
            setOpenNavigationSection={setOpenNavigationSection}
            setNavigationPopupVariant={setNavigationPopupVariant}
          />

          <div className="flex justify-self-end items-center gap-0 md:gap-2">
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
      <MobileNavigation
        isMobile={isMobile}
        mobileNavigationHidden={mobileNavigationHidden}
        location={location}
        user={user}
        mobileNavigationOpen={mobileNavigationOpen}
        setMobileNavigationOpen={setMobileNavigationOpen}
      />
      <div aria-hidden="true" className="h-16" />
      <ReleaseNotice enabled={Boolean(user)} />
      <CalculatorDialog onOpenChange={setCalculatorOpen} open={calculatorOpen} />
    </>
  );
}
