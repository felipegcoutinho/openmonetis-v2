import {
  type AdjustAccountBalanceInput,
  AdjustAccountBalanceInputSchema,
} from "@openmonetis/validators/accounts";
import { useQuery } from "@tanstack/react-query";
import { MoneyValue } from "@/components/money-value";
import { accountBalanceAdjustmentPreviewQueryOptions } from "../accounts.queries";

export function AccountBalanceAdjustmentPreview({
  accountId,
  input,
}: {
  accountId: string;
  input: AdjustAccountBalanceInput;
}) {
  const valid = AdjustAccountBalanceInputSchema.safeParse(input).success;
  const query = useQuery({
    ...accountBalanceAdjustmentPreviewQueryOptions(accountId, input),
    enabled: valid,
  });
  if (!valid) return null;
  if (query.isPending)
    return (
      <p className="text-muted-foreground text-xs" role="status">
        Calculando a prévia…
      </p>
    );
  if (query.isError)
    return (
      <p className="text-destructive text-xs" role="alert">
        Não foi possível calcular a prévia. Confira a data e tente novamente.
      </p>
    );
  return (
    <section
      className="grid gap-1 rounded-lg border bg-muted/30 p-3 text-sm"
      aria-label="Prévia do ajuste"
    >
      <span>
        Saldo na data: <MoneyValue amount={query.data.currentBalance} />
      </span>
      <span>
        Novo saldo: <MoneyValue amount={query.data.desiredBalance} />
      </span>
      <span>
        Lançamento de ajuste: <MoneyValue amount={query.data.adjustmentAmount} showPositiveSign />
      </span>
      <p className="text-muted-foreground text-xs">
        O saldo será recalculado ao salvar. Esta prévia não altera seus dados.
      </p>
    </section>
  );
}
