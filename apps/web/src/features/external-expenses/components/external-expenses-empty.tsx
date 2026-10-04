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
    <Card className="border-dashed shadow-none">
      <CardContent className="grid place-items-center py-14 text-center">
        <span className="grid size-11 place-items-center rounded-full bg-muted text-muted-foreground">
          <Check aria-hidden="true" className="size-5" />
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
