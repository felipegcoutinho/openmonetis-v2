import {
  CreateDeviceTokenInputSchema,
  type CreatedDeviceTokenOutput,
} from "@openmonetis/validators/device-tokens";
import { useForm } from "@tanstack/react-form";
import { useQuery } from "@tanstack/react-query";
import { Clipboard, KeyRound, Plus, Smartphone, Trash2 } from "lucide-react";
import { useId, useState } from "react";
import { toast } from "sonner";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { showInvalidFormToast } from "@/lib/form-feedback";
import {
  useCreateDeviceTokenMutation,
  useRevokeDeviceTokenMutation,
} from "../device-tokens.mutations";
import { formatDeviceTokenDate, formatDeviceTokenLastUsed } from "../device-tokens.presentation";
import { deviceTokensQueryOptions } from "../device-tokens.queries";
import { DeviceTokenQrCode } from "./device-token-qr-code";

export function DeviceTokenSettings() {
  const query = useQuery(deviceTokensQueryOptions());
  const createMutation = useCreateDeviceTokenMutation();
  const revokeMutation = useRevokeDeviceTokenMutation();
  const [createOpen, setCreateOpen] = useState(false);
  const [createdToken, setCreatedToken] = useState<CreatedDeviceTokenOutput | null>(null);
  const [revokeId, setRevokeId] = useState<string | null>(null);
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-muted-foreground text-sm">
          Cada autorização pode ser removida individualmente.
        </p>
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
          <ul className="divide-y rounded-lg border">
            {query.data.map((token) => (
              <li className="flex flex-wrap items-center gap-3 p-4" key={token.id}>
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
                  <KeyRound aria-hidden="true" className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="break-all font-medium text-sm">{token.name}</p>
                    <Badge variant="outline">
                      {token.lastUsedAt ? "Acesso utilizado" : "Aguardando conexão"}
                    </Badge>
                  </div>
                  <p className="mt-1 text-muted-foreground text-sm">
                    {formatDeviceTokenLastUsed(token.lastUsedAt)} · expira em{" "}
                    {formatDeviceTokenDate(token.expiresAt)}
                  </p>
                </div>
                <Button
                  aria-label={`Revogar acesso de ${token.name}`}
                  className="text-muted-foreground hover:text-destructive"
                  disabled={revokeMutation.isPending}
                  onClick={() => setRevokeId(token.id)}
                  size="icon"
                  variant="ghost"
                >
                  <Trash2 aria-hidden="true" />
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="rounded-lg border border-dashed p-6 text-center">
            <KeyRound aria-hidden="true" className="mx-auto size-5 text-muted-foreground" />
            <p className="mt-2 font-medium text-sm">Nenhum aparelho autorizado</p>
            <p className="mt-1 text-muted-foreground text-sm">
              Conecte seu primeiro aparelho e siga as instruções abaixo.
            </p>
          </div>
        )
      ) : null}

      <Dialog onOpenChange={changeCreateOpen} open={createOpen}>
        <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto">
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
              <div className="text-center">
                <p className="font-medium text-sm">{createdToken.name}</p>
                <p className="text-muted-foreground text-sm">Aguardando conexão no Companion</p>
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
                No Companion, configure o endereço HTTPS da API antes de escanear. Depois, confira
                se uma notificação capturada aparece em pré-lançamentos.
              </p>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => changeCreateOpen(false)}>
                  Concluir
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <form
              className="grid gap-4"
              onSubmit={(event) => {
                event.preventDefault();
                void form.handleSubmit();
              }}
            >
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
