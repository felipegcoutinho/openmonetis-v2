import { Plus } from "lucide-react";
import { lazy, Suspense, useState } from "react";
import { Button } from "@/components/ui/button";

const MobileTransactionLauncher = lazy(() =>
  import("@/features/transactions/components/mobile-transaction-launcher").then((module) => ({
    default: module.MobileTransactionLauncher,
  })),
);

export function MobileTransactionButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        aria-label="Novo lançamento"
        aria-haspopup="dialog"
        className="h-auto min-h-14 min-w-0 flex-col gap-1 rounded-md px-1 text-[0.68rem]"
        onClick={() => setOpen(true)}
        type="button"
        variant="ghost"
      >
        <Plus aria-hidden="true" className="size-5 text-primary" />
        <span>Novo</span>
      </Button>
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
