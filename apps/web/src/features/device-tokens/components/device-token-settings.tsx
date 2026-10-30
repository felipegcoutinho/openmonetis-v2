import {
  CreateDeviceTokenInputSchema,
  type CreatedDeviceTokenOutput,
} from "@openmonetis/validators/device-tokens";
import { useForm } from "@tanstack/react-form";
import { useQuery } from "@tanstack/react-query";
import {
  CircleCheck,
  Clipboard,
  LoaderCircle,
  Plus,
  RefreshCw,
  Smartphone,
  Unplug,
} from "lucide-react";
import { useId, useState } from "react";
import { toast } from "sonner";
import { MobileFormContent as DialogContent } from "@/components/forms/mobile-form-content";
import { MobileFormDialog as Dialog } from "@/components/forms/mobile-form-dialog";
import { MobileFormState } from "@/components/forms/mobile-form-state";
import { SettingsSection } from "@/components/settings-panel";
import { SettingsQueryError } from "@/components/settings-query-error";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { showInvalidFormToast } from "@/lib/form-feedback";
import {
  useCreateDeviceTokenMutation,
  useRevokeDeviceTokenMutation,
  useRotateDeviceTokenMutation,
} from "../device-tokens.mutations";
import {
  formatDeviceTokenDate,
  formatDeviceTokenLastUsed,
  formatDeviceTokenRecentCaptures,
} from "../device-tokens.presentation";
import { deviceTokensQueryOptions } from "../device-tokens.queries";
import { DeviceTokenQrCode } from "./device-token-qr-code";

const connectionCheckIntervalMs = 3_000;

