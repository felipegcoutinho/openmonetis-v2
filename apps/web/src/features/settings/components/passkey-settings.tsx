import { formatDateInBrazil } from "@openmonetis/shared/date-time";
import { useQuery } from "@tanstack/react-query";
import { Fingerprint, LoaderCircle, Pencil, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { SettingsSection } from "@/components/settings-panel";
import { SettingsQueryError } from "@/components/settings-query-error";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { usePasskeySupport } from "@/hooks/usePasskeySupport";
import type { PasskeySummary } from "../settings.api";
import {
  useAddPasskeyMutation,
  useRemovePasskeyMutation,
  useRenamePasskeyMutation,
} from "../settings.mutations";
import { settingsMutationErrorMessage } from "../settings.presentation";
import { passkeysQueryOptions } from "../settings.queries";
import { PasskeyNameDialog } from "./passkey-name-dialog";

export function PasskeySettings() {
  const passkeySupported = usePasskeySupport();
  const passkeysQuery = useQuery(passkeysQueryOptions());
  const addMutation = useAddPasskeyMutation();
  const renameMutation = useRenamePasskeyMutation();
  const removeMutation = useRemovePasskeyMutation();
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<PasskeySummary | null>(null);
  const [deleting, setDeleting] = useState<PasskeySummary | null>(null);
  const isMutating = addMutation.isPending || renameMutation.isPending || removeMutation.isPending;

  async function add(name: string) {
    try {
      await addMutation.mutateAsync(name || undefined);
      setAddOpen(false);
      toast.success("Passkey cadastrada");
    } catch (error) {
      toast.error(settingsMutationErrorMessage(error));
    }
  }

  async function rename(passkey: PasskeySummary, name: string) {
    try {
      await renameMutation.mutateAsync({ id: passkey.id, name });
      setEditing(null);
      toast.success("Passkey renomeada");
    } catch (error) {
      toast.error(settingsMutationErrorMessage(error));
    }
  }

  async function remove(passkey: PasskeySummary) {
    try {
      await removeMutation.mutateAsync(passkey.id);
      setDeleting(null);
      toast.success("Passkey removida");
    } catch (error) {
      toast.error(settingsMutationErrorMessage(error));
    }
  }

  return (
    <>
      <SettingsSection
        className="border-b-0"
        contentClassName="grid gap-5"
        description="Uma alternativa à senha. Seus dados biométricos não são enviados ao OpenMonetis."
        icon={ShieldCheck}
        title="Chaves de acesso"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="font-medium text-sm">Passkeys cadastradas</p>
            <p className="mt-1 max-w-xl text-muted-foreground text-sm leading-relaxed">
              Entre com sua digital, rosto, PIN ou chave de segurança.
            </p>
          </div>
          <Button
            className="sm:self-start"
            disabled={!passkeySupported || isMutating}
            onClick={() => setAddOpen(true)}
            type="button"
          >
            <Plus aria-hidden="true" className="size-4" />
            Adicionar chave
          </Button>
        </div>

        {!passkeySupported ? (
          <p className="rounded-lg border border-border bg-muted/30 p-4 text-muted-foreground text-sm">
            Este navegador ou contexto não oferece suporte seguro a chaves de acesso. Use um
            navegador atualizado em HTTPS.
          </p>
        ) : null}

        {passkeysQuery.isPending ? <PasskeyListSkeleton /> : null}
        {passkeysQuery.isError ? (
          <SettingsQueryError
            message="Não foi possível carregar suas chaves de acesso."
            isRetrying={passkeysQuery.isFetching}
            onRetry={() => void passkeysQuery.refetch()}
          />
        ) : null}
        {passkeysQuery.data?.length === 0 ? (
          <div className="flex items-center gap-3 rounded-lg border border-dashed border-border p-5 text-muted-foreground">
            <Fingerprint aria-hidden="true" className="size-5 shrink-0" />
            <p className="text-sm">Você ainda não cadastrou uma chave de acesso.</p>
          </div>
        ) : null}
        {passkeysQuery.data && passkeysQuery.data.length > 0 ? (
          <div className="divide-y divide-border rounded-lg border border-border">
            {passkeysQuery.data.map((passkey) => (
              <PasskeyRow
                disabled={isMutating}
                key={passkey.id}
                onDelete={() => setDeleting(passkey)}
                onRename={() => setEditing(passkey)}
                passkey={passkey}
              />
            ))}
          </div>
        ) : null}

        <p className="text-muted-foreground text-sm leading-relaxed">
          Cadastre mais de uma chave para ter outra opção de acesso. Remova as chaves que você não
          utiliza mais.
        </p>
      </SettingsSection>

      {addOpen ? (
        <PasskeyNameDialog
          key="add-passkey"
          mode="add"
          onOpenChange={(open) => {
            if (!addMutation.isPending) setAddOpen(open);
          }}
          onSubmit={add}
          open
        />
      ) : null}
      {editing ? (
        <PasskeyNameDialog
          initialName={editing.name ?? editing.authenticatorName ?? ""}
          key={editing.id}
          mode="rename"
          onOpenChange={(open) => {
            if (!open && !renameMutation.isPending) setEditing(null);
          }}
          onSubmit={(name) => rename(editing, name)}
          open
        />
      ) : null}
      {deleting ? (
        <AlertDialog
          onOpenChange={(open) => {
            if (!open && !removeMutation.isPending) setDeleting(null);
          }}
          open
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogMedia className="bg-destructive/10 text-destructive">
                <Trash2 aria-hidden="true" />
              </AlertDialogMedia>
              <AlertDialogTitle>Remover esta chave de acesso?</AlertDialogTitle>
              <AlertDialogDescription>
                Ela deixará de funcionar imediatamente para novos logins. Esta ação não pode ser
                desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={removeMutation.isPending}>Cancelar</AlertDialogCancel>
              <Button
                disabled={removeMutation.isPending}
                onClick={() => void remove(deleting)}
                type="button"
                variant="destructive"
              >
                {removeMutation.isPending ? "Removendo..." : "Remover"}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : null}
    </>
  );
}

function PasskeyRow({
  disabled,
  onDelete,
  onRename,
  passkey,
}: {
  disabled: boolean;
  onDelete: () => void;
  onRename: () => void;
  passkey: PasskeySummary;
}) {
  const label = passkey.name || passkey.authenticatorName || "Chave de acesso";
  const deviceLabel =
    passkey.deviceType === "multiDevice" ? "Sincronizada" : "Vinculada a um dispositivo";
  const createdAt = passkey.createdAt
    ? formatDateInBrazil(passkey.createdAt, { dateStyle: "medium" })
    : null;

  return (
    <div className="flex items-center gap-2 p-4 sm:gap-3">
      <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-foreground">
        <Fingerprint aria-hidden="true" className="size-4" />
      </div>
      <div className="min-w-0 grow">
        <p className="truncate font-medium text-sm">{label}</p>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-muted-foreground text-xs">
          <span>{deviceLabel}</span>
          {passkey.backedUp ? <span>Com backup</span> : null}
          {createdAt ? <span>Criada em {createdAt}</span> : null}
        </div>
      </div>
      <Button
        aria-label={`Renomear ${label}`}
        disabled={disabled}
        onClick={onRename}
        size="icon"
        type="button"
        variant="ghost"
      >
        <Pencil aria-hidden="true" />
      </Button>
      <Button
        aria-label={`Remover ${label}`}
        className="text-muted-foreground hover:text-destructive"
        disabled={disabled}
        onClick={onDelete}
        size="icon"
        type="button"
        variant="ghost"
      >
        <Trash2 aria-hidden="true" />
      </Button>
    </div>
  );
}

function PasskeyListSkeleton() {
  return (
    <div className="grid gap-3" role="status">
      <span className="sr-only">Carregando chaves de acesso</span>
      {["first", "second"].map((item) => (
        <div className="flex items-center gap-3 rounded-lg border border-border p-4" key={item}>
          <Skeleton className="size-9 rounded-lg" />
          <div className="grid grow gap-2">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-3 w-56 max-w-full" />
          </div>
          <LoaderCircle aria-hidden="true" className="size-4 animate-spin text-muted-foreground" />
        </div>
      ))}
    </div>
  );
}
