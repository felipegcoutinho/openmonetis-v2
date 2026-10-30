import {
  commitmentAttentionThreshold,
  commitmentCriticalThreshold,
} from "@openmonetis/domain/commitments";
import { Info } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/** Explains what the commitment index counts; opens on hover and on tap. */
export function CommitmentsWidgetHelp() {
  return (
    <Popover>
      <PopoverTrigger
        aria-label="Como o comprometimento é calculado"
        className="relative grid size-7 place-items-center rounded-full text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
        delay={150}
        openOnHover
      >
        <Info aria-hidden="true" className="size-4" />
      </PopoverTrigger>
      <PopoverContent align="end" className="grid w-80 gap-3 text-sm">
        <p className="font-medium">Como calculamos</p>
        <p className="text-muted-foreground">
          O índice é a parte da receita do mês que já está comprometida com despesas.
        </p>
        <dl className="grid gap-2">
          <div>
            <dt className="font-medium">Comprometido</dt>
            <dd className="text-muted-foreground">
              Lançamentos do mês, pagos ou em aberto, parcelas, recorrências previstas e compras no
              cartão pela fatura do mês. Estornos reduzem o valor.
            </dd>
          </div>
          <div>
            <dt className="font-medium">Receita</dt>
            <dd className="text-muted-foreground">Receitas lançadas e recorrências previstas.</dd>
          </div>
          <div>
            <dt className="font-medium">Não entram</dt>
            <dd className="text-muted-foreground">
              Transferências, pagamentos de fatura, valores de outras pessoas e contas marcadas para
              não somar no saldo.
            </dd>
          </div>
        </dl>
        <p className="border-t pt-3 text-muted-foreground text-xs">
          Saudável abaixo de {commitmentAttentionThreshold}%, atenção até{" "}
          {commitmentCriticalThreshold}% e crítico a partir disso.
        </p>
      </PopoverContent>
    </Popover>
  );
}
