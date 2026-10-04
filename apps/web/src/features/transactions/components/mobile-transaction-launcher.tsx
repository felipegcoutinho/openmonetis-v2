import type { TransactionInput } from "@openmonetis/validators/transactions";
import { useQuery } from "@tanstack/react-query";
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight } from "lucide-react";
import { useState } from "react";
import { MobileFormContent } from "@/components/forms/mobile-form-content";
import { MobileFormDialog as Dialog } from "@/components/forms/mobile-form-dialog";
import { Button } from "@/components/ui/button";
import { DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { accountsQueryOptions } from "@/features/accounts/accounts.queries";
import { cardsQueryOptions } from "@/features/cards/cards.queries";
import { categoriesQueryOptions } from "@/features/categories/categories.queries";
import { peopleQueryOptions } from "@/features/people/people.queries";
import { TransactionDialog } from "./transaction-dialog";

const choices = [
  { type: "expense", label: "Nova despesa", icon: ArrowUpRight },
  { type: "income", label: "Nova receita", icon: ArrowDownLeft },
  { type: "transfer", label: "Nova transferência", icon: ArrowLeftRight },
] as const;

export function MobileTransactionLauncher({ onClose }: { onClose: () => void }) {
  const [type, setType] = useState<TransactionInput["type"] | null>(null);
  const accounts = useQuery({ ...accountsQueryOptions(), enabled: type !== null });
  const cards = useQuery({ ...cardsQueryOptions(), enabled: type !== null });
  const categories = useQuery({ ...categoriesQueryOptions(), enabled: type !== null });
  const people = useQuery({ ...peopleQueryOptions(), enabled: type !== null });
  const queries = [accounts, cards, categories, people];
  const failed = queries.some((query) => query.isError);
  const ready = queries.every((query) => query.data !== undefined);

  if (type && ready) {
    return (
      <TransactionDialog
        open
        defaultType={type}
        accounts={accounts.data ?? []}
        cards={cards.data ?? []}
        categories={categories.data ?? []}
        people={people.data ?? []}
        transaction={null}
        onOpenChange={(next) => {
          if (!next) onClose();
        }}
      />
    );
  }

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <MobileFormContent mobileLayout="sheet">
        <DialogHeader>
          <DialogTitle>Novo lançamento</DialogTitle>
          <DialogDescription>Escolha o que deseja registrar.</DialogDescription>
        </DialogHeader>
        {!type ? (
          <div className="grid gap-2">
            {choices.map((choice) => (
              <Button
                className="min-h-12 justify-start gap-3"
                key={choice.type}
                onClick={() => setType(choice.type)}
                type="button"
                variant="outline"
              >
                <choice.icon aria-hidden="true" className="size-5" />
                {choice.label}
              </Button>
            ))}
          </div>
        ) : failed ? (
          <div className="grid gap-3">
            <p role="alert" className="text-sm text-muted-foreground">
              Não foi possível carregar os dados do lançamento.
            </p>
            <Button
              type="button"
              variant="outline"
              disabled={queries.some((query) => query.isFetching)}
              onClick={() => {
                for (const query of queries) void query.refetch();
              }}
            >
              Tentar novamente
            </Button>
          </div>
        ) : (
          <p role="status" className="py-6 text-sm text-muted-foreground">
            Carregando contas, cartões e pessoas…
          </p>
        )}
      </MobileFormContent>
    </Dialog>
  );
}
