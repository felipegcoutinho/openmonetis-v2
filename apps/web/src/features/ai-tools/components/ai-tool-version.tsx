import type { AiProvider } from "@openmonetis/domain/ai-providers";
import { type AiToolInstallStep, aiToolInstallSteps } from "@openmonetis/domain/ai-tools";
import type { AiToolOutput } from "@openmonetis/validators/ai-tools";
import { useForm } from "@tanstack/react-form";
import { CircleAlert, LoaderCircle, PackageCheck, RotateCcw } from "lucide-react";
import { useId, useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { aiProviderLabels } from "@/features/ai-providers/ai-providers.presentation";
import { cn } from "@/lib/utils";
import { useActivateAiToolMutation, useInstallAiToolMutation } from "../ai-tools.mutations";
import {
  aiToolErrorMessage,
  aiToolFailureMessages,
  aiToolInstallStepLabels,
  aiToolRollbackTarget,
  formatAiToolActiveVersion,
  formatAiToolReleaseStatus,
} from "../ai-tools.presentation";

/**
 * The CLI version a provider runs, with its update and rollback actions; rendered inside the
 * provider's row and only for the installation admin.
 */
export function AiToolVersion({
  canTestWithAccount,
  installing,
  tool,
}: {
  canTestWithAccount: boolean;
  installing: boolean;
  tool: AiToolOutput;
}) {
  const [confirming, setConfirming] = useState<"install" | "rollback" | null>(null);
  const activateMutation = useActivateAiToolMutation();
  const rollback = aiToolRollbackTarget(tool);
  const job = tool.job;
  const running = job?.status === "pending";
  const label = aiProviderLabels[tool.provider];
  const canInstall = Boolean(tool.latest && !tool.latest.blocker);

  async function goBack() {
    if (!rollback) return;
    try {
      await activateMutation.mutateAsync({ provider: tool.provider, version: rollback.version });
      toast.success(`${label} voltou para ${rollback.label}`);
      setConfirming(null);
    } catch (error) {
      toast.error(aiToolErrorMessage(error));
    }
  }

  return (
    <div className="mt-1 grid gap-1.5">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
        <span className="flex items-center gap-1.5 font-mono text-foreground/80">
          <PackageCheck aria-hidden="true" className="size-3.5 text-muted-foreground" />
          <span className="sr-only">Versão em uso: </span>
          {formatAiToolActiveVersion(tool)}
        </span>
        <span
          className={cn("font-mono", canInstall ? "text-brand-strong" : "text-muted-foreground")}
        >
          · {formatAiToolReleaseStatus(tool)}
        </span>
        {canInstall && tool.latest ? (
          <Button
            disabled={installing}
            onClick={() => setConfirming("install")}
            size="xs"
            type="button"
            variant="outline"
          >
            Atualizar
          </Button>
        ) : null}
        {rollback ? (
          <Button
            className="text-muted-foreground"
            disabled={installing || activateMutation.isPending}
            onClick={() => setConfirming("rollback")}
            size="xs"
            type="button"
            variant="ghost"
          >
            <RotateCcw aria-hidden="true" />
            Voltar para <span className="font-mono">{rollback.label}</span>
          </Button>
        ) : null}
      </div>

      {running && job ? <InstallProgress step={job.step} /> : null}
      {job?.status === "failed" && job.failureCode ? (
        <p className="flex items-start gap-2 text-destructive text-xs" role="alert">
          <CircleAlert aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
          <span>
            <span className="font-mono">{job.version}</span>:{" "}
            {aiToolFailureMessages[job.failureCode]} A versão em uso não mudou.
          </span>
        </p>
      ) : null}

      {confirming === "install" && tool.latest ? (
        <InstallDialog
          canTestWithAccount={canTestWithAccount}
          onClose={() => setConfirming(null)}
          provider={tool.provider}
          version={tool.latest.version}
        />
      ) : null}

      <AlertDialog
        onOpenChange={(open) => {
          if (!open) setConfirming(null);
        }}
        open={confirming === "rollback"}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Voltar o {label} para {rollback?.label}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Diagnósticos e conversas em andamento terminam com a versão atual; os próximos usam{" "}
              {rollback?.label}. A versão atual fica guardada para você voltar a ela.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={activateMutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction disabled={activateMutation.isPending} onClick={() => void goBack()}>
              {activateMutation.isPending ? "Voltando…" : "Voltar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function InstallProgress({ step }: { step: AiToolInstallStep }) {
  const current = aiToolInstallSteps.indexOf(step);
  return (
    <ol aria-label="Progresso da atualização" className="flex flex-wrap gap-x-4 gap-y-1">
      {aiToolInstallSteps.map((item, index) => (
        <li
          aria-current={index === current ? "step" : undefined}
          className={cn(
            "flex items-center gap-1.5 font-mono text-xs",
            index === current ? "text-foreground" : "text-muted-foreground",
            index > current && "opacity-60",
          )}
          key={item}
        >
          {index === current ? (
            <LoaderCircle aria-hidden="true" className="size-3.5 animate-spin text-brand-strong" />
          ) : null}
          {aiToolInstallStepLabels[item]}
        </li>
      ))}
    </ol>
  );
}

function InstallDialog({
  canTestWithAccount,
  onClose,
  provider,
  version,
}: {
  canTestWithAccount: boolean;
  onClose: () => void;
  provider: AiProvider;
  version: string;
}) {
  const mutation = useInstallAiToolMutation();
  const canaryId = useId();
  const label = aiProviderLabels[provider];
  const form = useForm({
    defaultValues: { canary: false },
    onSubmit: async ({ value }) => {
      try {
        const job = await mutation.mutateAsync({ provider, version, canary: value.canary });
        if (job.status === "failed" && job.failureCode) {
          toast.error(aiToolFailureMessages[job.failureCode]);
        } else {
          toast.success(`Atualização do ${label} iniciada`);
        }
        onClose();
      } catch (error) {
        toast.error(aiToolErrorMessage(error));
      }
    },
  });

  return (
    <AlertDialog
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      open
    >
      <AlertDialogContent>
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            void form.handleSubmit();
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>
              Atualizar o {label} para {version}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              A versão é baixada da origem oficial, conferida e testada. Se tudo der certo, passa a
              valer nos próximos diagnósticos e conversas de todas as contas; a versão atual fica
              guardada para voltar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <form.Field name="canary">
            {(field) => (
              <div className={cn("flex items-start gap-3", !canTestWithAccount && "opacity-60")}>
                <Checkbox
                  checked={field.state.value}
                  disabled={!canTestWithAccount}
                  id={canaryId}
                  onCheckedChange={(checked) => field.handleChange(checked === true)}
                />
                <Label className="grid gap-0.5 font-normal" htmlFor={canaryId}>
                  <span className="text-sm">Testar com a minha conta antes de ativar</span>
                  <span className="text-muted-foreground text-xs leading-relaxed">
                    {canTestWithAccount
                      ? "Faz uma consulta curta, sem dados financeiros, que conta no limite do seu plano."
                      : `Conecte o ${label} para fazer este teste.`}
                  </span>
                </Label>
              </div>
            )}
          </form.Field>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={mutation.isPending}>Cancelar</AlertDialogCancel>
            <form.Subscribe selector={(state) => state.isSubmitting}>
              {(isSubmitting) => (
                <Button disabled={isSubmitting} type="submit">
                  {isSubmitting ? "Iniciando…" : "Atualizar"}
                </Button>
              )}
            </form.Subscribe>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
