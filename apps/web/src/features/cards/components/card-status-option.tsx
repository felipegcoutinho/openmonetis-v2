import type { CardOutput } from "@openmonetis/validators/cards";

export function CardStatusOption({ status }: { status: CardOutput["status"] }) {
  return (
    <span className="flex items-center gap-2">
      <span
        aria-hidden="true"
        className={`size-2 rounded-full ${status === "active" ? "bg-emerald-500" : "bg-muted-foreground"}`}
      />
      <span>{status === "active" ? "Ativo" : "Inativo"}</span>
    </span>
  );
}
