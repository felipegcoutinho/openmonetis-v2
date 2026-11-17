# Orçamentos

**Finanças → Orçamentos** define quanto se pretende gastar em cada categoria de despesa no mês e
compara esse limite com o que já foi lançado e com as recorrências que ainda vão cair.

## Limite do mês e orçamento recorrente

Um orçamento pode valer só para um mês ou repetir todo mês. **Repetir todo mês** vem ligado ao
criar: o limite passa a valer do mês escolhido em diante, sem prazo final, e não é copiado mês a
mês. Ele é calculado para o mês consultado, como as [recorrências de lançamentos](recurring-transactions.md).

Cada categoria tem no máximo um limite por mês. Quando um mês coberto por um orçamento recorrente
tem limite próprio, esse limite é o **ajuste daquele mês** e vale no lugar do recorrente.

| Ação | Efeito |
| --- | --- |
| Editar, **De <mês> em diante** | Cria uma nova versão a partir do mês. Os meses anteriores mantêm o limite, e os ajustes do mês em diante são descartados. |
| Editar, **Só em <mês>** | Cria ou atualiza o ajuste do mês. Os outros meses não mudam. |
| **Voltar ao valor recorrente** | Remove o ajuste do mês. |
| **Encerrar a partir de <mês>** | O limite deixa de valer no mês e nos seguintes, incluindo os ajustes. Os meses anteriores continuam com o limite; se o orçamento começava no mês, ele é removido. |
| **Repetir todo mês** em um limite avulso | Transforma o limite em recorrente a partir do mês dele. |

Quando o mês anterior tem limites avulsos de categorias ainda sem limite no mês atual, a lista mostra
um aviso, por exemplo "Outubro de 2026 tem 2 limites que não se repetem". **Repetir esses limites**
abre a escolha dos limites que passam a valer no mês; com **Repetir todo mês** ligado (padrão), cada
um vira recorrente a partir do mês atual, e com a opção desligada vale só para ele. Os recorrentes
não aparecem ali, porque já chegam ao mês seguinte por conta própria. Sem limites para trazer, o
aviso não aparece.

Os orçamentos existentes antes da versão com recorrência continuam valendo só para o mês deles. Para
repetir um deles, use **Repetir todo mês** no menu do card ou o aviso do mês seguinte.

## API

| Método e rota | Responsabilidade |
| --- | --- |
| `GET /budgets?period=YYYY-MM` | Limites do mês, avulsos e recorrentes, com o uso de cada um. |
| `POST /budgets` | Cria um limite; com `repeatMonthly: true`, cria o orçamento recorrente. |
| `POST /budgets/{id}/repeat` | Transforma um limite avulso em recorrente a partir do mês dele. |
| `PUT /budgets/recurring-rules/{ruleId}` | Muda o valor com `scope` (`single` ou `future`) e `period`. |
| `POST /budgets/recurring-rules/{ruleId}/stop` | Encerra o recorrente a partir de `period`. |
| `POST /budgets/copy-previous` | Copia limites do mês anterior; aceita `repeatMonthly`. |

Cada item de `GET /budgets` traz `budgetId` (o limite do próprio mês, quando existe) e `recurrence`
(`ruleId`, `startPeriod` e `endPeriod`, quando é recorrente). Um mês coberto só pelo recorrente usa
o `id` `ruleId:período`; `PATCH` e `DELETE /budgets/{id}` continuam valendo para o limite do mês.
Uma versão que se sobreporia a outra da mesma categoria é recusada com `budget_rule_overlap`, e um
mês fora do período do recorrente, com `budget_rule_period_outside`. O OpenAPI descreve o contrato
completo.

## Verificação

Execute `pnpm test`, `pnpm test:ownership:integration` e `pnpm test:migrations:integration`. Na
interface, crie um orçamento recorrente, ajuste um mês, edite "de um mês em diante", copie um limite
avulso com repetição e encerre o recorrente, conferindo que os meses anteriores não mudam.
