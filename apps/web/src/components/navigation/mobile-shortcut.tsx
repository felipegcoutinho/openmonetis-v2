import {
  type MobileShortcutDestination,
  mobileShortcutDestinations,
} from "@openmonetis/domain/preferences";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "@tanstack/react-router";
import {
  Check,
  CreditCard,
  Goal,
  Inbox,
  Landmark,
  type LucideIcon,
  NotebookText,
  Paperclip,
  Tags,
  Target,
  Users,
} from "lucide-react";
import { type PointerEvent, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useUpdateUserPreferencesMutation } from "@/features/preferences/preferences.mutations";
import {
  mobileShortcutLabels,
  preferencesMutationErrorMessage,
} from "@/features/preferences/preferences.presentation";
import { userPreferencesQueryOptions } from "@/features/preferences/preferences.queries";
import { hapticTick } from "@/lib/haptics";
import { cn } from "@/lib/utils";
import { MobileNavigationIcon } from "./mobile-navigation-icon";
import { isPathActive } from "./nav-items";
import { NavLink } from "./nav-link";
import { mobileNavigationItemClassName } from "./navbar-options";
import { scrollToTopWhenCurrent } from "./scroll-to-top";

const longPressDurationMs = 500;
const longPressMoveTolerancePx = 10;

const shortcutOptions: Record<
  MobileShortcutDestination,
  { href: string; icon: LucideIcon; preservePeriod?: boolean }
> = {
  accounts: { href: "/accounts", icon: Landmark },
  cards: { href: "/cards", icon: CreditCard },
  budgets: { href: "/budgets", icon: Target, preservePeriod: true },
  goals: { href: "/goals", icon: Goal },
  people: { href: "/people", icon: Users },
  categories: { href: "/categories", icon: Tags },
  notes: { href: "/notes", icon: NotebookText },
  attachments: { href: "/attachments", icon: Paperclip, preservePeriod: true },
  inbox: { href: "/inbox", icon: Inbox },
};

export function MobileShortcut({ enabled }: { enabled: boolean }) {
  const location = useLocation();
  const preferences = useQuery(userPreferencesQueryOptions(enabled));
  const updatePreferences = useUpdateUserPreferencesMutation();
  const [open, setOpen] = useState(false);
  const [holding, setHolding] = useState(false);
  const timerRef = useRef<number | null>(null);
  const startPositionRef = useRef<{ x: number; y: number } | null>(null);
  const suppressClickRef = useRef(false);
  const destination = preferences.data?.mobileShortcut ?? "accounts";
  const option = shortcutOptions[destination];
  const label = mobileShortcutLabels[destination];

  useEffect(
    () => () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    },
    [],
  );

  function stopHolding() {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = null;
    startPositionRef.current = null;
    setHolding(false);
  }

  function openChoices() {
    stopHolding();
    hapticTick();
    suppressClickRef.current = true;
    setOpen(true);
  }

  function handlePointerDown(event: PointerEvent<HTMLAnchorElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    suppressClickRef.current = false;
    startPositionRef.current = { x: event.clientX, y: event.clientY };
    setHolding(true);
    timerRef.current = window.setTimeout(openChoices, longPressDurationMs);
  }

  function handlePointerMove(event: PointerEvent<HTMLAnchorElement>) {
    const start = startPositionRef.current;
    if (
      start &&
      Math.hypot(event.clientX - start.x, event.clientY - start.y) > longPressMoveTolerancePx
    ) {
      stopHolding();
    }
  }

  function handlePointerUp() {
    stopHolding();
  }

  async function selectShortcut(nextDestination: MobileShortcutDestination) {
    if (nextDestination === destination) {
      setOpen(false);
      return;
    }
    try {
      await updatePreferences.mutateAsync({ mobileShortcut: nextDestination });
      setOpen(false);
      toast.success(`Atalho alterado para ${mobileShortcutLabels[nextDestination]}`);
    } catch (error) {
      toast.error(preferencesMutationErrorMessage(error));
    }
  }

  return (
    <>
      <div className="relative min-w-0">
        <NavLink
          aria-label={`Abrir ${label}. Mantenha pressionado para alterar o atalho`}
          aria-current={isPathActive(location.pathname, option.href) ? "page" : undefined}
          className={cn(
            mobileNavigationItemClassName(isPathActive(location.pathname, option.href)),
            "relative",
          )}
          href={option.href}
          onClick={(event) => {
            if (suppressClickRef.current) {
              event.preventDefault();
              suppressClickRef.current = false;
              return;
            }
            scrollToTopWhenCurrent(event, location.pathname, option.href);
          }}
          onContextMenu={(event) => {
            event.preventDefault();
            openChoices();
          }}
          onPointerCancel={stopHolding}
          onPointerDown={handlePointerDown}
          onPointerLeave={stopHolding}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          preservePeriod={option.preservePeriod}
        >
          <MobileNavigationIcon active={isPathActive(location.pathname, option.href)}>
            <option.icon aria-hidden="true" className="size-6" />
          </MobileNavigationIcon>
          <span
            aria-hidden="true"
            className="absolute bottom-0 left-1/2 h-0.5 w-5 -translate-x-1/2 overflow-hidden rounded-full bg-muted-foreground/40"
          >
            <span
              className={cn(
                "block size-full origin-left scale-x-0 bg-primary transition-transform duration-300 ease-out motion-reduce:transition-none",
                holding && "scale-x-100",
              )}
            />
          </span>
        </NavLink>
      </div>

      <Sheet onOpenChange={setOpen} open={open}>
        <SheetContent
          className="max-h-[min(78svh,36rem)] rounded-t-2xl pb-[max(1rem,var(--safe-bottom))] md:hidden"
          side="bottom"
        >
          <SheetHeader>
            <SheetTitle>Escolher atalho</SheetTitle>
            <SheetDescription>
              Escolha o destino deste botão. Você também pode alterá-lo em Preferências.
            </SheetDescription>
          </SheetHeader>
          <div className="min-h-0 overflow-y-auto p-2">
            {mobileShortcutDestinations.map((choice) => {
              const item = shortcutOptions[choice];
              return (
                <button
                  aria-current={choice === destination ? "true" : undefined}
                  className="pressable flex min-h-12 w-full items-center gap-3 rounded-md px-3 text-left hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
                  disabled={updatePreferences.isPending}
                  key={choice}
                  onClick={() => void selectShortcut(choice)}
                  type="button"
                >
                  <item.icon aria-hidden="true" className="size-5 shrink-0" />
                  <span className="flex-1">{mobileShortcutLabels[choice]}</span>
                  {choice === destination ? <Check aria-hidden="true" className="size-4" /> : null}
                </button>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
