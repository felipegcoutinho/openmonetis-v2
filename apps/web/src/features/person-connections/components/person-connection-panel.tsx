import type { PersonOutput } from "@openmonetis/validators/people";
import { useQuery } from "@tanstack/react-query";
import {
  Check,
  CheckCircle2,
  Clipboard,
  Clock3,
  KeyRound,
  Link2,
  Loader2,
  LockKeyhole,
  ReceiptText,
  RefreshCw,
  ShieldCheck,
  Unlink,
} from "lucide-react";
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
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  useCancelPersonConnectionInvitationMutation,
  useConfirmPersonConnectionInvitationMutation,
  useCreatePersonConnectionInvitationMutation,
  useRevokePersonConnectionMutation,
} from "../person-connections.mutations";
import {
  activePersonConnectionLabel,
  claimedPersonConnectionInvitationLabel,
  pendingPersonConnectionInvitationLabel,
} from "../person-connections.presentation";
import {
  personConnectionInvitationsQueryOptions,
  personConnectionsQueryOptions,
} from "../person-connections.queries";

type DestructiveAction = "cancelInvitation" | "revokeConnection" | null;

export function PersonConnectionPanel({ person }: { person: PersonOutput }) {
  const connections = useQuery(personConnectionsQueryOptions());
  const invitations = useQuery(personConnectionInvitationsQueryOptions());
  const createInvitation = useCreatePersonConnectionInvitationMutation();
  const cancelInvitation = useCancelPersonConnectionInvitationMutation();
  const confirmInvitation = useConfirmPersonConnectionInvitationMutation();
  const revokeConnection = useRevokePersonConnectionMutation();
  const confirmationCodeId = useId();
  const confirmationCodeHintId = useId();
  const [confirmationCode, setConfirmationCode] = useState("");
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [destructiveAction, setDestructiveAction] = useState<DestructiveAction>(null);

  if (person.role === "admin") return null;

  const connection = connections.data?.find(
    (candidate) =>
      candidate.perspective === "owner" &&
      candidate.personId === person.id &&
      candidate.status === "active",
  );
  const invitation = invitations.data?.find(
    (candidate) =>
      candidate.personId === person.id && ["pending", "claimed"].includes(candidate.status),
  );
  const isLoading = connections.isLoading || invitations.isLoading;
  const isError = connections.isError || invitations.isError;
  const isDestructiveActionPending = cancelInvitation.isPending || revokeConnection.isPending;

  async function create() {
    try {
      const created = await createInvitation.mutateAsync(person.id);
      const url = new URL("/person-connections/accept", window.location.origin);
      url.hash = created.token;
      setInviteUrl(url.toString());
      toast.success("Convite criado");
    } catch {
      toast.error("Não foi possível criar o convite.");
    }
  }

  async function copyInvite(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Convite copiado");
    } catch {
      toast.error("Não foi possível copiar o convite.");
    }
  }

  async function confirm(invitationId: string) {
    try {
      await confirmInvitation.mutateAsync({ id: invitationId, confirmationCode });
      setConfirmationCode("");
      setInviteUrl(null);
      toast.success("Conta conectada com segurança");
    } catch {
      toast.error("Código inválido, expirado ou bloqueado.");
    }
  }

  async function completeDestructiveAction() {
    try {
      if (destructiveAction === "cancelInvitation" && invitation) {
        await cancelInvitation.mutateAsync(invitation.id);
        setInviteUrl(null);
        toast.success("Convite cancelado");
      }

      if (destructiveAction === "revokeConnection" && connection) {
        await revokeConnection.mutateAsync(connection.id);
        toast.success("Conta desconectada");
      }

      setDestructiveAction(null);
    } catch {
      toast.error(
        destructiveAction === "revokeConnection"
          ? "Não foi possível desconectar a conta."
          : "Não foi possível cancelar o convite.",
      );
    }
  }

  function retryQueries() {
    void Promise.all([connections.refetch(), invitations.refetch()]);
  }

  const destructiveDialogContent =
    destructiveAction === "revokeConnection"
      ? {
          title: "Desconectar esta conta?",
          description: `Novos gastos de ${person.name} deixarão de ser enviados para ${connection?.counterpartName ?? "a conta conectada"}.`,
          action: "Desconectar",
        }
      : {
          title: "Cancelar este convite?",
          description:
            "O link deixará de funcionar imediatamente. Você poderá criar um novo convite depois.",
          action: "Cancelar convite",
        };

  return (
    <>
      <Card className="gap-0 overflow-hidden py-0">
        <div className="flex flex-col gap-3 border-b bg-linear-to-br from-brand/10 via-card to-card px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand/10 text-brand-strong ring-1 ring-brand-strong/15">
              <ShieldCheck aria-hidden="true" className="size-4" />
            </span>
            <div className="min-w-0">
              <h2 className="font-heading font-semibold tracking-tight">Conexão da conta</h2>
              <p className="mt-0.5 max-w-2xl text-muted-foreground text-sm leading-relaxed">
                Compartilhe os gastos de {person.name} para revisão sem abrir seus dados
                financeiros.
              </p>
            </div>
          </div>
          <ConnectionStatusBadge
            hasActiveConnection={connection?.status === "active"}
            invitationStatus={invitation?.status}
            isError={isError}
            isLoading={isLoading}
          />
        </div>

        <CardContent className="grid gap-4 p-4">
          <section className="grid gap-3" aria-live="polite">
            {isLoading ? <ConnectionLoading /> : null}
            {isError && !isLoading ? <ConnectionError onRetry={retryQueries} /> : null}
            {!isLoading && !isError && connection?.status === "active" ? (
              <ActiveConnection
                counterpartName={connection.counterpartName}
                isPending={revokeConnection.isPending}
                onDisconnect={() => setDestructiveAction("revokeConnection")}
              />
            ) : null}
            {!isLoading && !isError && !connection && invitation?.status === "claimed" ? (
              <div className="grid gap-4">
                <div>
                  <p className="font-semibold">Confirme com um código de 6 dígitos</p>
                  <p className="mt-1 text-muted-foreground text-sm leading-relaxed">
                    {invitation.claimedAccountName ?? "Uma conta"} abriu o convite. Peça o código
                    exibido na conta de {person.name} e confira antes de conectar.
                  </p>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor={confirmationCodeId}>Código de confirmação</Label>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Input
                      aria-describedby={confirmationCodeHintId}
                      autoComplete="one-time-code"
                      className="h-10 font-mono text-base tracking-[0.3em] sm:max-w-48"
                      id={confirmationCodeId}
                      inputMode="numeric"
                      maxLength={6}
                      onChange={(event) =>
                        setConfirmationCode(event.target.value.replace(/\D/g, ""))
                      }
                      placeholder="000000"
                      value={confirmationCode}
                    />
                    <Button
                      className="h-10 sm:min-w-32"
                      disabled={confirmationCode.length !== 6 || confirmInvitation.isPending}
                      onClick={() => void confirm(invitation.id)}
                    >
                      {confirmInvitation.isPending ? (
                        <Loader2 aria-hidden="true" className="animate-spin" />
                      ) : (
                        <Check aria-hidden="true" />
                      )}
                      Confirmar
                    </Button>
                  </div>
                  <p className="text-muted-foreground text-xs" id={confirmationCodeHintId}>
                    Só confirme se o nome e o código coincidirem.
                  </p>
                </div>
              </div>
            ) : null}
            {!isLoading && !isError && !connection && invitation?.status === "pending" ? (
              <PendingInvitation
                hasInviteUrl={Boolean(inviteUrl)}
                isCancelPending={cancelInvitation.isPending}
                onCancel={() => setDestructiveAction("cancelInvitation")}
                onCopy={() => {
                  if (inviteUrl) void copyInvite(inviteUrl);
                }}
              />
            ) : null}
            {!isLoading && !isError && !connection && !invitation ? (
              <EmptyConnection
                isPending={createInvitation.isPending}
                onCreate={() => void create()}
                personName={person.name}
              />
            ) : null}
          </section>

          <Card className="grid gap-3 bg-muted/25 p-4">
            <div>
              <p className="font-medium text-sm">Privacidade preservada</p>
              <p className="mt-1 text-muted-foreground text-xs leading-relaxed">
                A outra conta recebe apenas o necessário para revisar despesas atribuídas.
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <PrivacyItem icon={ReceiptText}>
                Gastos atribuídos a {person.name} podem ser enviados.
              </PrivacyItem>
              <PrivacyItem icon={LockKeyhole}>
                Contas, cartões, saldos e histórico continuam privados.
              </PrivacyItem>
            </div>
          </Card>
        </CardContent>
      </Card>

      <AlertDialog
        onOpenChange={(open) => {
          if (!open && !isDestructiveActionPending) setDestructiveAction(null);
        }}
        open={destructiveAction !== null}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-destructive/10 text-destructive">
              <Unlink aria-hidden="true" />
            </AlertDialogMedia>
            <AlertDialogTitle>{destructiveDialogContent.title}</AlertDialogTitle>
            <AlertDialogDescription>{destructiveDialogContent.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDestructiveActionPending}>Voltar</AlertDialogCancel>
            <AlertDialogAction
              disabled={isDestructiveActionPending}
              onClick={(event) => {
                event.preventDefault();
                void completeDestructiveAction();
              }}
              variant="destructive"
            >
              {isDestructiveActionPending ? (
                <Loader2 aria-hidden="true" className="animate-spin" />
              ) : null}
              {destructiveDialogContent.action}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function ConnectionStatusBadge({
  hasActiveConnection,
  invitationStatus,
  isError,
  isLoading,
}: {
  hasActiveConnection: boolean;
  invitationStatus?: string;
  isError: boolean;
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <Badge className="bg-background/70 text-muted-foreground" variant="outline">
        <Loader2 aria-hidden="true" className="animate-spin" /> Carregando
      </Badge>
    );
  }

  if (isError) return <Badge variant="destructive">Indisponível</Badge>;

  if (hasActiveConnection) {
    return (
      <Badge className="border-success/20 bg-success/10 text-success" variant="outline">
        <CheckCircle2 aria-hidden="true" /> {activePersonConnectionLabel}
      </Badge>
    );
  }

  if (invitationStatus === "claimed") {
    return (
      <Badge className="border-warning/30 bg-warning/10 text-foreground" variant="outline">
        <KeyRound aria-hidden="true" /> {claimedPersonConnectionInvitationLabel}
      </Badge>
    );
  }

  if (invitationStatus === "pending") {
    return (
      <Badge className="border-info/20 bg-info/10 text-info" variant="outline">
        <Clock3 aria-hidden="true" /> {pendingPersonConnectionInvitationLabel}
      </Badge>
    );
  }

  return (
    <Badge className="bg-background/70 text-muted-foreground" variant="outline">
      Não conectada
    </Badge>
  );
}

