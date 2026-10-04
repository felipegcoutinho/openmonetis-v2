import type { InboxItemStatus } from "@openmonetis/domain/inbox";

import { CircleCheck } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";

export function InboxEmpty({ filtered, status }: { filtered: boolean; status: InboxItemStatus }) {
  if (filtered) {
    return (
      <Card>
        <CardContent className="grid place-items-center py-16 text-center">
          <p className="font-medium">Nenhuma captura com estes filtros</p>
          <p className="mt-1 text-muted-foreground text-sm">
            Remova os filtros de aplicativo ou data para ampliar a busca.
          </p>
        </CardContent>
      </Card>
    );
  }
  const copy = {
    pending: [
      "Nada para revisar",
      "Conecte o Companion em Ajustes para receber capturas. Se já está conectado, suas próximas capturas aparecerão aqui.",
    ],
    processed: [
      "Nenhuma captura confirmada",
      "Itens confirmados ficam disponíveis neste histórico.",
    ],
    discarded: ["Nenhum item descartado", "Capturas ignoradas podem ser restauradas por aqui."],
  }[status];
  return (
    <Card>
      <CardContent className="grid place-items-center py-16 text-center">
        <span className="grid size-12 place-items-center rounded-full bg-success/10 text-success">
          <CircleCheck aria-hidden="true" className="size-5" />
        </span>
        <p className="mt-3 font-medium">{copy[0]}</p>
        <p className="mt-1 text-muted-foreground text-sm">{copy[1]}</p>
      </CardContent>
    </Card>
  );
}
