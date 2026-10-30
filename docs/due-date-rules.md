# Regras de vencimento

Contas a pagar (boleto, Pix, débito, dinheiro, transferência bancária ou benefícios) com vencimento e faturas de cartão usam automaticamente o próximo dia útil quando o vencimento cai em um final de semana ou feriado nacional, mesmo sem configuração. Em **Ajustes → Regras de vencimento**, personalize esse comportamento e o calendário compartilhado. Cada regra pode abranger todos os itens ou somente contas a pagar, séries recorrentes ou cartões selecionados. A seleção de um cartão acompanha suas próximas faturas.

As regras escolhem os gatilhos (final de semana e/ou feriado) e a direção (dia útil anterior ou próximo), ou podem manter a data original. Itens sem personalização continuam usando o ajuste automático padrão. Remover uma regra restaura esse padrão. Quando um gatilho ocorre, o resultado sempre é um dia útil: segunda a sexta, excluindo as datas do calendário. Por padrão, o calendário inclui os feriados nacionais fixos. Desmarcar “Considerar feriados nacionais” (`calendar.includeNationalHolidays: false` na API) retira essas datas do cálculo; finais de semana e feriados adicionais continuam sendo considerados conforme as regras. Datas locais, móveis e outros dias sem expediente podem ser adicionados com seu ano. Feriados estaduais e municipais que caem sempre no mesmo dia podem ser marcados para repetir todo ano (`calendar.recurringHolidays`, no formato `MM-DD`); versões salvas antes desse campo são lidas como se ele estivesse vazio. A tela permite consultar a lista nacional por nome e data, navegar entre anos e buscar cartões ou contas a pagar na seleção de alvos. As regras ficam recolhidas com um resumo, e regras que abrangem os mesmos itens ou estão incompletas são marcadas antes da prévia.

A interface usa vigência automática: ao salvar, a configuração vale para vencimentos originais de hoje em diante, pelo dia atual no Brasil. O formulário não exige escolher uma data. Clientes da API também podem informar uma vigência futura em `effectiveFrom`; datas anteriores a hoje são rejeitadas.

Use “Revisar alterações” para conferir a prévia dos vencimentos pendentes da data de vigência até o último dia do segundo mês seguinte. Por exemplo, uma vigência em 12 de outubro abrange até 31 de dezembro. Depois, “Salvar regras” aplica a configuração. “Descartar alterações” recupera a configuração salva. A prévia apresenta a data atual, a nova data, o vencimento original e a regra aplicada. Uma prévia vazia também pode ser salva: a configuração valerá para novos cadastros. Alterações no formulário exigem uma nova prévia.

## Datas e histórico

- O vencimento original permanece armazenado; a API resolve o vencimento ajustado a partir dele, sem ajustes sucessivos sobre uma data já ajustada.
- A competência e a referência da recorrência permanecem nominais. Contas a pagar, seu filtro na lista e os avisos acompanham o mês do vencimento ajustado, inclusive quando atravessa um mês ou ano.
- Ajustar o pagamento de uma fatura não desloca seu fechamento, a distribuição das compras ou os valores do ciclo. O cálculo preexistente do fechamento conserva sua referência própria.
- Regras possuem revisões imutáveis e vigência pelo vencimento original. Não é permitido retroagir a vigência nem sobrepor alvos. Uma nova revisão imediata substitui configurações futuras anteriores a partir de hoje. Uma atualização concorrente exige recarregar a configuração.
- Confirmar a baixa de uma conta a pagar ou ocorrência guarda um snapshot do vencimento ajustado e dos motivos, incluindo os feriados identificados. Alterações posteriores nas regras preservam essa data. Desfazer a baixa libera o vencimento para as regras aplicáveis.
- Pagamentos de fatura preservam suas datas, inclusive pagamentos parciais. Datas personalizadas diretamente na fatura prevalecem sobre as regras; faturas com pagamentos não permitem editar suas datas. Faturas antigas sem pagamentos continuam seguindo o comportamento automático.
- Vencimentos ajustados têm destaque discreto nas tabelas, detalhes, widgets de contas a pagar e faturas, e página da fatura. Hover mostra apenas a mudança de data e a direção do ajuste. Clique ou toque mostra o motivo resumido (final de semana e nomes dos feriados, sem listar cada dia) e abre as ações “Usar vencimento original” e “Voltar ao ajuste automático”. A exceção vale somente para o lançamento, a ocorrência selecionada ou o mês da fatura; pagamentos confirmados, inclusive parciais, não permitem a mudança.
- Contas a pagar também permitem marcar “Manter o vencimento informado, sem aplicar regras”. Em uma recorrência, a exceção segue o escopo da edição selecionado.
- Receitas, despesas sem vencimento, movimentos internos e compras individuais no cartão não recebem regras de contas a pagar. Uma compra no cartão integra a fatura, cujo vencimento é resolvido separadamente.

