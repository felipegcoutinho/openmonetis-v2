# Calendário

**Finanças → Calendário** mostra, dia a dia, o que vence ou fecha no mês escolhido. Ele não guarda
dados próprios: reúne o que já existe em contas a pagar, faturas de cartão e anotações.

## O que aparece

- **Contas a pagar:** as mesmas de **Contas a pagar** na Visão geral, incluindo ocorrências de
  despesas recorrentes, na data de vencimento já ajustada pelas regras de dia útil.
- **Faturas de cartão:** o fechamento (informativo) e o vencimento de cada fatura com saldo. Uma
  fatura de outro mês de referência aparece quando fecha ou vence no mês consultado.
- **Tarefas:** anotações do tipo tarefa com prazo no mês, concluídas ou não. Tarefas arquivadas
  ficam de fora.
- **Feriados e dias não úteis:** seguem o calendário configurado em
  **Ajustes → Regras de vencimento**.

Cada item tem uma situação: **em atraso** (vencido e não pago), **a vencer**, **pago** ou
**concluída**. Fechamentos de fatura são só informativos.

## Resumo do mês

- **A pagar no mês:** soma do que falta pagar em contas e vencimentos de fatura do mês. Para
  faturas, conta o saldo restante, descontados pagamentos parciais.
- **Já pago:** o que já foi pago desses mesmos itens.
- **Em atraso:** quantidade de contas, faturas e tarefas vencidas e não resolvidas.

Abaixo de cada número, o resumo diz de quantas contas, faturas e tarefas ele é feito.

## Ações

- **Pagar** em uma conta abre o mesmo registro de pagamento da Visão geral.
- Clicar numa fatura (a linha inteira) abre a fatura do cartão no mês de referência.
- Clicar numa tarefa leva às anotações.

Cada item aparece com o logo do estabelecimento (ou o ícone da categoria, quando não há logo) ou
do cartão. Na grade, o vencimento de uma fatura aparece como **Fatura** e o fechamento como
**Fecha**, seguidos do nome do cartão. O ícone no canto do logo indica a situação: alerta
vermelho para **em atraso**, relógio para **a vencer**, check verde para **pago** ou **concluída**
e cadeado para o fechamento, que é só informativo. O valor no topo do dia é o total a pagar naquele
dia (a legenda abaixo do mês explica os ícones e o valor). Ao escolher
um dia, a agenda separa os itens em **Contas a pagar**, **Faturas que vencem**, **Faturas que
fecham** e **Tarefas com prazo**. Numa fatura com pagamento parcial, o valor vem marcado como
**Restante**; no fechamento, o valor é o **total da fatura** até ali.
Com o foco em um dia, as setas do teclado mudam o dia selecionado e **Home**/**End** vão ao
primeiro e ao último dia do mês. No celular, a grade dá lugar a uma lista com os dias que têm
compromissos.

## API

`GET /calendar?period=YYYY-MM` exige sessão e responde sem cache. Devolve o resumo e todos os dias
do mês, cada um com `isBusinessDay`, o feriado (`national` com o identificador ou `custom`), o
valor em aberto e os itens ordenados por situação. Cada item traz a referência da origem:
`billId` (o `id` em `GET /bills?period=` do mesmo mês) e `categoryIcon` para contas, `cardId`,
`invoicePeriod` e `logo` para faturas ou
`noteId` para tarefas. O OpenAPI descreve o contrato completo.