export function DeviceTokenSettings() {
  const [createOpen, setCreateOpen] = useState(false);
  const [createdToken, setCreatedToken] = useState<CreatedDeviceTokenOutput | null>(null);
  const query = useQuery({
    ...deviceTokensQueryOptions(),
    // While the QR Code is on screen, watch for the first request made with the new token.
    refetchInterval: (current) =>
      createdToken && !current.state.data?.find((token) => token.id === createdToken.id)?.lastUsedAt
        ? connectionCheckIntervalMs
        : false,
  });
  const createMutation = useCreateDeviceTokenMutation();
  const revokeMutation = useRevokeDeviceTokenMutation();
  const rotateMutation = useRotateDeviceTokenMutation();
  const [revokeId, setRevokeId] = useState<string | null>(null);
  const [rotateId, setRotateId] = useState<string | null>(null);
  const createdTokenConnected = Boolean(
    createdToken && query.data?.find((token) => token.id === createdToken.id)?.lastUsedAt,
  );
  const nameId = useId();
  const form = useForm({
    defaultValues: { name: "" },
    onSubmitInvalid: showInvalidFormToast,
    validators: {
      onSubmit: ({ value }) =>
        CreateDeviceTokenInputSchema.safeParse(value).success
          ? undefined
          : { fields: { name: "Informe um nome com até 80 caracteres." } },
    },
    onSubmit: async ({ value }) => {
      try {
        const created = await createMutation.mutateAsync(CreateDeviceTokenInputSchema.parse(value));
        setCreatedToken(created);
        form.reset();
        toast.success("Token criado");
      } catch {
        toast.error("Não foi possível criar o token.");
      }
    },
  });

  function changeCreateOpen(open: boolean) {
    if (createMutation.isPending) return;
    if (!open && createdToken) setCreatedToken(null);
    setCreateOpen(open);
    if (!open) form.reset();
  }

  async function copyToken(token: string) {
    try {
      await navigator.clipboard.writeText(token);
      toast.success("Token copiado");
    } catch {
      toast.error("Não foi possível copiar. Selecione o token manualmente.");
    }
  }

  async function rotate(id: string) {
    try {
      const rotated = await rotateMutation.mutateAsync(id);
      setRotateId(null);
      setCreatedToken(rotated);
      setCreateOpen(true);
      toast.success("Token renovado");
    } catch {
      toast.error("Não foi possível renovar o token.");
    }
  }

  async function revoke(id: string) {
    try {
      await revokeMutation.mutateAsync(id);
      toast.success("Acesso revogado");
      setRevokeId(null);
    } catch {
      toast.error("Não foi possível revogar o token.");
    }
  }

  return (
    <SettingsSection
      contentClassName="grid gap-5"
      description="Autorize cada Android que pode enviar capturas para sua conta."
      icon={Smartphone}
      title="Aparelhos do Companion"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-medium text-sm">Aparelhos autorizados</p>
          <p className="mt-1 max-w-xl text-muted-foreground text-sm leading-relaxed">
            Gerencie os aparelhos conectados e remova os acessos que não utiliza mais.
          </p>
        </div>
        <Button className="w-full sm:w-auto" onClick={() => setCreateOpen(true)} type="button">
          <Plus aria-hidden="true" /> Conectar aparelho
        </Button>
      </div>

      {query.isLoading ? (
        <div className="grid gap-2" role="status" aria-label="Carregando acessos">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
      ) : null}
      {query.isError ? (
        <SettingsQueryError
          message="Não foi possível carregar os aparelhos."
          isRetrying={query.isFetching}
          onRetry={() => void query.refetch()}
        />
      ) : null}
      {query.data && !query.isError ? (
        query.data.length ? (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {query.data.map((token) => (
              <li className="flex items-center gap-2 p-4 sm:gap-3" key={token.id}>
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-foreground">
                  <Smartphone aria-hidden="true" className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-center gap-2">
                    <p className="truncate font-medium text-sm" title={token.name}>
                      {token.name}
                    </p>
                    {token.expiresSoon ? (
                      <Badge className="shrink-0" variant="destructive">
                        Expira em breve
                      </Badge>
                    ) : null}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-muted-foreground text-xs">
                    <span>{formatDeviceTokenLastUsed(token.lastUsedAt)}</span>
                    <span>{formatDeviceTokenRecentCaptures(token.recentCaptureCount)}</span>
                    <span>Expira em {formatDeviceTokenDate(token.expiresAt)}</span>
                  </div>
                </div>
                <Button
                  aria-label={`Renovar token de ${token.name}`}
                  className="text-muted-foreground"
                  disabled={rotateMutation.isPending || revokeMutation.isPending}
                  onClick={() => setRotateId(token.id)}
                  size="icon"
                  title="Renovar token"
                  type="button"
                  variant="ghost"
                >
                  <RefreshCw aria-hidden="true" />
                </Button>
                <Button
                  aria-label={`Revogar acesso de ${token.name}`}
                  className="text-muted-foreground hover:text-destructive"
                  disabled={revokeMutation.isPending || rotateMutation.isPending}
                  onClick={() => setRevokeId(token.id)}
                  size="icon"
                  title="Revogar acesso"
                  type="button"
                  variant="ghost"
                >
                  <Unplug aria-hidden="true" />
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex items-center gap-3 rounded-lg border border-dashed border-border p-5 text-muted-foreground">
            <Smartphone aria-hidden="true" className="size-5 shrink-0" />
            <p className="text-sm">Você ainda não conectou um aparelho ao Companion.</p>
          </div>
        )
      ) : null}

      <Dialog onOpenChange={changeCreateOpen} open={createOpen}>
        <DialogContent guarded className="max-h-[calc(100svh-2rem)] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {createdToken ? "Conclua a conexão no Android" : "Conectar aparelho"}
            </DialogTitle>
            <DialogDescription>
              {createdToken
                ? "Escaneie ou copie agora. O token não será exibido novamente ao fechar esta janela."
                : "Use um nome que ajude a reconhecer o aparelho depois."}
            </DialogDescription>
          </DialogHeader>
          {createdToken ? (
            <div className="grid gap-3">
              <div className="grid justify-items-center gap-1 text-center">
                <p className="font-medium text-sm">{createdToken.name}</p>
                <p
                  aria-live="polite"
                  className={
                    createdTokenConnected
                      ? "flex items-center gap-1.5 font-medium text-sm text-success"
                      : "flex items-center gap-1.5 text-muted-foreground text-sm"
                  }
                >
                  {createdTokenConnected ? (
                    <>
                      <CircleCheck aria-hidden="true" className="size-4" />
                      Aparelho conectado
                    </>
                  ) : (
                    <>
                      <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
                      Aguardando conexão no Companion
                    </>
                  )}
                </p>
              </div>
              <DeviceTokenQrCode token={createdToken.token} />
              <div className="rounded-lg border bg-muted/40 p-3">
                <code className="block break-all font-mono text-xs select-all">
                  {createdToken.token}
                </code>
              </div>
              <Button onClick={() => void copyToken(createdToken.token)} type="button">
                <Clipboard aria-hidden="true" /> Copiar token
              </Button>
              <p className="text-muted-foreground text-sm leading-relaxed">
                No Companion, configure o endereço HTTPS da API antes de escanear.
              </p>
              <DialogFooter>
                <Button
                  type="button"
                  variant={createdTokenConnected ? "default" : "outline"}
                  onClick={() => changeCreateOpen(false)}
                >
                  Concluir
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <form
              data-mobile-page-form
              className="grid gap-4"
              onSubmit={(event) => {
                event.preventDefault();
                void form.handleSubmit();
              }}
            >
              <form.Subscribe
                selector={(state) => ({
                  isDirty: !state.isDefaultValue,
                  isSubmitting: state.isSubmitting,
                })}
              >
                {(state) => <MobileFormState {...state} />}
              </form.Subscribe>
              <form.Field name="name">
                {(field) => (
                  <div className="grid gap-2">
                    <Label htmlFor={nameId}>Nome do aparelho</Label>
                    <Input
                      aria-invalid={field.state.meta.errors.length > 0}
                      aria-describedby={
                        field.state.meta.errors.length ? `${nameId}-error` : undefined
                      }
                      disabled={createMutation.isPending}
                      autoComplete="off"
                      id={nameId}
                      maxLength={80}
                      onBlur={field.handleBlur}
                      onChange={(event) => field.handleChange(event.target.value)}
                      placeholder="Ex.: Celular pessoal"
                      value={field.state.value}
                    />
                    {field.state.meta.errors.length ? (
                      <p className="text-destructive text-sm" id={`${nameId}-error`} role="alert">
                        Informe um nome com até 80 caracteres.
                      </p>
                    ) : null}
                  </div>
                )}
              </form.Field>
              <DialogFooter>
                <Button
                  data-mobile-cancel
                  disabled={createMutation.isPending}
                  onClick={() => changeCreateOpen(false)}
                  type="button"
                  variant="outline"
                >
                  Cancelar
                </Button>
                <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
                  {([canSubmit, isSubmitting]) => (
                    <Button disabled={!canSubmit || isSubmitting} type="submit">
                      {isSubmitting ? "Preparando…" : "Continuar"}
                    </Button>
                  )}
                </form.Subscribe>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog
        onOpenChange={(open) => {
          if (!open && !rotateMutation.isPending) setRotateId(null);
        }}
        open={Boolean(rotateId)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Renovar este token?</AlertDialogTitle>
            <AlertDialogDescription>
              O token atual de {query.data?.find((token) => token.id === rotateId)?.name} deixa de
              funcionar agora. Em seguida, conecte o aparelho de novo com o novo QR Code. Capturas
              já recebidas serão mantidas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={rotateMutation.isPending}>Cancelar</AlertDialogCancel>
            <Button
              disabled={rotateMutation.isPending}
              onClick={() => {
                if (rotateId) void rotate(rotateId);
              }}
              type="button"
            >
              {rotateMutation.isPending ? "Renovando…" : "Renovar"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        onOpenChange={(open) => {
          if (!open && !revokeMutation.isPending) setRevokeId(null);
        }}
        open={Boolean(revokeId)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revogar este acesso?</AlertDialogTitle>
            <AlertDialogDescription>
              O aparelho {query.data?.find((token) => token.id === revokeId)?.name} deixará de
              enviar notificações imediatamente. Capturas já recebidas serão mantidas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={revokeMutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={revokeMutation.isPending}
              onClick={() => {
                if (revokeId) void revoke(revokeId);
              }}
              variant="destructive"
            >
              {revokeMutation.isPending ? "Revogando…" : "Revogar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SettingsSection>
  );
}
