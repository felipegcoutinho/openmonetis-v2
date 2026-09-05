import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  Check,
  CheckCircle2,
  Clipboard,
  Clock3,
  Link2,
  Loader2,
  LockKeyhole,
  ReceiptText,
  RefreshCw,
  ShieldCheck,
  ShieldX,
} from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useClaimPersonConnectionInvitationMutation } from "../person-connections.mutations";
import { formatPersonConnectionConfirmationExpiry } from "../person-connections.presentation";
import { personConnectionsQueryOptions } from "../person-connections.queries";

export function PersonConnectionAcceptPage() {
  const claim = useClaimPersonConnectionInvitationMutation();
  const navigate = useNavigate();
  const redirectedConnectionId = useRef<string | null>(null);
  const [result, setResult] = useState<Awaited<ReturnType<typeof claim.mutateAsync>> | null>(null);
  const [hasClaimError, setHasClaimError] = useState(false);
  const token = useSyncExternalStore(subscribeToLocationHash, readLocationHash, readServerHash);
  const connections = useQuery({
    ...personConnectionsQueryOptions(),
    enabled: Boolean(result),
    refetchInterval: (query) => {
      if (!result) return false;
      const wasActivated = query.state.data?.some(
        (connection) =>
          connection.invitationId === result.invitationId &&
          connection.perspective === "recipient" &&
          connection.status === "active",
      );
      return wasActivated ? false : 2_000;
    },
  });
  const activatedConnection = connections.data?.find(
    (connection) =>
      connection.invitationId === result?.invitationId &&
      connection.perspective === "recipient" &&
      connection.status === "active",
  );

  useEffect(() => {
    if (!activatedConnection || redirectedConnectionId.current === activatedConnection.id) return;
    redirectedConnectionId.current = activatedConnection.id;
    toast.success(`Conta conectada com ${activatedConnection.counterpartName}`);
    void navigate({
      to: "/people/$personId",
      params: { personId: "admin" },
      search: { period: undefined, view: "external" },
    });
  }, [activatedConnection, navigate]);

  async function accept() {
    setHasClaimError(false);
    try {
      const claimed = await claim.mutateAsync(token);
      window.history.replaceState(null, "", window.location.pathname);
      setResult(claimed);
      toast.success("Convite aceito");
    } catch {
      setHasClaimError(true);
      toast.error("Convite inválido, expirado ou já utilizado.");
    }
  }

  async function copyConfirmationCode(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      toast.success("Código copiado");
    } catch {
      toast.error("Não foi possível copiar o código.");
    }
  }

  return (
    <section className="app-page project-container">
      <PageHeader
        breadcrumbs={[{ label: "Visão geral", href: "/dashboard" }, { label: "Conectar conta" }]}
        description="Confira o que será compartilhado antes de vincular sua conta com segurança."
        icon={<ShieldCheck aria-hidden="true" className="size-5" />}
        title="Revisar conexão"
      />

      <Card className="gap-0 overflow-hidden py-0">
        <div className="flex flex-col gap-4 border-b bg-gradient-to-br from-brand/10 via-card to-card px-6 py-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand-strong ring-1 ring-brand-strong/15">
              {result ? (
                <CheckCircle2 aria-hidden="true" className="size-5" />
              ) : (
                <Link2 aria-hidden="true" className="size-5" />
              )}
            </span>
            <div className="min-w-0">
              <h2 className="font-heading font-semibold text-lg tracking-tight">
                {result ? "Agora compartilhe o código" : "Convite para compartilhar despesas"}
              </h2>
              <p className="mt-0.5 max-w-2xl text-muted-foreground text-sm leading-relaxed">
                {result
                  ? `${result.ownerName} precisa confirmar este código para concluir a conexão.`
                  : "A conexão só começa depois que você aceitar e a outra pessoa confirmar o código."}
              </p>
            </div>
          </div>
          <Badge
            className={
              result
                ? "border-success/20 bg-success/10 text-success"
                : "border-info/20 bg-info/10 text-info"
            }
            variant="outline"
          >
            {result ? <CheckCircle2 aria-hidden="true" /> : <Clock3 aria-hidden="true" />}
            {result ? "Aguardando confirmação" : "Revisão necessária"}
          </Badge>
        </div>

        <CardContent className="grid p-0 lg:grid-cols-[minmax(0,0.9fr)_minmax(22rem,1.1fr)]">
          <ConnectionPrivacy personName={result?.personName} />

          <section className="grid min-h-80 content-center p-6 sm:p-8" aria-live="polite">
            {result ? (
              <ConfirmationCode
                code={result.confirmationCode}
                hasStatusError={connections.isError}
                expiresAt={result.confirmationExpiresAt}
                isCheckingStatus={connections.isFetching}
                onCopy={() => void copyConfirmationCode(result.confirmationCode)}
                ownerName={result.ownerName}
                personName={result.personName}
              />
            ) : token ? (
              <InvitationReview
                hasClaimError={hasClaimError}
                isPending={claim.isPending}
                onAccept={() => void accept()}
              />
            ) : (
              <InvalidInvitation />
            )}
          </section>
        </CardContent>
      </Card>
    </section>
  );
}

