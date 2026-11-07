# Extrato da pessoa

O extrato reúne, para uma pessoa externa e um mês de competência, o que ela deve ao dono da conta.
Ele aparece na aba **Extrato** da página da pessoa e pode ser enviado por e-mail.

## Conteúdo

- **Resumo:** total do mês (despesas menos estornos), repasses recebidos e saldo (a receber,
  acertado ou crédito da pessoa).
- **Comparação com o mês anterior:** diferença e variação percentual do total do mês, antes dos
  repasses. Sem despesas no mês anterior, não há percentual.
- **Lançamentos agrupados** por cartão de crédito ou, fora do cartão, por forma de pagamento. Cada
  linha mostra data, descrição, categoria, parcela (`3/10`), recorrência e estornos. O grupo de um
  cartão mostra o **vencimento da fatura** do mês, com as mesmas regras de vencimento das faturas.
- **Próximos meses:** total já lançado para a pessoa em cada um dos três meses seguintes, com a
  quantidade de parcelas e recorrências. Meses sem nada lançado ficam de fora.
- **Repasses recebidos** no mês, manuais ou vindos de pagamento de fatura.

Entram despesas regulares, estornos e ajustes de fatura atribuídos à pessoa, com o mesmo recorte do
saldo de acertos. Pagamentos de fatura, ajustes de saldo, receitas e os próprios repasses não são
somados como despesa. Em despesas divididas, vale apenas a parte da pessoa. Recorrências são
expandidas para o mês consultado.

O cálculo vive em `packages/domain/src/person-reports.ts`. O saldo usa `calculatePersonBalance`,
o mesmo cálculo dos acertos.

## Privacidade

O extrato não traz nomes de contas, observações de lançamentos ou de repasses, nem identificadores
do usuário. Ele só existe para pessoas externas; a pessoa administradora recebe `400`
(`person_report_admin_not_allowed`).

## Envio por e-mail

