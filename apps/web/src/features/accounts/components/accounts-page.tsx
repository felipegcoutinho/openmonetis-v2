import type {
  AccountOutput,
  CreateAccountInput,
  ReplaceAccountInput,
} from "@openmonetis/validators/accounts";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Landmark, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { Navbar } from "@/components/navigation/navbar";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useArchiveAccountMutation,
  useCreateAccountMutation,
  useDeleteAccountMutation,
  useReplaceAccountMutation,
} from "../accounts.mutations";
import { accountsQueryOptions } from "../accounts.queries";
import { AccountDialog } from "./account-dialog";
import { AccountsGrid } from "./accounts-grid";

export function AccountsPage() {
  const accountsQuery = useQuery(accountsQueryOptions());
  const createMutation = useCreateAccountMutation();
  const replaceMutation = useReplaceAccountMutation();
  const archiveMutation = useArchiveAccountMutation();
  const deleteMutation = useDeleteAccountMutation();
  const [createdAccountId, setCreatedAccountId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<AccountOutput | null>(null);

  function closeDialog(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) setEditingAccount(null);
  }

  function openCreate() {
    setEditingAccount(null);
    setOpen(true);
  }

  async function saveAccount(input: CreateAccountInput | ReplaceAccountInput) {
    if (editingAccount) {
      await replaceMutation.mutateAsync({
        id: editingAccount.id,
        input: input as ReplaceAccountInput,
      });
    } else {
      const created = await createMutation.mutateAsync(input as CreateAccountInput);
      setCreatedAccountId(created.id);
    }
    closeDialog(false);
  }

  async function archiveAccount(account: AccountOutput) {
    try {
      await archiveMutation.mutateAsync(account.id);
      toast.success("Conta movida para inativas", {
        description: `${account.name} pode ser reativada pela edição.`,
      });
    } catch {
      toast.error("Não foi possível inativar a conta.", {
        description: "Tente novamente em instantes.",
      });
    }
  }

  async function deleteAccount(account: AccountOutput) {
    try {
      await deleteMutation.mutateAsync(account.id);
      toast.success("Conta excluída permanentemente", {
        description: `${account.name} e seus dados financeiros vinculados foram removidos.`,
      });
    } catch {
      toast.error("Não foi possível excluir a conta.", {
        description: "Confirme que ela continua inativa e tente novamente.",
      });
    }
  }

  const accounts = accountsQuery.data ?? [];
  const activeAccounts = accounts.filter((account) => !account.isArchived);
  const inactiveAccounts = accounts.filter((account) => account.isArchived);

  return (
    <ProtectedRoute>
      <main className="min-h-svh bg-background">
        <Navbar />
        <section className="app-page project-container">
          <PageHeader
            actions={
              <Button onClick={openCreate} type="button">
                <Plus aria-hidden="true" className="size-4" />
                Nova conta
              </Button>
            }
            breadcrumbs={[{ label: "Visão geral", href: "/dashboard" }, { label: "Finanças" }]}
            description="Organize suas contas e acompanhe como cada uma participa do saldo consolidado."
            eyebrow="Finanças"
            icon={<Landmark aria-hidden="true" className="size-5" />}
            title="Contas"
          />

          {createdAccountId ? (
            <Card className="gap-3 p-4">
              <h2 className="font-semibold">Conta criada. Agora informe o saldo.</h2>
              <p className="text-muted-foreground text-sm">
                Abra o extrato e use “Ajustar saldo” para registrar quanto você já tem nesta conta.
              </p>
              <div className="flex gap-2">
                <Button asChild>
                  <Link to="/accounts/$accountId" params={{ accountId: createdAccountId }}>
                    Informar saldo no extrato
                  </Link>
                </Button>
                <Button variant="ghost" onClick={() => setCreatedAccountId(null)}>
                  Fazer depois
                </Button>
              </div>
            </Card>
          ) : null}
          {accountsQuery.isLoading ? (
            <p className="text-muted-foreground text-sm">Carregando contas...</p>
          ) : null}
          {accountsQuery.isError ? (
            <p className="text-destructive text-sm" role="alert">
              Não foi possível carregar as contas.
            </p>
          ) : null}

          {!accountsQuery.isLoading && !accountsQuery.isError ? (
            <Tabs className="gap-0" defaultValue="active">
              <TabsList variant="line">
                <TabsTrigger value="active">Ativas ({activeAccounts.length})</TabsTrigger>
                <TabsTrigger value="inactive">Inativas ({inactiveAccounts.length})</TabsTrigger>
              </TabsList>
              <TabsContent className="pt-5" value="active">
                <AccountsList
                  accounts={activeAccounts}
                  emptyDescription="Cadastre sua primeira conta para começar a organizar seus lançamentos."
                  emptyTitle="Nenhuma conta ativa cadastrada"
                  onEdit={(account) => {
                    setEditingAccount(account);
                    setOpen(true);
                  }}
                  onArchive={archiveAccount}
                  pendingAccountId={archiveMutation.isPending ? archiveMutation.variables : null}
                />
              </TabsContent>
              <TabsContent className="pt-5" value="inactive">
                <AccountsList
                  accounts={inactiveAccounts}
                  emptyDescription="Contas inativas podem ser reativadas ou excluídas permanentemente."
                  emptyTitle="Nenhuma conta inativa cadastrada"
                  onDelete={deleteAccount}
                  onEdit={(account) => {
                    setEditingAccount(account);
                    setOpen(true);
                  }}
                  pendingAccountId={deleteMutation.isPending ? deleteMutation.variables : null}
                />
              </TabsContent>
            </Tabs>
          ) : null}
        </section>
      </main>

      <AccountDialog
        account={editingAccount}
        onOpenChange={closeDialog}
        onSubmit={saveAccount}
        open={open}
      />
    </ProtectedRoute>
  );
}

function AccountsList({
  accounts,
  emptyDescription,
  emptyTitle,
  onEdit,
  onArchive,
  onDelete,
  pendingAccountId,
}: {
  accounts: AccountOutput[];
  emptyDescription: string;
  emptyTitle: string;
  onEdit: (account: AccountOutput) => void;
  onArchive?: (account: AccountOutput) => Promise<void>;
  onDelete?: (account: AccountOutput) => Promise<void>;
  pendingAccountId?: string | null;
}) {
  if (accounts.length === 0) {
    return (
      <Card className="grid min-h-52 place-items-center p-6 text-center">
        <div>
          <p className="font-medium">{emptyTitle}</p>
          <p className="mt-1 text-muted-foreground text-sm">{emptyDescription}</p>
        </div>
      </Card>
    );
  }

  return (
    <div>
      <AccountsGrid
        accounts={accounts}
        onArchive={onArchive}
        onDelete={onDelete}
        onEdit={onEdit}
        pendingAccountId={pendingAccountId}
      />
    </div>
  );
}