function ConnectionPrivacy({ personName }: { personName?: string }) {
  return (
    <section className="grid content-start gap-5 border-b bg-muted/20 p-6 sm:p-8 lg:border-r lg:border-b-0">
      <div>
        <p className="font-semibold">Sua privacidade continua protegida</p>
        <p className="mt-1 text-muted-foreground text-sm leading-relaxed">
          {personName
            ? `Na conta de quem convidou, esta conexão representa ${personName}.`
            : "A conexão tem um escopo limitado e pode ser encerrada a qualquer momento."}
        </p>
      </div>
      <div className="grid gap-4">
        <PrivacyItem icon={ReceiptText} title="Você mantém o controle">
          Cada gasto recebido passa pela sua revisão antes de ser contabilizado.
        </PrivacyItem>
        <PrivacyItem icon={Check} title="Recusas não afetam sua conta">
          Despesas recusadas não entram nos seus lançamentos.
        </PrivacyItem>
        <PrivacyItem icon={LockKeyhole} title="Seus dados não são expostos">
          Contas, cartões, saldos e histórico financeiro permanecem privados.
        </PrivacyItem>
      </div>
    </section>
  );
}

function PrivacyItem({
  children,
  icon: Icon,
  title,
}: {
  children: React.ReactNode;
  icon: typeof ReceiptText;
  title: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-background text-brand-strong shadow-xs ring-1 ring-border">
        <Icon aria-hidden="true" className="size-4" />
      </span>
      <div className="pt-0.5">
        <p className="font-medium text-sm">{title}</p>
        <p className="mt-0.5 text-muted-foreground text-xs leading-relaxed">{children}</p>
      </div>
    </div>
  );
}

function InvitationReview({
  hasClaimError,
  isPending,
  onAccept,
}: {
  hasClaimError: boolean;
  isPending: boolean;
  onAccept: () => void;
}) {
  return (
    <div className="grid gap-5">
      <div>
        <p className="font-semibold text-lg">Tudo certo para continuar?</p>
        <p className="mt-1.5 text-muted-foreground text-sm leading-relaxed">
          Ao aceitar, você receberá um código de 6 dígitos. Envie-o à pessoa que compartilhou este
          convite para que ela confirme a conexão.
        </p>
      </div>

      <div className="rounded-lg border border-info/20 bg-info/5 p-4">
        <p className="flex items-start gap-2 font-medium text-sm">
          <ShieldCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-info" />
          Aceitar o convite ainda não ativa a conexão
        </p>
        <p className="mt-1 pl-6 text-muted-foreground text-xs leading-relaxed">
          A ativação só acontece após a conferência do código pela outra pessoa.
        </p>
      </div>

      {hasClaimError ? (
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3" role="alert">
          <p className="font-medium text-destructive text-sm">Não foi possível aceitar o convite</p>
          <p className="mt-0.5 text-muted-foreground text-xs">
            O link pode estar expirado ou já ter sido utilizado. Peça um novo convite se o erro
            continuar.
          </p>
        </div>
      ) : null}

      <Button className="h-10 w-full" disabled={isPending} onClick={onAccept}>
        {isPending ? (
          <Loader2 aria-hidden="true" className="animate-spin" />
        ) : (
          <Link2 aria-hidden="true" />
        )}
        {isPending ? "Aceitando convite..." : "Aceitar e gerar código"}
      </Button>
      <p className="text-center text-muted-foreground text-xs">
        Continue apenas se você reconhece quem enviou este convite.
      </p>
    </div>
  );
}

