import { useStore } from "@tanstack/react-form";
import { useBlocker } from "@tanstack/react-router";
import { LoaderCircle, RotateCcw } from "lucide-react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import type { PreferencesFormApi } from "../usePreferencesForm";

export function PreferencesActions({
  form,
  isRestoring,
  onRestoreDefaults,
}: {
  form: PreferencesFormApi;
  isRestoring: boolean;
  onRestoreDefaults: () => Promise<void>;
}) {
  const hasChanges = useStore(form.store, (state) => !state.isDefaultValue);
  const isSubmitting = useStore(form.store, (state) => state.isSubmitting);
  const isBusy = isSubmitting || isRestoring;
  const blocker = useBlocker({
    shouldBlockFn: () => hasChanges || isBusy,
    enableBeforeUnload: hasChanges || isBusy,
    withResolver: true,
  });

  return (
    <>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-muted-foreground text-sm">
          As preferências são aplicadas somente ao salvar.
        </p>
        <Button
          disabled={isBusy}
          onClick={() => void onRestoreDefaults()}
          type="button"
          variant="ghost"
        >
          {isRestoring ? (
            <LoaderCircle aria-hidden="true" className="animate-spin" />
          ) : (
            <RotateCcw aria-hidden="true" />
          )}
          Carregar padrões
        </Button>
      </div>
      {hasChanges || isBusy ? (
        <div className="sticky bottom-4 z-20 flex flex-col gap-3 rounded-xl border border-border bg-background/95 p-4 shadow-lg backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between">
          <p className="font-medium text-sm" aria-live="polite">
            {isSubmitting
              ? "Salvando preferências…"
              : isRestoring
                ? "Carregando padrões…"
                : "Alterações não salvas"}
          </p>
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <Button disabled={isBusy} onClick={() => form.reset()} type="button" variant="outline">
              Descartar
            </Button>
            <Button disabled={isBusy || !hasChanges} type="submit">
              {isSubmitting ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : null}
              Salvar alterações
            </Button>
          </div>
        </div>
      ) : null}
      <AlertDialog
        open={blocker.status === "blocked"}
        onOpenChange={(open) => {
          if (!open) blocker.reset?.();
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isBusy ? "Aguarde a conclusão" : "Descartar alterações?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isBusy
                ? "As preferências estão sendo processadas. Aguarde antes de sair."
                : "Você tem preferências não salvas. Continue editando ou descarte para sair."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continuar editando</AlertDialogCancel>
            <Button
              disabled={isBusy}
              type="button"
              variant="destructive"
              onClick={() => {
                form.reset();
                blocker.proceed?.();
              }}
            >
              Descartar e sair
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
