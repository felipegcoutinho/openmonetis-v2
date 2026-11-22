import { Plus } from "lucide-react";
import { lazy, Suspense, useState } from "react";
import { mobileNavigationItemClassName } from "./navbar-options";

const MobileTransactionLauncher = lazy(() =>
  import("@/features/transactions/components/mobile-transaction-launcher").then((module) => ({
    default: module.MobileTransactionLauncher,
  })),
);

export function MobileTransactionButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      {/* The tab bar's primary action: a filled pill sets it apart from the destinations. */}
      <button
        aria-label="Novo lançamento ou anotação"
        aria-haspopup="dialog"
        aria-expanded={open}
        className={mobileNavigationItemClassName(false)}
        onClick={() => setOpen(true)}
        type="button"
      >
        <span className="primary-action grid h-9 w-15 place-items-center rounded-full text-primary-foreground transition-[scale] duration-(--duration-press) group-active/nav-item:scale-90 motion-reduce:transition-none">
          <Plus aria-hidden="true" className="size-6" strokeWidth={2.25} />
        </span>
      </button>
      {open ? (
        <Suspense
          fallback={
            <span role="status" className="sr-only">
              Carregando novo lançamento…
            </span>
          }
        >
          <MobileTransactionLauncher onClose={() => setOpen(false)} />
        </Suspense>
      ) : null}
    </>
  );
}