function PrivacyItem({
  children,
  icon: Icon,
}: {
  children: React.ReactNode;
  icon: typeof ReceiptText;
}) {
  return (
    <div className="flex items-start gap-2.5 text-sm">
      <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-background text-brand-strong shadow-xs ring-1 ring-border">
        <Icon aria-hidden="true" className="size-4" />
      </span>
      <p className="pt-0.5 text-muted-foreground leading-relaxed">{children}</p>
    </div>
  );
}

function ConnectionLoading() {
  return (
    <div className="flex items-center gap-3 text-muted-foreground text-sm">
      <Loader2 aria-hidden="true" className="size-5 animate-spin text-brand-strong" />
      Verificando o status da conexão...
    </div>
  );
}

function ConnectionError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-start gap-3">
      <div>
        <p className="font-semibold">Não foi possível verificar a conexão</p>
        <p className="mt-1 text-muted-foreground text-sm">
          Tente novamente para ver o status atualizado.
        </p>
      </div>
      <Button onClick={onRetry} size="sm" variant="outline">
        <RefreshCw aria-hidden="true" /> Tentar novamente
      </Button>
    </div>
  );
}

function ActiveConnection({
  counterpartName,
  isPending,
  onDisconnect,
}: {
  counterpartName: string;
  isPending: boolean;
  onDisconnect: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-success/10 text-success">
          <Link2 aria-hidden="true" className="size-4" />
        </span>
        <div className="min-w-0">
          <p className="font-semibold">Conectada com {counterpartName}</p>
          <p className="mt-0.5 text-muted-foreground text-sm">
            Os gastos atribuídos já podem ser enviados para revisão.
          </p>
        </div>
      </div>
      <Button disabled={isPending} onClick={onDisconnect} size="sm" variant="outline">
        <Unlink aria-hidden="true" /> Desconectar
      </Button>
    </div>
  );
}

