# Lançamentos recorrentes

Receitas e despesas recorrentes são regras expandidas pelo domínio no período consultado. Não há
uma lista finita de lançamentos criada antecipadamente. A frequência pode ser semanal, mensal,
bimestral, trimestral, semestral ou anual. `recurrenceEndDate` é um prazo opcional e inclusivo:
`null` mantém a recorrência sem prazo final.

## Série, versões e ocorrências

- A série mantém a identidade da recorrência ao longo das alterações.
- Cada versão guarda os dados e a vigência de uma regra. Seu limite interno `endDate` é independente
  do prazo informado pelo usuário em `recurrenceEndDate`; a expansão respeita o menor dos dois.
- Estados de baixa e exceções ficam vinculados à ocorrência, sem alterar os próximos valores.
- A competência e a referência são nominais. O vencimento ajustado segue as
  [regras de vencimento](due-date-rules.md), e o movimento de caixa segue a
  [data e o valor efetivos da baixa](settlements.md).

Os formulários mantêm referência, frequência e prazo final. O prazo também pode ser definido por
quantidade de ocorrências: o domínio converte "N ocorrências a partir da data do lançamento" na data
final inclusiva, considerando a âncora da série e o vencimento, e só `recurrenceEndDate` é gravado.
A quantidade não é persistida; pular uma ocorrência depois não estende o prazo. Quando nenhuma data
mantém exatamente N ocorrências, como em despesas semanais que compartilham o vencimento mensal, a
API retorna `endDate: null` e a data deve ser escolhida no calendário. Calendários individuais, agendamento
por enésimo dia útil e `/transactions/recurrence-preview` foram retirados; o calendário compartilhado
é configurado em Ajustes. A migration `0015` remove `recurrence_schedule` sem converter suas
configurações em novas regras.

## Edição e ações datadas

Os escopos de edição são `single` (ocorrência selecionada), `future` e `series`. Alterações na data de referência ou na
frequência usam “Esta e as próximas”, inclusive quando a série já tem edições isoladas. Ocorrências
anteriores mantêm datas, valores e baixas. As referências pendentes a partir da ocorrência
selecionada são recalculadas e seus estados antigos removidos; limites de pausa ou encerramento
agendados continuam respeitados.

A nova referência deve ser posterior à ocorrência anterior. Para antecipar o dia, o limite entre
versões também é antecipado, evitando perder a ocorrência do mês. Mudanças financeiras em
ocorrências confirmadas exigem desfazer a baixa antes da edição.

As ações `pause`, `resume`, `skip` e `stop` recebem uma data de ocorrência. Pausar e encerrar
preservam o histórico anterior à data informada. Pular remove somente a ocorrência selecionada da
projeção. Séries encerradas continuam disponíveis para consulta.

## Contratos e responsabilidades

| Método e rota | Responsabilidade |
| --- | --- |
| `GET /recurring-transactions/report?period=2026-10&type=expense` | Relatório por série de despesas ou receitas (`type=income`), situação atual, próxima ocorrência e projeções mensais. |
| `GET /transactions/recurrence-end-date?startDate=2026-11-15&frequency=monthly&occurrenceCount=12` | Data final que mantém de 2 a 360 ocorrências; aceita `anchorDate` e `dueDate`. |
| `GET /transactions/recurring-rules/{id}/occurrence?occurrenceDate=2026-10-12` | Dados completos da ocorrência para edição. |
| `PUT /transactions/recurring-rules/{id}` | Edição com `scope` e `occurrenceDate` na query; campos completos conforme OpenAPI. |
| `POST /transactions/recurring-rules/{id}/actions` | Ação datada com `action` e `occurrenceDate` no corpo. |
| `PATCH /transactions/recurring-rules/{id}/status` | Compatibilidade com a alteração de status; aceita `occurrenceDate` e usa o dia atual quando omitida. |
| `GET /recurring-expenses` | Widget mensal de despesas recorrentes. |
| `GET /recurring-expenses/report` | Relatório anterior de despesas, ainda disponível na API. |

As rotas exigem sessão autenticada e isolamento por usuário. O OpenAPI define os schemas completos.
As ações antigas em `/recurring-expenses/{id}/occurrences/{purchaseDate}` também permanecem
disponíveis; a nova página usa os comandos de `/transactions/recurring-rules`.

Na web, `/reports/recurring-transactions` reúne as abas de despesas e receitas. O endereço antigo
`/reports/recurring-expenses` redireciona preservando os filtros reconhecidos. Situação, meio de
pagamento e busca são filtros locais da página, preservados na URL; o endpoint do novo relatório
recebe apenas período e tipo.

`recurring-transactions` concentra o relatório unificado e as transições de séries. A feature
`recurring-expenses` mantém o widget e os contratos anteriores, além de funções de expansão
reutilizadas. A coexistência não significa que receitas usem o relatório antigo de despesas.

## Verificação

Execute `pnpm test` e `pnpm test:recurring:integration`. Mudanças que afetem baixas, vencimentos ou
caixa também exigem `pnpm test:settlements:integration`; mudanças de etiquetas ou categorias exigem
as integrações correspondentes. Consulte os requisitos em
[CONTRIBUTING.md](../CONTRIBUTING.md#testes-de-integração).

Na interface, crie uma receita e uma despesa recorrentes, confirme o prazo inclusivo e teste
edição futura, pausa, retomada, salto e encerramento sem alterar o histórico já confirmado.