## Contrato e arquitetura

| Método e rota | Comportamento |
| --- | --- |
| `GET /due-date-rules` | Retorna a última configuração salva, inclusive se sua vigência for futura. |
| `GET /due-date-rules/options` | Lista somente alvos do usuário. |
| `GET /due-date-rules/holidays?year=2026` | Fornece o catálogo anual usado no cálculo. |
| `POST /due-date-rules/preview` | Simula um rascunho na janela iniciada em `effectiveFrom`. |
| `PUT /due-date-rules` | Acrescenta uma revisão. |
| `PATCH /due-date-rules/exception` | Grava ou remove a exceção de um lançamento, ocorrência ou fatura mensal. |

As rotas exigem autenticação, usam cache privado e limitam mutations. `effectiveFrom` é opcional no input e, quando omitido, é definido pela API com o dia atual no Brasil. Inputs passam pelos schemas Zod; seleções têm ownership validado no service/repository.

O cálculo financeiro vive em `packages/domain/src/due-date-rules.ts`. Web usa TanStack Form e Query; listas de lançamentos, contas a pagar, cartões, faturas e notificações reutilizam a resolução do backend. A UI recebe `originalDueDate`, `dueDate`, `dueDateAdjustment` (direção, regra opcional e motivos identificados), `dueDateRuleExcluded` e `dueDateExceptionEditable`. A explicação é calculada no domínio e apenas traduzida e formatada na interface.

## Remoção do calendário de recorrências

A migration `0015` remove `recurrence_schedule` e adiciona as revisões das regras, exceções e snapshots. O agendamento por enésimo dia útil, calendários individuais e `/transactions/recurrence-preview` foram retirados. As recorrências seguem sua referência, frequência e vencimento nominal; regras gerais são configuradas em Ajustes. A migração não converte as configurações retiradas em novas regras.

A migration `0016` adiciona snapshots dos motivos e a exceção por fatura. Na ocorrência recorrente, `null` herda a série, `true` mantém a data original e `false` reativa explicitamente o ajuste automático. O campo antigo de ocorrência, antes sem uso, passa a herdar a série.

A migration `0017` amplia as regras existentes para contas a pagar (`target: "payable"`) sem alterar seleções ou revisões. O catálogo de opções usa `payables` e inclui todos os meios elegíveis com vencimento; não há aliases antigos no contrato.

## Verificação

Na interface, crie uma conta a pagar e uma fatura com vencimento em final de semana, sem regras
personalizadas, e confira o próximo dia útil. Teste hover/toque, a exceção por item e a virada de
mês no widget. Em Ajustes, altere a direção ou adicione um feriado, revise a prévia e salve. Uma
baixa confirmada deve preservar o snapshot; desfazê-la libera a resolução pelas regras aplicáveis.

- `pnpm test`: calendário, resolução de regras, ciclos de cartão e services.
- `pnpm test:settlements:integration`: banco isolado, migrations, seleção de alvos, ownership, regras conflitantes, virada de mês, baixas e snapshots de boletos/recorrências/faturas.
- `pnpm test:recurring:integration`: regressão de recorrências.
- `pnpm check`, `pnpm build`, `pnpm release:check`.