function PendingInvitation({
  hasInviteUrl,
  isCancelPending,
  onCancel,
  onCopy,
}: {
  hasInviteUrl: boolean;
  isCancelPending: boolean;
  onCancel: () => void;
  onCopy: () => void;
}) {
  return (
    <div className="grid gap-4">
      <div>
        <p className="font-semibold">Aguardando a outra pessoa</p>
        <p className="mt-1 text-muted-foreground text-sm leading-relaxed">
          {hasInviteUrl
            ? "Envie o link por um canal confiável. Ele funciona uma única vez e ainda exige confirmação por código."
            : "O link não fica salvo por segurança. Se você o perdeu, cancele este convite e crie outro."}
        </p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        {hasInviteUrl ? (
          <Button onClick={onCopy}>
            <Clipboard aria-hidden="true" /> Copiar convite
          </Button>
        ) : null}
        <Button
          className="sm:ml-auto"
          disabled={isCancelPending}
          onClick={onCancel}
          variant="ghost"
        >
          Cancelar convite
        </Button>
      </div>
    </div>
  );
}

function EmptyConnection({
  isPending,
  onCreate,
  personName,
}: {
  isPending: boolean;
  onCreate: () => void;
  personName: string;
}) {
  return (
    <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="font-semibold">Revise despesas em conjunto</p>
        <p className="mt-1 max-w-xl text-muted-foreground text-sm leading-relaxed">
          Crie um convite seguro para conectar a conta de {personName}. Você confirma a conexão
          depois que a outra pessoa aceitar.
        </p>
      </div>
      <Button className="w-full sm:w-auto" disabled={isPending} onClick={onCreate}>
        {isPending ? (
          <Loader2 aria-hidden="true" className="animate-spin" />
        ) : (
          <Link2 aria-hidden="true" />
        )}
        Criar convite
      </Button>
    </div>
  );
}
