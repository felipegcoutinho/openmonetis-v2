import type { CardOutput } from "@openmonetis/validators/cards";
import { CardCard } from "./card-card";

type CardsGridProps = {
  cards: CardOutput[];
  onArchive?: (card: CardOutput) => Promise<void>;
  onDelete?: (card: CardOutput) => Promise<void>;
  onEdit: (card: CardOutput) => void;
  pendingCardId?: string | null;
};

export function CardsGrid({ cards, onArchive, onDelete, onEdit, pendingCardId }: CardsGridProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {cards.map((card) => (
        <CardCard
          card={card}
          key={card.id}
          onArchive={onArchive}
          onDelete={onDelete}
          onEdit={onEdit}
          pending={pendingCardId === card.id}
        />
      ))}
    </div>
  );
}