function ConfirmationCode({
  code,
  expiresAt,
  hasStatusError,
  isCheckingStatus,
  onCopy,
  ownerName,
  personName,
}: {
  code: string;
  expiresAt: string;
  hasStatusError: boolean;
  isCheckingStatus: boolean;
  onCopy: () => void;
  ownerName: string;
  personName: string;
}) {
  return (
    <div className="grid gap-5">
      <div>
        <p className="font-semibold text-lg">Convite aceito com segurança</p>
        <p className="mt-1.5 text-muted-foreground text-sm leading-relaxed">
          Envie o código abaixo a {ownerName} pelo mesmo canal em que recebeu o convite. Na conta
          dessa pessoa, você será identificado como {personName}.
        </p>
      </div>

      <div className="rounded-xl border border-brand-strong/20 bg-brand/5 p-5 text-center">
        <p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
          Código de confirmação
        </p>
        <output
          aria-label={`Código de confirmação ${code.split("").join(" ")}`}
          className="mt-2 block font-mono font-bold text-3xl tracking-[0.3em] tabular-nums sm:text-4xl"
        >
          {code}
        </output>
        <p className="mt-2 flex items-center justify-center gap-1.5 text-muted-foreground text-xs">
          <Clock3 aria-hidden="true" className="size-3.5" />
          Válido até {formatPersonConnectionConfirmationExpiry(expiresAt)}
        </p>
      </div>

      <Button className="h-10 w-full" onClick={onCopy}>
        <Clipboard aria-hidden="true" /> Copiar código
      </Button>

      <div className="rounded-lg border border-warning/30 bg-warning/10 p-3">
        <p className="font-medium text-sm">Mantenha esta tela aberta</p>
        <p className="mt-0.5 text-muted-foreground text-xs leading-relaxed">
          Por segurança, o código é exibido somente agora. A conexão permanece inativa até a
          confirmação de {ownerName}.
        </p>
      </div>

      <div className="flex items-start gap-2 text-muted-foreground text-xs" role="status">
        {hasStatusError ? (
          <RefreshCw aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
        ) : (
          <Loader2
            aria-hidden="true"
            className={
              isCheckingStatus
                ? "mt-0.5 size-3.5 shrink-0 animate-spin"
                : "mt-0.5 size-3.5 shrink-0"
            }
          />
        )}
        <p>
          {hasStatusError
            ? "Não foi possível verificar a confirmação agora. Esta tela continuará tentando."
            : "Aguardando a confirmação. Quando ela acontecer, você irá para Gastos compartilhados automaticamente."}
        </p>
      </div>
    </div>
  );
}

function InvalidInvitation() {
  return (
    <div className="grid justify-items-center gap-4 text-center">
      <span className="grid size-12 place-items-center rounded-full bg-destructive/10 text-destructive">
        <ShieldX aria-hidden="true" className="size-6" />
      </span>
      <div>
        <p className="font-semibold text-lg">Link de convite incompleto</p>
        <p className="mt-1.5 max-w-sm text-muted-foreground text-sm leading-relaxed">
          Abra novamente o link completo que você recebeu ou peça um novo convite à pessoa que
          iniciou a conexão.
        </p>
      </div>
      <Button asChild variant="outline">
        <Link to="/dashboard">Voltar para a visão geral</Link>
      </Button>
    </div>
  );
}

function subscribeToLocationHash(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

function readLocationHash() {
  return window.location.hash.slice(1);
}

function readServerHash() {
  return "";
}
