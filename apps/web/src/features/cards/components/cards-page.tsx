import type { CardOutput, CreateCardInput, ReplaceCardInput } from "@openmonetis/validators/cards";
import { useQuery } from "@tanstack/react-query";
import { CreditCard, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { Navbar } from "@/components/navigation/navbar";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { accountsQueryOptions } from "@/features/accounts/accounts.queries";
import {
  useArchiveCardMutation,
  useCreateCardMutation,
  useDeleteCardMutation,
  useReplaceCardMutation,
} from "../cards.mutations";
import { cardsQueryOptions } from "../cards.queries";
import { CardDialog } from "./card-dialog";
import { CardsGrid } from "./cards-grid";

export function CardsPage() {
  const cardsQuery = useQuery(cardsQueryOptions());
  const accountsQuery = useQuery(accountsQueryOptions());
  const createMutation = useCreateCardMutation();
  const replaceMutation = useReplaceCardMutation();
  const archiveMutation = useArchiveCardMutation();
  const deleteMutation = useDeleteCardMutation();
  const [open, setOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<CardOutput | null>(null);
  const allAccounts = accountsQuery.data ?? [];
  const activeAccounts = allAccounts.filter((account) => !account.isArchived);
  const cards = cardsQuery.data ?? [];
  const activeCards = cards.filter((card) => card.status === "active");
  const inactiveCards = cards.filter((card) => card.status === "inactive");

  function changeDialog(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) setEditingCard(null);
  }
  async function saveCard(input: CreateCardInput | ReplaceCardInput) {
    if (editingCard)
      await replaceMutation.mutateAsync({ id: editingCard.id, input: input as ReplaceCardInput });
    else await createMutation.mutateAsync(input as CreateCardInput);
    changeDialog(false);
  }
  async function archiveCard(card: CardOutput) {
    try {
      await archiveMutation.mutateAsync(card.id);
      toast.success("Cartão movido para inativos", {
        description: `${card.name} pode ser reativado pela edição.`,
      });
    } catch {
      toast.error("Não foi possível inativar o cartão.", {
        description: "Tente novamente em instantes.",
      });
    }
  }
  async function deleteCard(card: CardOutput) {
    try {
      await deleteMutation.mutateAsync(card.id);
      toast.success("Cartão excluído permanentemente", {
        description: `${card.name} e seus dados financeiros vinculados foram removidos.`,
      });
    } catch {
      toast.error("Não foi possível excluir o cartão.", {
        description: "Confirme que ele continua inativo e tente novamente.",
      });
    }
  }
  const loading = cardsQuery.isLoading || accountsQuery.isLoading;
  const failed = cardsQuery.isError || accountsQuery.isError;

  return (
    <ProtectedRoute>
      <main className="min-h-svh bg-background">
        <Navbar />
        <section className="app-page project-container">
          <PageHeader
            actions={
              <Button
                disabled={activeAccounts.length === 0}
                onClick={() => {
                  setEditingCard(null);
                  setOpen(true);
                }}
              >
                <Plus className="size-4" />
                Novo cartão
              </Button>
            }
            breadcrumbs={[{ label: "Visão geral", href: "/dashboard" }, { label: "Finanças" }]}
            description="Acompanhe limites, datas de fechamento e vencimentos dos seus cartões."
            eyebrow="Finanças"
            icon={<CreditCard aria-hidden="true" className="size-5" />}
            title="Cartões"
          />
          {loading ? <p className="text-muted-foreground text-sm">Carregando cartões...</p> : null}
          {failed ? (
            <p className="text-destructive text-sm" role="alert">
              Não foi possível carregar.
            </p>
          ) : null}
          {!loading && !failed ? (
            <Tabs className="gap-0" defaultValue="active">
              <TabsList variant="line">
                <TabsTrigger value="active">Ativos ({activeCards.length})</TabsTrigger>
                <TabsTrigger value="inactive">Inativos ({inactiveCards.length})</TabsTrigger>
              </TabsList>
              <TabsContent className="pt-5" value="active">
                <CardsList
                  cards={activeCards}
                  empty="Nenhum cartão ativo cadastrado"
                  onArchive={archiveCard}
                  onEdit={(card) => {
                    setEditingCard(card);
                    setOpen(true);
                  }}
                  pendingCardId={archiveMutation.isPending ? archiveMutation.variables : null}
                />
              </TabsContent>
              <TabsContent className="pt-5" value="inactive">
                <CardsList
                  cards={inactiveCards}
                  empty="Nenhum cartão inativo cadastrado"
                  onDelete={deleteCard}
                  onEdit={(card) => {
                    setEditingCard(card);
                    setOpen(true);
                  }}
                  pendingCardId={deleteMutation.isPending ? deleteMutation.variables : null}
                />
              </TabsContent>
            </Tabs>
          ) : null}
        </section>
      </main>
      <CardDialog
        accounts={activeAccounts}
        card={editingCard}
        onOpenChange={changeDialog}
        onSubmit={saveCard}
        open={open}
      />
    </ProtectedRoute>
  );
}

function CardsList({
  cards,
  empty,
  onArchive,
  onDelete,
  onEdit,
  pendingCardId,
}: {
  cards: CardOutput[];
  empty: string;
  onArchive?: (card: CardOutput) => Promise<void>;
  onDelete?: (card: CardOutput) => Promise<void>;
  onEdit: (card: CardOutput) => void;
  pendingCardId?: string | null;
}) {
  if (!cards.length)
    return (
      <Card className="grid min-h-52 place-items-center p-6 text-center">
        <div>
          <p className="font-medium">{empty}</p>
          <p className="mt-1 text-muted-foreground text-sm">
            Cadastre ou reative um cartão para continuar.
          </p>
        </div>
      </Card>
    );
  return (
    <div>
      <CardsGrid
        cards={cards}
        onArchive={onArchive}
        onDelete={onDelete}
        onEdit={onEdit}
        pendingCardId={pendingCardId}
      />
    </div>
  );
}
