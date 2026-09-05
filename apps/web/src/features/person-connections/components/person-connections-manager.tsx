import type { PersonConnectionOutput } from "@openmonetis/validators/person-connections";
import { useQuery } from "@tanstack/react-query";
import { Link2, Loader2, RefreshCw, Unlink } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useRevokePersonConnectionMutation } from "../person-connections.mutations";
import { personConnectionsQueryOptions } from "../person-connections.queries";

export function PersonConnectionsManager() {
  const connections = useQuery(personConnectionsQueryOptions());
  const revokeConnection = useRevokePersonConnectionMutation();
  const [selectedConnection, setSelectedConnection] = useState<PersonConnectionOutput | null>(null);
  const activeConnections = connections.data?.filter(
    (connection) => connection.status === "active",
  );

  async function disconnect() {
    if (!selectedConnection) return;

    try {
      await revokeConnection.mutateAsync(selectedConnection.id);
      toast.success(`Conexão com ${selectedConnection.counterpartName} encerrada`);
      setSelectedConnection(null);
    } catch {
      toast.error("Não foi possível encerrar a conexão.");
    }
  }

  return (
    <>
      <Card className="gap-0 py-0">
        <Accordion>
          <AccordionItem className="border-0" value="connected-accounts">
            <AccordionTrigger className="items-center px-6 py-4 hover:no-underline">
              <div className="flex min-w-0 flex-1 items-center justify-between gap-4 pr-2">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand/10 text-brand-strong">
                    <Link2 aria-hidden="true" className="size-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="font-heading font-medium text-base">Contas conectadas</p>
                    <p className="mt-0.5 truncate font-normal text-muted-foreground text-xs">
                      Consulte e encerre os vínculos usados para compartilhar despesas.
                    </p>
                  </div>
                </div>
                {!connections.isLoading && !connections.isError ? (
                  <Badge className="hidden sm:inline-flex" variant="secondary">
                    {activeConnections?.length ?? 0}{" "}
                    {(activeConnections?.length ?? 0) === 1 ? "ativa" : "ativas"}
                  </Badge>
                ) : null}
              </div>
            </AccordionTrigger>
            <AccordionContent className="border-t pt-0 pb-0 [&_p:not(:last-child)]:mb-0">
              {connections.isLoading ? <ConnectionsLoading /> : null}
              {connections.isError ? (
                <ConnectionsError onRetry={() => void connections.refetch()} />
              ) : null}
              {!connections.isLoading && !connections.isError && !activeConnections?.length ? (
                <div className="px-6 py-5">
                  <p className="font-medium text-sm">Nenhuma conexão ativa</p>
                  <p className="mt-1 text-muted-foreground text-xs">
                    Quando uma conta for conectada, ela aparecerá aqui.
                  </p>
                </div>
              ) : null}
              {activeConnections?.length ? (
                <ul className="divide-y">
                  {activeConnections.map((connection) => (
                    <li
                      className="flex flex-col gap-4 px-6 py-4 sm:flex-row sm:items-center"
                      key={connection.id}
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <Avatar>
                          <AvatarImage
                            alt={connection.counterpartName}
                            src={connection.counterpartAvatarUrl ?? undefined}
                          />
                          <AvatarFallback>{getInitials(connection.counterpartName)}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="truncate font-medium">{connection.counterpartName}</p>
                          <p className="mt-0.5 text-muted-foreground text-xs">
                            {connection.perspective === "recipient"
                              ? "Você recebe os gastos atribuídos por esta conta."
                              : "Esta conta revisa os gastos que você atribuir."}
                          </p>
                        </div>
                      </div>
                      <Button
                        className="w-full sm:w-auto"
                        onClick={() => setSelectedConnection(connection)}
                        size="sm"
                        variant="outline"
                      >
                        <Unlink aria-hidden="true" /> Desconectar
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </Card>

      <AlertDialog
        onOpenChange={(open) => {
          if (!open && !revokeConnection.isPending) setSelectedConnection(null);
        }}
        open={Boolean(selectedConnection)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-destructive/10 text-destructive">
              <Unlink aria-hidden="true" />
            </AlertDialogMedia>
            <AlertDialogTitle>
              Desconectar de {selectedConnection?.counterpartName}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Novos gastos deixarão de ser compartilhados e as pendências ainda não importadas serão
              removidas. Lançamentos já importados continuarão disponíveis, e uma nova conexão
              poderá ser feita depois.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={revokeConnection.isPending}>Voltar</AlertDialogCancel>
            <AlertDialogAction
              disabled={revokeConnection.isPending}
              onClick={(event) => {
                event.preventDefault();
                void disconnect();
              }}
              variant="destructive"
            >
              {revokeConnection.isPending ? (
                <Loader2 aria-hidden="true" className="animate-spin" />
              ) : null}
              Desconectar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function ConnectionsLoading() {
  return (
    <div
      className="flex items-center gap-3 px-6 py-4"
      aria-label="Carregando conexões"
      role="status"
    >
      <Skeleton className="size-9 rounded-full" />
      <div className="min-w-0 flex-1">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="mt-2 h-3 w-64 max-w-full" />
      </div>
    </div>
  );
}

function ConnectionsError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-start gap-3 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="font-medium text-sm">Não foi possível carregar as conexões</p>
        <p className="mt-1 text-muted-foreground text-xs">Tente novamente em alguns instantes.</p>
      </div>
      <Button onClick={onRetry} size="sm" variant="outline">
        <RefreshCw aria-hidden="true" /> Tentar novamente
      </Button>
    </div>
  );
}

function getInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}
