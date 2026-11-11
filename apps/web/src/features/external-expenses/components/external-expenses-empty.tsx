import { Check } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";

export function ExternalExpensesEmpty({
  searched,
  ignored,
}: {
  searched: boolean;
  ignored: boolean;
}) {
  return (
    <Card>
      <CardContent className="grid place-items-center py-14 text-center">
        <span className="grid size-10 place-items-center text-muted-foreground/70">
          <Check aria-hidden="true" className="size-6 stroke-[1.5]" />
        </span>
        <p className="mt-3 font-medium">
          {searched
            ? "Nenhum lançamento encontrado"
            : ignored
              ? "Nenhum lançamento ignorado"
              : "Nenhum lançamento pendente"}
        </p>
        <p className="mt-1 max-w-md text-muted-foreground text-sm">
          {searched
            ? "Tente buscar por outro estabelecimento, pessoa ou conta/cartão."
            : ignored
              ? "Os lançamentos ignorados neste mês aparecerão aqui e poderão ser restaurados."
              : "Novos lançamentos externos aparecerão aqui para importação."}
        </p>
      </CardContent>
    </Card>
  );
}
