import type { AccountOutput } from "@openmonetis/validators/accounts";
import type { CardOutput, CreateCardInput, ReplaceCardInput } from "@openmonetis/validators/cards";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CardForm } from "./card-form";

type CardDialogProps = {
  accounts: AccountOutput[];
  card: CardOutput | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: CreateCardInput | ReplaceCardInput) => Promise<void>;
};

export function CardDialog({ accounts, card, open, onOpenChange, onSubmit }: CardDialogProps) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{card ? "Atualizar cartão" : "Novo cartão"}</DialogTitle>
          <DialogDescription>
            {card
              ? "Atualize as informações do cartão."
              : "Cadastre um cartão para organizar suas compras."}
          </DialogDescription>
        </DialogHeader>
        <CardForm
          key={card?.id ?? "new-card"}
          accounts={accounts}
          card={card}
          onCancel={() => onOpenChange(false)}
          onSubmit={onSubmit}
        />
      </DialogContent>
    </Dialog>
  );
}