O botão **Enviar por e-mail** do extrato envia o mês selecionado pelo Resend, com uma mensagem
opcional (até 500 caracteres) e, se marcado, uma planilha `.xlsx` com os mesmos lançamentos, sem
contas nem observações. O e-mail usa `EMAIL_FROM` como remetente e o e-mail do dono da conta como
`Reply-To`, para que a pessoa responda direto a quem enviou. A configuração está em
[variáveis de ambiente](environment-variables.md#e-mail-resend).

O e-mail usa as cores do tema claro do app e tem o formato de extrato: cabeçalho com o logo do
OpenMonetis, dados do extrato (destinatário, remetente, competência e emissão), o saldo com o
cálculo dos repasses e os lançamentos de cada cartão ou forma de pagamento. O logo do app e os
logos dos bancos vêm da pasta `logos/` do app e seguem como imagens embutidas (`cid:`), então
aparecem mesmo com o app atrás de login ou em rede privada. Logos de URL externa nunca são buscados
pelo servidor; nesses casos, e para formas de pagamento sem logo, o e-mail mostra a inicial do nome.

O envio só acontece para uma pessoa ativa, com e-mail e com despesas no mês. É possível reenviar o
mesmo mês; a API limita a 10 envios a cada 10 minutos por usuário, com
um limite separado para alterações do envio automático. O envio é síncrono: cada
tentativa fica registrada em `person_report_deliveries` com o status `sent` ou `failed`, e o
histórico aparece no card **Envios por e-mail**. Uma falha do provedor responde `503`
(`email_delivery_failed`) com mensagem genérica; o log do servidor registra apenas o ID do envio e
o status HTTP do provedor, nunca o destinatário ou o conteúdo. O ID da tentativa vai como
`Idempotency-Key` para o Resend descartar requisições duplicadas.

| Código | Status | Quando |
| --- | --- | --- |
| `email_not_configured` | 503 | `RESEND_API_KEY`/`EMAIL_FROM` ausentes. |
| `person_inactive` | 400 | A pessoa está inativa. |
| `person_email_missing` | 400 | A pessoa não tem e-mail. |
| `person_report_empty` | 400 | Não há despesas no mês. |
| `email_delivery_failed` | 503 | O provedor recusou ou não respondeu. |

## Salvar em PDF

O botão **Salvar PDF** no resumo da aba **Extrato** gera o mesmo documento do e-mail, com a data de
emissão do momento, e abre a impressão do navegador, onde basta escolher **Salvar como PDF**. O
nome sugerido para o arquivo é `Extrato de <pessoa> - <Mês de Ano>`. Nada é enviado nem registrado
no histórico, e o botão funciona sem o Resend configurado; fica desativado só em meses sem
despesas. O documento é exibido num quadro oculto e isolado, que não executa scripts, e carrega os
logos dos arquivos públicos do app web. Não há geração de PDF no servidor nem dependência nova.

## Envio automático

O botão **Envio automático**, ao lado de **Enviar por e-mail** no resumo da aba **Extrato**, abre as
regras de cada pessoa. Com o envio ativo, o resumo mostra a regra e a data do próximo envio. O envio
fica desligado até ser ativado, e desligar pausa sem perder as regras.

| Frequência | Regra |
| --- | --- |
| Semanal | Um dia da semana. |
| Quinzenal | Dois dias do mês (padrão: 1 e 16). |
| Mensal | Um dia do mês (padrão: dia 1). |
| Dias específicos | De 1 a 10 dias do mês. |

Um dia que não existe no mês (29 a 31) cai no último dia. Cada regra escolhe o **mês do extrato**:
o **mês anterior**, já fechado (padrão da frequência mensal), ou o **mês atual**, parcial, com os
lançamentos registrados até o dia do envio (padrão das demais). O e-mail de um mês em aberto sai
como **Extrato parcial**. A planilha pode ir anexada; a mensagem personalizada fica só no envio
manual.

Os envios saem a partir das 8h (horário de Brasília). A própria API verifica a cada cinco minutos,
com uma trava no banco para que só uma instância envie; não há serviço extra no Compose. Cada pessoa
recebe no máximo um envio automático por dia (`scheduled_for` único por pessoa e data), mesmo que
o extrato mude depois. Um envio que falha é tentado de novo após 10 minutos, até 3 tentativas, com o
mesmo `Idempotency-Key`. Pessoas inativas, sem e-mail ou sem despesas no mês são puladas sem gerar
registro. Se a API ficar fora do ar o dia inteiro, os envios daquele dia não são recuperados depois.
Para ativar, a pessoa precisa estar ativa, ter e-mail e a instalação precisa ter o Resend
configurado.

## Contrato HTTP

Todas as rotas exigem sessão, filtram por `userId` e respondem com `Cache-Control: private,
no-store`. Os schemas completos estão no OpenAPI.

| Rota | Descrição |
| --- | --- |
| `GET /person-reports/{personId}?period=YYYY-MM` | Extrato do mês (`PersonReportOutput`). |
| `GET /person-reports/{personId}/document?period=YYYY-MM` | O extrato do e-mail como página para impressão (`title` e `html`). |
| `GET /person-reports/{personId}/deliveries` | Últimos 10 envios e se o e-mail está configurado. |
| `POST /person-reports/{personId}/deliveries` | Envia o extrato: `period`, `message` e `includeSpreadsheet`. |
| `GET /person-reports/{personId}/schedule` | Regras do envio automático, hora de envio e próximas datas. |
| `PUT /person-reports/{personId}/schedule` | Salva as regras: `enabled`, `frequency`, `weekday`, `monthDays`, `reportPeriod` e `includeSpreadsheet`. |

## Verificação

1. Sem `RESEND_API_KEY`, confira o botão desativado com a explicação.
2. Com o Resend configurado, envie o extrato com mensagem e planilha e confira o e-mail, o
   `Reply-To` e o anexo.
3. Use uma chave inválida e confira o envio **Não entregue** no histórico e a mensagem genérica.
4. Clique em **Salvar PDF**, escolha **Salvar como PDF** e confira os logos, o nome do arquivo e
   que nenhum envio entrou no histórico.
5. Ative o envio automático para o dia de hoje antes das 8h e confira, depois das 8h, o envio
   **Automático** no histórico, uma única vez.
6. Execute `pnpm test`, `pnpm test:ownership:integration` e `pnpm test:migrations:integration`.
