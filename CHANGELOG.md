# Changelog

Todas as mudanças notáveis do OpenMonetis serão documentadas neste arquivo.

O formato segue o [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e o projeto usa
[Versionamento Semântico](https://semver.org/lang/pt-BR/).

## [Unreleased]

### Adicionado

- Widget Comprometimento do mês no dashboard, na seção Planejamento: um velocímetro mostra
  quanto da receita prevista do mês já está comprometido, nas mesmas faixas de Compromissos
  futuros (saudável abaixo de 60%, atenção até 85% e crítico a partir daí), com os valores
  comprometidos, a folga e a variação em pontos percentuais em relação ao mês anterior. Sem
  receita prevista, o widget avisa em vez de posicionar o ponteiro. Layouts personalizados recebem
  o widget no fim da ordem e ele pode ser ocultado em Personalizar dashboard.
- Etiquetas podem ser inativadas e reativadas. A página de Etiquetas ganhou as abas Ativas e
  Inativas com a contagem de cada uma, e o botão de inativar desfaz a ação pelo aviso. Etiquetas
  inativas continuam nos lançamentos e nos filtros, mas deixam de ser oferecidas ao etiquetar
  lançamentos, exceto as que já estão selecionadas. A API expõe o campo `status` em `TagOutput`
  e aceita `status` em `PATCH /tags/{id}`; a migration `0018_tag_status` adiciona a coluna com
  `active` como padrão.
- Cor nas etiquetas, escolhida entre uma paleta fixa (neutra, laranja, azul, verde, roxa, amarela
  e vermelha) ao criar ou editar. A cor aparece no ícone da etiqueta na página de Etiquetas, nos
  seletores e nos chips dos lançamentos. A API expõe `color` em `TagOutput` e aceita o campo na
  criação e em `PATCH /tags/{id}`; a migration `0019_tag_color` adiciona a coluna com `neutral` como
  padrão.
- Quantidade de lançamentos do mês abaixo do nome de cada etiqueta. O relatório
  `GET /tags/report` passa a devolver `transactionCount`, contando cada transferência uma vez.
- Botão Registrar pagamento no topo da fatura do cartão sempre que houver saldo em aberto,
  abrindo o mesmo fluxo de pagamento do painel.
- Faixa Precisa de atenção na Visão geral, logo abaixo dos indicadores, com faturas e contas
  vencidas ou que vencem em até 7 dias, orçamentos perto do limite, no limite ou estourados e
  capturas pendentes, ordenados por urgência e com atalho para a ação. No celular, substitui o
  resumo anterior de pendências. A API expõe a lista em `GET /dashboard/attention`, informando as
  fontes que não puderam ser lidas sem perder as demais. A faixa pode ser ocultada ou exibida em
  Personalizar dashboard.
- Seleção de várias capturas na Caixa de entrada para descartá-las de uma vez, com validação de
  todas antes de alterar qualquer uma (`POST /inbox/discard`), e atalhos de teclado J/K para
  navegar, Enter para revisar, D para descartar e X para selecionar.
- Medidor de faixas no índice de comprometimento de Compromissos futuros, com a situação do mês
  (saudável, atenção ou crítico) ao lado do valor.
- Barra de ações em lote nos Lançamentos: ao selecionar lançamentos, uma barra escura e compacta
  fixa no rodapé mostra a quantidade, o saldo, as entradas e as despesas da seleção e permite
  marcar como pago ou em aberto, trocar a categoria, adicionar ou remover uma etiqueta, atualizar a
  descrição (uma única para todos ou ajustada lançamento a lançamento) e excluir. Cada ação mostra
  no tooltip quantos lançamentos alcança ou por que não se aplica, exibe carregamento no próprio
  ícone enquanto roda, e a seleção pode ser limpa com Esc ou estendida com Shift+clique. Recorrências, lançamentos gerados pelo
  sistema e itens incompatíveis com a ação são ignorados e informados no aviso final. A API expõe
  `PATCH /transactions/bulk/category`, `PATCH /transactions/bulk/names`,
  `PATCH /transactions/bulk/tags` e
  `POST /transactions/bulk/delete`, que validam posse e elegibilidade de todos os lançamentos antes
  de alterar qualquer um.
- Página inicial nas Preferências: escolha entre Visão geral, Lançamentos, Contas, Cartões,
  Orçamentos e Caixa de entrada como a página aberta ao entrar, inclusive pelo Google e por chave
  de acesso. A API expõe `startPage` em `UserPreferencesOutput`; a migration
  `0020_user_start_page` adiciona a coluna com `dashboard` como padrão.
- Feriados que se repetem todo ano nas Regras de vencimento, para incluir feriados estaduais e
  municipais uma única vez. O calendário aceita `recurringHolidays` (dias no formato `MM-DD`), e
  versões salvas antes continuam válidas sem esse campo.
- Renovação do token de um aparelho do Companion em Integrações, que revoga o token atual e mostra
  o novo QR Code (`POST /device-tokens/{id}/rotate`). Cada aparelho mostra quantas capturas enviou
  nos últimos 7 dias e um aviso quando o token expira em até 30 dias; a API expõe
  `recentCaptureCount` e `expiresSoon` em `DeviceToken`.
- Aba Perfil em Ajustes, aberta por padrão e pelo item Meu perfil do menu do usuário: mostra
  avatar, nome e e-mail de acesso da pessoa principal, com edição pelo mesmo formulário de Pessoas,
  um resumo das formas de entrar com atalho para Segurança, a data de criação da conta e o atalho
  para os próprios lançamentos. O menu do usuário também ganhou o item Ajustes.
- Atalho Gerenciar regras de vencimento no detalhe de vencimentos ajustados, e link direto para as
  regras da Caixa de entrada em Integrações (`/inbox?rules=open`).
- Prazo de recorrências por quantidade de ocorrências: em Repetir até, a opção Definir por
  quantidade mostra a data em que a série termina (por exemplo, 12 ocorrências mensais a partir de
  15/11/2026 terminam em 15/10/2027) e a aplica como data final. A data é calculada pela API
  (`GET /transactions/recurrence-end-date`), considerando a âncora da série e o vencimento, e só
  `recurrenceEndDate` é gravado; pular uma ocorrência depois não estende o prazo.

### Alterado

- Instaladores fixam a versão: `install.sh` e `install.ps1` clonam a tag da versão publicada mais
  recente, em vez da branch padrão, e gravam a mesma versão em `OPENMONETIS_VERSION`, mantendo
  `compose.yml`, `.env.example` e imagens alinhados. `OPENMONETIS_VERSION` definido antes da
  execução escolhe outra versão publicada. O `.env.example` passa a trazer a versão da release em
  vez de `latest`, e `pnpm release:check` recusa a divergência.

- Tipografia mais legível: valores em reais usam a fonte principal com algarismos tabulares em
  vez da fonte monoespaçada, nenhum texto fica abaixo de 12px, títulos de página e de seção seguem
  uma escala única e as fontes passam a ser servidas pelo próprio app, sem depender do Google
  Fonts e com arquivos menores. Títulos de cards e diálogos e os valores de destaque ficam em
  peso maior, o texto secundário ganha mais contraste no tema claro e códigos e atalhos exibem o
  zero cortado para não confundir com a letra O. A escala de pesos fica restrita a regular, médio
  e seminegrito, sem subtítulos mais pesados que o título da seção; rótulos de sobrelinha, o
  texto original das capturas da Caixa de entrada, os contadores de parcela e os atalhos de
  teclado passam a usar a fonte monoespaçada.
- Aviso de novidades da versão ocupa uma única linha, com o resumo visível apenas em telas
  largas.
- Breadcrumbs terminam sempre na página atual e seguem as seções do menu; a aba do relatório de
  parcelamentos passa a se chamar Despesas parceladas.
- Lançamentos no celular reúne Selecionar, Importar extrato e Exportar em um menu de ações, mostra
  a quantidade de lançamentos e deixa a criação para o botão Novo da navegação inferior.
- Ações de inativar, excluir e remover de contas, cartões, orçamentos, pessoas, anotações e
  categorias ficam em um menu de mais ações; editar e adicionar subcategoria de categorias também.
- Filtros de status de contas, cartões, pessoas, anotações e metas usam o mesmo controle
  segmentado.
- Textos auxiliares, selos e rótulos da navegação inferior têm no mínimo 12 px.
- Painéis laterais (filtros e detalhes de lançamentos, personalização e listas da Visão geral,
  Central de atenção e navegação) têm a mesma largura e a mesma estrutura de cabeçalho, conteúdo
  rolável e rodapé fixo com ações lado a lado; deslizam a partir da borda e respeitam a preferência
  por menos movimento. No celular, Central de atenção e Personalizar dashboard abrem em tela cheia,
  e os filtros mostram a quantidade ativa no título com o botão Limpar filtros no rodapé.
- Resumo dos detalhes do lançamento mostra tipo e condição acima do valor, com a parcela atual ou
  a frequência da recorrência, e a situação com a data de baixa ou de vencimento logo abaixo.
- Visão geral informa que receitas, despesas e resultado incluem previstas, e Distribuição
  financeira identifica se o resultado é só lançado ou com previsões.
- Widgets de metas, anotações, caixa de entrada, parcelas e acertos ficam ocultos na Visão geral
  enquanto não têm dados.
- Etiquetas sem cadastro e anexos sem arquivos no mês deixam de mostrar busca e filtros, e os
  acertos de uma pessoa mostram uma mensagem quando não há repasses no período.
- Extrato da conta, fatura do cartão e demais resumos financeiros usam fundo neutro, com a cor
  do banco ou do cartão apenas em uma faixa lateral; o status da fatura aparece em cor de alerta
  quando vencida.
- Caixa de entrada e Lançamentos recorrentes trocam o bloco de destaque por uma faixa de resumo
  compacta, deixando a lista mais acima.
- Gráfico de Despesas parceladas passa a usar um único eixo, com a quantidade de compras no
  detalhe de cada mês.
- Evolução por categoria abre no gráfico em telas pequenas.
- Barra de navegação por mês fixa é totalmente opaca.
- Indicadores da Visão geral têm descrições mais curtas.
- Ajuda dos indicadores da Visão geral abre com toque ou clique, linhas e atalhos dos indicadores
  têm área de toque maior, pendências urgentes mostram o rótulo Urgente e a saudação ficou mais
  compacta.
- Widgets da Visão geral ficam agrupados em Contas e compromissos, Planejamento e Análises do
  período, e cada grupo preenche suas linhas sem deixar espaço vazio; o gráfico de receitas,
  despesas e resultado ocupa duas colunas. O painel Personalizar deixa de existir: cada grupo tem
  um botão Adicionar com os widgets disponíveis daquele grupo, e cada widget tem um menu para
  mover ou remover, salvos na hora. Restaurar padrão fica no topo da página, com confirmação.
- Sem nenhuma conta cadastrada, a Visão geral mostra só o convite para cadastrar a primeira, sem
  indicadores zerados; com tudo em dia, a faixa Precisa de atenção vira uma única linha.
- Ações rápidas da Visão geral podem ser usadas durante o carregamento, abrem o formulário assim
  que ele estiver pronto e avisam no mesmo clique quando ele não pode ser carregado.
- Animações de entrada em todo o app: barras de progresso e o medidor do índice de
  comprometimento se preenchem ao aparecer, linhas dos widgets e capturas da Caixa de entrada
  entram em sequência, status Pago/Paga surgem com um destaque, estados vazios aparecem
  suavemente, a barra de ações em lote dos lançamentos sobe da base da tela e capturas sendo
  descartadas esmaecem antes de sair. Tudo é desativado quando o sistema pede movimento reduzido.
- Fatura do cartão: o topo mostra o limite disponível com a barra de uso, quanto já foi pago e
  quanto resta, e indica cartão inativo. Ajustar fatura, Ajustar datas, Desfazer pagamento e
  Reabrir fatura passam para o menu Mais ações, que explica por que uma ação está indisponível.
  O resumo da fatura na API (`invoiceSummary`) passa a trazer `paidAmount`, `remainingAmount` e
  `payments`.
- Extrato da conta: o topo mostra o saldo anterior e o resultado do mês, rotula o saldo como
  "Saldo em" último dia do mês e indica conta arquivada. Em poupança e investimento, Adicionar
  rendimento vira a ação principal. O resumo da conta na API passa a trazer `openingBalance` e
  `netAmount`.
- Históricos de 12 meses do cartão e da conta destacam o mês aberto da mesma forma e permitem
  abrir qualquer mês pelo teclado. O nome do cartão ou da conta aparece no título da aba, e o
  carregamento inicial mostra a estrutura da página em vez de só um texto.
- Ajustes reorganizado: Companion passa a se chamar Integrações e Ações perigosas passa a se chamar
  Dados da conta. Links antigos com `?tab=companion`
  e `?tab=danger-zone` continuam abrindo a seção certa.
- Preferências mostram o tema escolhido como prévia antes de salvar, e descartar volta ao tema
  salvo. Conta e cartão padrão indicam o modo automático com clareza e oferecem atalho para
  cadastrar quando não há opção ativa.
- Regras de vencimento ficam recolhidas em uma lista com resumo e marcam regras em conflito ou
  incompletas antes de revisar. A barra de salvar fica fixa enquanto há alterações.
- O diálogo de conexão do Companion confirma em tempo real quando o aparelho se conecta, e as
  instruções de conexão ficam reunidas em uma única seção.

### Corrigido

- Trocar o mês na fatura do cartão ou no extrato da conta fazia a página inteira piscar e perder a
  rolagem enquanto os dados carregavam.
- Desfazer um pagamento de fatura com vários pagamentos mantinha o diálogo aberto e aceitava
  clique duplo; Reabrir fatura sumia sem animação e não mostrava o carregamento.
- Editar a conta pelo extrato exibia a confirmação duas vezes.
- Botão Importar extrato aparecia duplicado na lista de lançamentos no celular.
- Barra fixa de navegação por mês deixava o conteúdo aparecer por trás do texto ao rolar.
- Textos de destaque e de aviso no tema claro passam a atender o contraste mínimo de leitura.
- Visão geral deixava de exibir o conteúdo abaixo dos indicadores até concluir o carregamento,
  deslocando a página quando ele aparecia.
- Comparação com o mês anterior mostrava -0% em quedas pequenas e porcentagens enganosas quando o
  valor anterior era zero ou negativo, como +100% de -R$ 223,35 para R$ 0,00; nesses casos, passa a
  mostrar a diferença em reais.
- Trocar de seção ou de página em Regras de vencimento com alterações não salvas agora pede
  confirmação em vez de descartá-las sem aviso.
- A confirmação de apagar dados financeiros ou excluir a conta de acesso volta a aparecer após o
  recarregamento da página.
- A descrição do atalho da barra inferior nas Preferências não cita mais um botão que só existe no
  celular quando vista no desktop.

### Notas de atualização

- Banco: três migrations novas, aplicadas pelo `migrator` na atualização: `0018_tag_status`
  (coluna `status` em `tags`, padrão `active`), `0019_tag_color` (coluna `color` em `tags`, padrão
  `neutral`) e `0020_user_start_page` (coluna `start_page` em `user_preferences`, padrão
  `dashboard`). Dados existentes recebem os valores padrão e nada é removido. Faça backup do
  PostgreSQL antes de atualizar e acompanhe `docker compose logs migrator`; para desfazer, restaure
  o backup, pois reverter a imagem não desfaz as migrations.
- API: nova rota autenticada `GET /transactions/recurrence-end-date`, com `startDate`, `frequency`,
  `occurrenceCount` (2 a 360) e, opcionalmente, `anchorDate` e `dueDate`. Retorna `endDate` ou
  `null` quando nenhuma data mantém exatamente a quantidade pedida.
- API: nova rota autenticada `POST /device-tokens/{id}/rotate`, que revoga o token atual do aparelho
  e entrega o novo uma única vez. Campos novos nas respostas: `status` e `color` em `TagOutput`
  (aceitos também na criação e em `PATCH /tags/{id}`), `transactionCount` em `GET /tags/report`,
  `startPage` em `UserPreferencesOutput`, `recentCaptureCount` e `expiresSoon` em `DeviceToken`,
  `paidAmount`, `remainingAmount` e `payments` em `invoiceSummary`, `openingBalance` e `netAmount`
  no resumo da conta, e `recurringHolidays` (opcional) no calendário das regras de vencimento.
  Clientes com validação estrita das respostas devem aceitar os campos adicionais.
- Instalação: novas instalações passam a usar a versão publicada mais recente, não mais `latest`.
  Instalações existentes com `OPENMONETIS_VERSION=latest` continuam funcionando, mas recomenda-se
  fixar a versão: faça checkout da tag `vX.Y.Z` desejada e defina a mesma versão no `.env`.

## [0.12.0] - 2026-10-28

Amplia os relatórios com Compromissos futuros e Distribuição financeira, adiciona transferências ao
relatório de etiquetas, unifica o seletor de faixa de período e renova o tema escuro e os gráficos.

### Adicionado

- Relatório Compromissos futuros, com o quanto da renda prevista já está comprometido em parcelas,
  recorrências e contas avulsas em uma faixa de até 24 meses escolhida pelo seletor de período,
  índice de comprometimento e situação por mês, próximo alívio e parcelamentos que terminam no
  período.
  Despesas avulsas de qualquer forma de pagamento entram no mês, estornos e descontos de
  antecipação são abatidos, contas fora do saldo total são ignoradas também nas parcelas e o
  próximo alívio considera só parcelas e recorrentes.

- Relatório Distribuição financeira com fluxo entre receitas e categorias de despesa, saldo e
  déficit do mês, filtros por pessoa e previsões, subcategorias e exportação CSV.
  Inclui comparação com o mês anterior, taxa de poupança calculada pela API, destaques em largura
  total, categorias menores agrupadas em "Outras categorias", versão em listas para telas
  pequenas, destaque ao passar o mouse no gráfico e exportação do gráfico como imagem PNG.
  Contas fora do saldo total são excluídas automaticamente, incluindo rendimentos, despesas
  de cartão e recorrências, respeitando a conta efetiva das baixas.

- Coluna Transferências no relatório mensal de etiquetas, em desktop e celular, contando cada
  movimentação entre contas uma vez, sem alterar receitas, despesas ou resultado.

### Alterado

- Compromissos futuros e Evolução por categoria usam um seletor de período em uma única linha.
  Ao clicar, é possível escolher o mês inicial e final em uma grade de meses ou por atalhos e
  aplicar a seleção, com limite de 24 meses.

- Evolução por categoria exibe totais de despesas e receitas e a maior alta do último mês, reúne
  filtros e exportação em uma linha, ordena a tabela por média ou total com essas colunas fixas
  e desenha o gráfico com linhas retas.

- Tema escuro com tons quentes e maior contraste, fonte Geist na interface e marcadores de legenda
  padronizados nos gráficos. Receitas, despesas e balanço do Dashboard aparecem em barras
  empilhadas e os destaques da Distribuição financeira usam cartões compactos.

- Fluxo de contribuição e release separa commits por mudança, com registros em `Unreleased`,
  do fechamento da versão, que consolida o changelog e valida o conjunto antes da publicação.

### Corrigido

- Seletores responsivos mantêm o estado de abertura ao alternar entre desktop e celular, sem
  avisos de mudança entre estado controlado e não controlado.

### Notas de atualização

- API: nova rota autenticada `GET /reports/commitments`, com filtros `startPeriod` e `endPeriod`
  (faixa inclusiva de até 24 meses). Não há migration ou nova configuração de ambiente.
- API: nova rota autenticada `GET /reports/financial-distribution`, com filtros `period`,
  `personScope` (padrão `admin`) e `mode` (padrão `actual`). Clientes podem consumir o relatório
  pelo contrato OpenAPI; não há migration ou nova configuração de ambiente.
- API: `GET /tags/report` inclui `transfers` em cada item, com zero quando não há transferências.
  Clientes com validação estrita da resposta devem aceitar esse novo campo numérico, que não
  compõe `income`, `expenses` nem `balance`.
- Atualização: não há migrations, variáveis de ambiente ou mudanças no Compose. Configure
  `OPENMONETIS_VERSION=0.12.0` e atualize API, web e migrator juntos com `docker compose pull` e
  `docker compose up -d`.

## [0.11.1] - 2026-10-21

Corrige o timeout da publicação ARM64 com builds nativos por arquitetura e impede que falhas de
compilação atualizem somente parte das imagens da versão.

### Corrigido

- Imagens Docker são compiladas em runners nativos AMD64 e ARM64, evitando o timeout do Vite sob
  emulação. As tags de versão e `latest` só são atualizadas depois que os seis builds terminam
  com sucesso; falhas de compilação deixam as tags existentes preservadas.

### Notas de atualização

- Publicação: esta versão substitui a publicação parcial da `0.11.0`. Configure
  `OPENMONETIS_VERSION=0.11.1` e atualize API, web e migrator juntos com `docker compose pull` e
  `docker compose up -d`.
- Banco: ao atualizar a partir da `0.10.2` ou anterior, faça backup do PostgreSQL, do storage e da
  configuração e siga também as notas da `0.11.0` abaixo. As migrations acumuladas `0011`–`0017`
  continuam necessárias; acompanhe `docker compose logs migrator`. Esta correção não adiciona
  migrations.

## [0.11.0] - 2026-10-21

Amplia a organização e o acompanhamento financeiro com etiquetas, subcategorias, baixas por
valor efetivo e regras de vencimento, aprimora a gestão de recorrências e adiciona exportação
de lançamentos, com novas validações de integração e navegador.

### Adicionado

- Testes de services de notificações, releases, estabelecimentos e conexões, além de novos cenários de notas e inbox; limites de cobertura de domínio/services elevados para 91% de linhas, 82% de ramificações e 89% de funções.
- Ampliação dos testes de transações, parcelas e faturas para importação, estornos, transferências, baixas, ownership, estados inválidos e falhas de persistência; 622 testes sem banco, com cobertura de 94,32% das linhas de transações e 100% das linhas de parcelas e faturas.
- Testes Chromium de passkeys com WebAuthn e autenticador virtual, rejeição de callbacks OAuth inválidos e suíte optativa para storage real.

- Testes de consulta e desfazimento parcial/total de antecipações, desfazimento de pagamentos, remoção de ajustes e datas de faturas; cópias de lançamentos e recorrências com testes de ownership, falhas de persistência e isolamento do histórico.

- Testes de conservação de centavos em parcelas e baixas, orçamentos, contas a pagar e relatórios recorrentes; integração da API verifica atomicidade, concorrência, exportações e permissões em operações financeiras.

- Cobertura automatizada de anexos e protocolo S3, convites e conexões, importação OFX/Excel, reset/exclusão, ownership e upgrade com dados; testes Chromium para fluxos financeiros e relatórios de cobertura com limites mínimos na CI.

- Testes da API montada com sessões reais e PostgreSQL para acesso anônimo, isolamento entre usuários, transferências, estornos e conflitos concorrentes; nova integração executada pela CI e guia de testes com as lacunas restantes.
- Exportação de lançamentos em CSV e Excel (`.xlsx`), com todos os resultados do período, busca e filtros atuais, preservando a ordenação e os valores por pessoa nos lançamentos divididos.
- Configuração `DISABLE_SIGNUP` para bloquear novos usuários por senha e Google, mantendo login existente; a web consulta a disponibilidade de cadastro pela API. O guia de produção descreve o primeiro usuário e o fechamento do cadastro.
- Ajustes ganha personalizações e exceções de vencimento para boletos e faturas, com seleção de itens/cartões, calendário compartilhado, prévia e histórico de configurações.
- Vencimentos ajustados recebem destaque com explicação dos dias não úteis e feriados, além de ações para manter a data original ou reativar o ajuste automático somente no lançamento, ocorrência ou mês da fatura.

- Baixa de receitas e despesas com valor efetivo, data e conta, preservando os valores previstos, rateio proporcional em centavos, histórico de confirmações e desfazimentos e dados antigos sem data efetiva inventada.

- Relatório de lançamentos recorrentes com abas de despesas e receitas, filtros de situação, meio e busca preservados na URL, projeções mensais e criação contextualizada.
- Gestão de receitas recorrentes permite editar pelo formulário completo, pular a próxima ocorrência, pausar, retomar e encerrar, mantendo as séries encerradas disponíveis para consulta.
- Data final opcional e inclusiva em receitas e despesas recorrentes, com edição do prazo para as próximas ocorrências ou toda a série e indicação nos detalhes.
- Ação de pular ocorrência de receita ou despesa na lista de lançamentos e nos detalhes em telas pequenas.
- Subcategorias em dois níveis, com criação dentro do grupo, edição da categoria principal e seleção com o caminho completo nos lançamentos e recorrências.
- Filtros por categoria principal incluem suas filhas; relatórios e dashboard agrupam os totais sem duplicar lançamentos, com detalhamento por subcategoria e valores diretos no grupo.

- Etiquetas por usuário, com cadastro, edição e exclusão, seleção múltipla em lançamentos e recorrências, filtros e relatório mensal de receitas, despesas e saldo por etiqueta.
- Etiquetas acompanham parcelas, cópias e reembolsos; edições de recorrências preservam os escopos por ocorrência, futuras e série completa.

### Alterado

- Subcategorias em Categorias e Evolução por categoria usam o ícone da categoria principal com cores de fundo e ícone invertidas, sem linha vertical de hierarquia.
- Tela de login simplificada com remoção do aviso de cadastro desabilitado e da seção "Não consegue acessar?".
- Removidas as suítes que chamavam o Google real e suas configurações; a segurança OAuth continua verificada com provedor controlado, sem conta externa de teste.

- Interface web usa DM Sans nos textos e títulos, com remoção dos arquivos e declarações da GT America e preservação da Aeonik Fono nos detalhes monoespaçados.
- Logo em texto redesenhado com DM Sans Medium em vetor, mantendo nitidez em qualquer escala e adaptação aos temas claro e escuro.
- O widget "Acertos por pessoas" mostra, em um único bloco por pessoa, o progresso dos repasses recebidos sobre o valor atribuído líquido de estornos, com o valor que falta e créditos quando houver. Pessoas já acertadas permanecem no fim da lista e o saldo por pessoa na API passa a incluir `dueAmount` e `coveredAmount`, e o resumo, `pendingCount`.
- Indicador da aba ativa usa o mesmo azul do foco dos campos de formulário em todas as tabs com sublinhado.
- Barras de progresso, incluindo o uso de limite dos cartões, usam segmentos verticais com pontas arredondadas, espaçamento definido e trilho suave, preservando as cores de status e a leitura dos percentuais em todo o sistema.
- Suíte sem banco descobre automaticamente novos arquivos de teste nos workspaces, sem manter uma lista manual no `package.json`.
- Widgets Condições de pagamento e Formas de pagamento permitem alternar entre lista e gráfico de pizza, seguindo o visual e o modo de privacidade dos gráficos por categoria.
- Identificação de regras aplicadas na Caixa de entrada exibe o avatar da pessoa associada ao lado do nome da regra, com iniciais quando não há foto.
- Barra de lançamentos agrupa exportação com importação de extrato e posiciona os filtros após a pesquisa.
- Tabela de evolução por categoria uniformiza o alinhamento e o visual dos grupos, mostra a quantidade de subcategorias junto à expansão e usa recuo nos detalhes. Valores mensais e variações mantêm alinhamento consistente, com média e total identificados também nas telas menores.
- Evolução por categoria usa peso normal nos valores e médio nos nomes, mantém categoria e meses visíveis durante a rolagem da tabela, reduz o destaque dos meses sem movimento e identifica o mês mais recente. O gráfico inicia com cinco categorias e permite ampliar para dez séries distintas.
- Ações dos cards da Caixa de entrada usam botões consistentes no desktop e alvos de toque maiores no mobile; valor e botões permanecem alinhados quando há espaço.
- A alteração da senha de acesso abre um formulário em modal a partir do botão abaixo do status da senha cadastrada.
- Introdução das regras de vencimento integrada ao painel de Ajustes, seguindo a estrutura das demais seções.
- Card de feriados nacionais em Ajustes apresenta navegação compacta por ano e lista de datas mais legível.
- Subcategorias mantêm o padrão de lista do sistema, com recuo hierárquico, área de navegação ampliada, destaque discreto ao interagir e formulário de criação compacto.

- Aba Companion padronizada com as demais configurações, com lista de aparelhos consistente com Segurança, instruções breves sempre visíveis e atalhos de instalação e Caixa de entrada.
- Notas operacionais do changelog são preservadas em `upgradeNotes` na API e exibidas separadamente na web; contribuições e releases passam a revisar impactos no banco, contratos, ambiente e Compose.
- Ajuste automático de vencimento passa a abranger todas as contas a pagar com data informada, incluindo Pix, débito, dinheiro, transferência e benefícios; personalizações, exceções e proteção de pagamentos usam o mesmo fluxo.
- Hover de vencimentos mostra só a mudança de data e a direção do ajuste; o painel de clique resume o motivo e mantém a ação por item.
- Boletos e faturas avançam automaticamente para o próximo dia útil, sem cadastro de regras. Ajustes reúne personalizações, exceções e feriados adicionais; remover uma personalização restaura o padrão automático. Datas e motivos são preservados após pagamentos, inclusive parciais.
- Regras de vencimento usam vigência automática, revisão antes de salvar, busca de alvos e consulta dos feriados nacionais por nome e data; formulário adapta a inclusão de feriados ao espaço disponível e exibe os seletores em português.

- Calendários individuais e agendamento por enésimo dia útil foram removidos das recorrências. Vencimentos ajustados preservam a data original e as baixas confirmadas; fechamento e composição de faturas mantêm o ciclo nominal.

- Widget “Boletos” passa a ser “Contas a pagar”, com despesas por Pix, débito e outros meios que tenham vencimento, incluindo parcelas e recorrências. Formulários permitem informar ou remover o vencimento; avisos e links usam o filtro de contas a pagar e pagamentos exibem a data efetiva em todos os meios.
- Extratos e saldos consideram a data e o valor efetivos da baixa; confirmações em uma ocorrência não alteram o valor das próximas recorrências. Mudanças financeiras em registros confirmados exigem desfazer a baixa.
- Pagamento de contas usa o mesmo fluxo de baixa e permite registrar diferenças de valor; a lista inclui despesas com vencimento em outros meios de pagamento além de boleto.

- A página de despesas recorrentes passa a ser “Lançamentos recorrentes”; cada série aparece uma única vez, com valor por ocorrência, frequência, próxima data e prazo final. O endereço antigo redireciona preservando os filtros.
- Remoção da data final da recorrência usa um ícone discreto ao lado do campo, com dica de ação e texto de ajuda compacto.
- Gestão de categorias com grupos expansíveis, contador de subcategorias e abertura automática durante a busca ou criação; seletor identifica categorias principais e seleciona novos cadastros sem perder os dados do lançamento.
- Relatórios destacam o total de cada grupo e suavizam as subcategorias, com identificação explícita dos lançamentos registrados diretamente na categoria principal.
- Campo de etiquetas integrado ao accordion do lançamento, antes da observação, com criação dentro do seletor e ícone de etiqueta padronizado.
- Gerenciamento de etiquetas usa a barra de navegação mensal do sistema, com setas e seleção de mês, e exibe o ícone de etiqueta ao lado de cada nome.
- Etiquetas selecionadas aparecem como chips removíveis; buscas vazias oferecem limpar a busca, e a gestão usa cartões em telas pequenas.
- Relatório de etiquetas apresenta “Resultado” com explicação e os lançamentos podem ser filtrados por “Sem etiquetas”, inclusive recorrências.

### Corrigido

- Tabelas de evolução por categoria acompanham a altura do conteúdo, sem rolagem vertical interna limitada à altura da tela.
- Cópia de compras parceladas usa o valor original da série e redistribui o rateio proporcionalmente, evitando acréscimo ou perda de centavos ao copiar parcelas arredondadas.

- Baixas com valor insuficiente para o rateio retornam erro de validação identificado, sem gravar dados, em vez de erro interno.

- Gatilho decorativo de descrições recentes declara sua semântica não nativa, eliminando o aviso de botão inválido encontrado pelos testes no navegador.

- Reset remove também metas, etiquetas, séries de recorrência e histórico de baixas do titular, preservando os dados de outros usuários.

- Edição de transferências preserva o identificador que une débito e crédito, mantendo a atualização e a exclusão dos dois lançamentos após alterações de valor.
- Contrato OpenAPI de `GET /auth-config` declara acesso público, sem herdar a exigência de sessão.
- Documentação corrige a unidade decimal de `settledAmount`, separa backup e restauração de PostgreSQL local e externo e detalha variáveis opcionais e a opção de desconsiderar feriados nacionais.
- Documentação alinhada aos contratos de recorrências, baixas e vencimentos, com requisitos de Node.js, CORS do storage e testes de integração explícitos.
- Prévia de parcelas calculada pela API e pelo domínio, preservando os valores e a distribuição de centavos exibidos no formulário sem cálculo financeiro no navegador.
- Publicação valida tags anotadas e a CI executa também as integrações financeiras com PostgreSQL.
- Logos dos lançamentos permanecem abaixo da barra fixa de seleção de mês durante a rolagem.
- Acertos de pessoas contabilizam recorrências de cartão no mês da fatura, respeitando o fechamento e o rateio, sem antecipar cobranças do mês seguinte.
- Removida a referência ao arquivo `SECURITY.md` inexistente no README.
- Lançamentos usam o ícone da categoria como fallback do logo em listas, widgets, relatórios, detalhes, despesas externas e notificações; categorias sem ícone usam o símbolo genérico de categoria.
- Edição da data ou frequência de recorrências com alterações anteriores permite aplicar a mudança desta ocorrência em diante, preservando o histórico e protegendo baixas confirmadas; o formulário oferece o alcance compatível com a API.
- Pausar ou encerrar uma recorrência mantém as ocorrências anteriores e suas baixas; versões futuras deixam de ser projetadas a partir da data escolhida, respeitando o prazo da série.
- Seletor de etiquetas segue a altura e a tipografia dos demais campos em formulários mobile.
- Edição de etiquetas e outros dados descritivos preserva o período de parcelas quando o agendamento não é alterado.

### Notas de atualização

- Desenvolvimento: Node.js 22.12 ou superior é necessário para o TanStack Start usado pelo workspace. As treze suítes PostgreSQL aceitam `TEST_DATABASE_URL` e são executadas pela CI; localmente, consulte os requisitos em `CONTRIBUTING.md`.
- Storage: configure o CORS do bucket para a origem HTTPS da web, permitindo o upload direto por `PUT` com `Content-Type`. `CORS_ORIGIN` configura apenas a API; o guia de produção inclui um exemplo para o bucket privado.
- API: `GET /transactions/installments/preview?amount=3` fornece opções de 2 a 60 parcelas, com valores mínimo e máximo calculados no domínio. A rota exige sessão; atualize API e web para manter a prévia no formulário. As baixas aceitam `settledAmount`, `settledDate` e `accountId`, preservando `amount`; o filtro `payables=true` inclui todos os meios elegíveis com vencimento.
- Banco e API: a migration `0012` adiciona `parent_id`, unicidade por grupo e proteção da hierarquia de categorias. Categorias existentes continuam como principais. Os contratos adicionam `parentId` e `parentName`; filtros de categoria principal incluem suas filhas e os relatórios expõem subcategorias e valores diretos do grupo. Categorias com filhas ou referências financeiras não podem ser excluídas.
- Ambiente: `DISABLE_SIGNUP` é opcional e assume `false`. Para fechar novos cadastros, configure `true` no `.env` e execute `docker compose up -d --no-deps --force-recreate api`. Crie a primeira conta em acesso restrito antes de fechar o cadastro; contas existentes continuam entrando por senha, Google e passkey. Valores diferentes de `true`/`false` impedem a inicialização.
- Compose: o serviço `api` recebe `DISABLE_SIGNUP`; atualize o arquivo Compose junto com a aplicação. Não é necessário recompilar a web. Os instaladores continuam usando a branch padrão e `latest`: A seleção de versões nos instaladores permanece pendente; versões fixas exigem alinhar manualmente checkout e `OPENMONETIS_VERSION`.
- API: `GET /auth-config` é público e retorna apenas `signupEnabled` e `googleEnabled`, sem credenciais e sem cache; o OpenAPI declara `security: []` nessa operação. `GET /releases` adiciona `upgradeNotes` por versão; versões sem notas retornam uma lista vazia. Clientes devem tratar as notas como um campo adicional.
- Banco: faça backup do PostgreSQL, do storage e da configuração antes de atualizar esta versão com as migrations acumuladas `0011`–`0017`. A `0014` adiciona dados de baixa e auditoria sem inventar datas antigas; a `0015` substitui os calendários por recorrência pelas regras gerais e remove `recurrence_schedule`, sem converter as configurações anteriores; a `0017` amplia o alvo das regras existentes de boleto para contas a pagar. Acompanhe `docker compose logs migrator` antes de validar a API. Reverter somente as imagens não desfaz as migrations; uma restauração exige o backup e a versão compatível com ele.
- A migration `0016` adiciona a exceção por fatura e snapshots dos motivos de ajuste; exceções em recorrências podem herdar a série ou valer somente para a ocorrência. O contrato inclui `dueDateAdjustment` e `dueDateExceptionEditable`, e `PATCH /due-date-rules/exception` permite alternar o ajuste por item com validação de ownership e proteção de pagamentos.

- O novo `GET /recurring-transactions/report` recebe `period` e `type` (`income` ou `expense`); os totais consideram a participação do titular pela data da ocorrência, enquanto a lista apresenta a situação atual de cada série. A consulta autenticada `GET /transactions/recurring-rules/{id}/occurrence` fornece os dados completos para edição.
- A migration `0013` adiciona o prazo opcional das recorrências. Regras existentes continuam sem data final; saldos, faturas, contas a pagar, etiquetas e relatórios respeitam o prazo das novas regras.
- O contrato de lançamentos aceita e retorna `recurrenceEndDate`. As ações datadas usam `POST /transactions/recurring-rules/{id}/actions`; a rota de status continua disponível e preserva o histórico anterior à data informada ou ao dia atual.
- Execute as migrations antes de iniciar a nova API: foram adicionadas as tabelas de etiquetas e seus vínculos. Os lançamentos existentes permanecem sem etiquetas.
- O contrato financeiro passa a aceitar e retornar `tagIds`, de forma aditiva; os endpoints `/tags` e `/tags/report` exigem sessão autenticada.

## [0.10.2] - 2026-10-04

Corrige o vazamento de layout dos breadcrumbs e padroniza o fundo dos modais mobile,
com atualização da imagem do dashboard e das cores de seleção de texto.

### Alterado

- Seleção de texto usa fundo na cor primária e texto na cor de carvão.
- Imagem do dashboard usada na apresentação do projeto atualizada.

### Corrigido

- Breadcrumbs longos em telas pequenas mantêm a rolagem dentro do cabeçalho, sem ampliar ou deslocar o layout das páginas de detalhes.
- Modais mobile mantêm o fundo escurecido também ao abrir seletores, calendários e outros painéis dentro de um formulário.

## [0.10.1] - 2026-10-03

Corrige o posicionamento dos modais de formulários no mobile após o build de produção.

### Corrigido

- Modais de formulários no mobile mantêm o conteúdo dentro da tela após o build de produção, tanto em páginas completas quanto em painéis inferiores.

## [0.10.0] - 2026-10-03

Amplia os extratos com fluxo diário e histórico de saldo, permite configurar compras no dia do
fechamento dos cartões e aprimora os formulários e a navegação da interface web em telas pequenas.

### Adicionado

- Cartões permitem enviar compras feitas no dia do fechamento para a próxima fatura, com encerramento do ciclo na véspera e preservação dos lançamentos já registrados.
- Extratos de contas exibem entradas, saídas e evolução diária do saldo, com histórico navegável dos últimos 12 meses.
- Atalho da navegação mobile pode ser alterado por pressão longa ou pelo indicador no botão, com a escolha salva nas preferências do usuário.

### Alterado

- Divisões com duas pessoas ajustam automaticamente a participação restante ao editar o valor ou o percentual de uma delas, preservando o total do lançamento.
- Componentes extensos da interface divididos em seções menores, com formulários compartilhando a mesma instância de estado e ações de lançamentos reutilizadas entre tabela e detalhes.
- Formulários em telas menores que 768 px usam páginas ou painéis inferiores, com ações acessíveis, campos maiores e ajuste ao teclado; a apresentação desktop permanece preservada.
- Seleção mobile de contas, cartões, pessoas e categorias nos lançamentos oferece busca, avatares e logos; datas têm calendário ampliado e atalhos para hoje e ontem.
- Ação “Novo” na navegação inferior permite iniciar despesas, receitas e transferências sem sair da tela atual.
- Catálogos de instituições e ícones abrem em painéis mobile; voltar fecha a superfície aberta e preserva a confirmação de descarte dos lançamentos.
- Zoom por gesto volta a ficar disponível para acessibilidade.
- Seletores, filtros e detalhes usam painéis adaptados ao celular, com ações de toque maiores e preservação dos avatares e logos.
- Formulários mobile confirmam o descarte de alterações e protegem o envio em andamento; lançamentos começam pelo valor e a busca por descrições fica disponível em um painel próprio.
- Cabeçalhos, indicadores, cartões de contas e cartões de crédito têm espaçamento compacto no celular; listas de cadastros exibem esqueletos durante o carregamento.
- Aplicativo instalado tem identidade e escopo definidos no manifesto, com suporte à abertura independente no iOS.

### Corrigido

- Botão “Novo lançamento” da página de lançamentos usa altura de 48 px no mobile, com área ampliada para abrir as opções de criação.
- Menu mobile inclui acesso a Ajustes, disponível também em telas onde o ícone do cabeçalho fica oculto.
- Navegação inferior mobile usa fundo desfocado, recolhe ao avançar pelo conteúdo e reaparece ao voltar a rolagem ou ao topo; navegadores compatíveis podem desenhar o fundo até a área de gestos do Android.
- Categorias do indicador "Onde você mais gastou" abrem o respectivo histórico no mês selecionado.
- Extratos de contas mostram boletos quitados no mês do pagamento, inclusive recorrências pagas antecipadamente; a lista geral preserva o mês do vencimento e informa a data de pagamento.

## [0.9.0] - 2026-09-29

Adiciona edição de recorrências por ocorrência, ocorrências futuras ou série inteira e aprimora
a apresentação da interface web em telas pequenas e do relatório de recorrências.

### Adicionado

- Edição de recorrências permite aplicar alterações apenas à ocorrência selecionada, a partir dela ou a toda a série.

### Alterado

- Interface mobile com textos mais legíveis, zoom por gesto bloqueado, caixa de entrada contida na tela, lançamentos simplificados e boletos entre os indicadores.
- Card da caixa de entrada ajustado para telas pequenas, preservando a apresentação anterior no desktop; seus três filtros ficam lado a lado no mobile. Resumo de categorias, filtros de período e páginas de pessoas e categorias também adaptados para mobile.
- Filtros ativos de lançamentos organizados em linhas legíveis no celular.
- Cabeçalho mobile com marca maior e espaçamento equilibrado entre ícones, contador e avatar.
- Indicador "Onde você mais gastou" com cinco categorias e a mesma densidade de linhas dos demais cards do resumo mobile.
- Tipografia dos lançamentos mobile alinhada à hierarquia dos outros cards.
- Lista de regras recorrentes alinhada à de compras parceladas, com filtros, métricas por regra e detalhes para ações.

### Corrigido

- Páginas de categorias, tendências e Caixa de entrada voltam a respeitar a largura máxima no desktop, mantendo o conteúdo contido em telas pequenas.
- Editar uma recorrência não altera o pagamento das demais ocorrências; o pagamento de cada uma permanece na tabela de lançamentos.

## [0.8.1] - 2026-09-27

Corrige a instalação do aplicativo web em sites com autenticação no proxy e aprimora a hierarquia tipográfica da navegação e do painel.

### Alterado

- Navegação e indicadores do painel destacam melhor os rótulos, os valores e a saudação.

### Corrigido

- Instalação do app web em sites protegidos por autenticação no proxy, permitindo carregar o manifesto com credenciais.

## [0.8.0] - 2026-09-27

Adiciona metas de economia com acompanhamento por conta, histórico de faturas e filtros por regra na Caixa de entrada.

### Adicionado

- Filtro por regras ativas na Caixa de entrada, aplicado antes da paginação das capturas.
- Metas de economia com acompanhamento manual ou pelo saldo persistido de uma conta, data alvo, progresso e estados de pausa, conclusão e arquivamento.
- Metas aparecem na visão geral após Orçamentos; seleção de acompanhamento e conta exibe rótulos claros e logos, com ações organizadas em menu.
- Faturas dos cartões exibem o fluxo diário de gastos do ciclo; parcelas e ajustes de outras datas compõem o valor inicial, preservando o total da fatura sem atribuir uma data fictícia à compra.
- A página da fatura permite alternar entre o fluxo diário e o histórico das últimas 12 faturas, com navegação pelo mês selecionado.

### Alterado

- Cards de metas reservam espaço para o ritmo e usam o mesmo estilo de ações dos rodapés de contas e cartões.
- Condições de pagamento na visão geral reutilizam os ícones da tabela de lançamentos.
- Data da saudação da Visão Geral mantém o espaçamento tipográfico padrão em telas maiores.
- Cabeçalhos dos extratos de contas e faturas de cartões oferecem edição discreta ao lado do nome.

## [0.7.0] - 2026-09-27

Permite ignorar e restaurar despesas compartilhadas, detalha despesas sem orçamento e simplifica
a navegação e os filtros de lançamentos.

### Alterado

- Antecipação de parcelas informa quando a fatura de destino já está paga e orienta escolher
  uma fatura em aberto.

- Navegação do header com item ativo em cápsula, dimensões compactas e divisória sutil.

- Seleção nos filtros de pessoas, categorias e contas/cartões funciona ao clicar em toda a opção,
  incluindo nome, avatar e logo.

- Ícones dos filtros de lançamentos padronizados com a tabela, com mapeamento compartilhado
  para condição e forma de pagamento.

- Filtros ativos exibem avatares de pessoas, logos de contas e cartões e ícones por tipo de filtro.

- Barra de filtros ativos dos lançamentos com fundo sutil, identificação e chips com maior
  contraste, tipo e valor hierarquizados e botão de remoção separado da etiqueta.
- Orçamentos distinguem consumo, sobras e excessos dos limites, com detalhamento das despesas
  sem orçamento por categoria e atalho para definir limites.

- Favicon com cantos levemente arredondados nas versões SVG, PNG e ICO.

- Atualizações automáticas de lançamentos, detalhes e anexos ficam silenciosas ao retornar à aba;
  as listas mantêm o indicador ao exibir resultados anteriores durante mudanças de filtros, período ou página.

### Adicionado

- Despesas compartilhadas permitem ignorar pendências, desfazer e restaurar pela lista de ignorados,
  preservando o lançamento de origem. Compras parceladas são ignoradas por inteiro; recorrências por ocorrência.

- Logo Nubank Chroma disponível no seletor de logos de contas e cartões.
- Despesas divididas exibem o ícone de divisão com tooltip na tabela de despesas compartilhadas.
- A tabela de despesas compartilhadas permite buscar lançamentos e ordená-los por data, valor ou estabelecimento.

## [0.6.0] - 2026-09-25

Amplia a experiência mobile e os relatórios financeiros, preserva o calendário e os pagamentos
das recorrências versionadas e melhora a apresentação dos lançamentos e do dashboard.

### Alterado

- Formatação de valores e contagem de lançamentos reutilizam os helpers compartilhados; formulários
  usam um único cálculo do último dia do mês e o total em aberto das contas a pagar é calculado no domain.

- O modo escuro remove a linha colorida acima do cabeçalho; avatares deixam de usar bordas e
  anéis, com seleção indicada por check e foco de teclado por contorno externo.

- A tabela desktop de lançamentos usa o ícone da categoria quando não há logo do estabelecimento.
- Despesas compartilhadas em Lançamentos externos são ordenadas pela data do lançamento,
  da mais recente à mais antiga, antes da paginação.

- O saldo previsto no celular destaca o valor sobre um fundo suave da marca, com comparação
  discreta e indicadores em uma base neutra.

- Os detalhes de lançamentos no celular destacam nome, valor e status em um resumo centralizado,
  com informações em linhas simples e menos bordas.

- A personalização do dashboard ocupa a largura do celular e adapta os controles dos indicadores
  para evitar cortes; o seletor mensal mantém o mesmo estilo das demais páginas.

- O cabeçalho mobile ganha controles com áreas de toque maiores e aparência mais discreta; a
  Visão Geral simplifica a saudação, reúne atalhos em uma linha e dá mais espaço aos valores.

- A Visão Geral usa também no celular a navegação mensal compartilhada com as demais páginas,
  com setas para trocar de mês e retorno ao mês atual.
- Valores monetários usam Aeonik Fono pelo componente compartilhado; a tabela de lançamentos
  alinha valores à direita.
- Rótulos de campos e legendas dos formulários usam GT America e tamanho consistente, inclusive
  em lançamentos.
- O resumo mensal de cada pessoa exibe todos os meios de pagamento, ordenados pela maior despesa.
- O relatório de despesas parceladas reúne saldo em aberto, parcelas pendentes do mês e compras em
  andamento em um resumo compacto; filtros e simulação acompanham a lista de compras.
- A lista de compras parceladas usa linhas compactas com saldo, próxima parcela e progresso, e
  distingue ausência de dados de filtros sem resultados.
- A experiência mobile ganhou navegação inferior, uma Visão Geral com hierarquia própria e uma
  listagem de lançamentos agrupada por data. A saudação da Visão Geral ocupa a largura da tela;
  em Lançamentos, o cabeçalho segue o padrão das demais páginas e as ações da lista ficam juntas,
  preservando o dashboard e a tabela no desktop.
- O menu mobile reúne calculadora, visibilidade dos valores e tema em três cards compactos.
- A navegação mensal centraliza o mês no celular e usa um ícone para retornar ao mês atual.
- Cards de despesas parceladas no celular dão espaço ao nome, situação e próxima parcela sem
  comprimir a ação de detalhes. O filtro de cartões ocupa toda a largura apenas no celular e
  identifica cada opção pelo logo tanto no celular quanto no desktop.
- A lista mobile de lançamentos mostra os logos de estabelecimentos e contas antes de recorrer ao
  ícone da categoria; os detalhes ocupam a largura da tela no celular e exibem ações lado a lado
  em toda a largura do rodapé.
- Recorrências versionadas preservam o dia original do calendário, mantêm pagamentos associados à
  série e reconciliam todos os períodos externos afetados por alterações retroativas.
- Boletos recorrentes atribuídos a uma Pessoa recém-conectada passam a ser entregues enquanto ainda
  não estiverem vencidos, mesmo quando a conexão acontece depois do primeiro dia do mês.
- Os atalhos dos indicadores calculados para a Pessoa administradora preservam o filtro "Você" ao
  abrir a lista de lançamentos.

### Adicionado

- A Visão Geral mobile reúne alertas, contas e cartões, lançamentos recentes e um resumo mensal.
- Gráfico da janela de 12 meses até o mês seguinte com a soma das parcelas registradas e a
  quantidade de compras com parcelas em cada mês, com dados acessíveis a leitores de tela.
- A tabela de lançamentos permite selecionar linhas para conferir entradas, despesas e saldo;
  transferências, ajustes de saldo e pagamentos de fatura ficam com seleção desabilitada.
- `@shadcn/lint` via Oxlint no frontend, integrado a `pnpm lint` e `pnpm check`, com configuração
  preparada para ativação explícita de regras visuais.

## [0.5.0] - 2026-09-19

Amplia a criação e consulta de lançamentos, melhora a confirmação de ajustes e pagamentos e
refina a navegação e a apresentação das informações financeiras na interface web.

### Alterado

- A interface web adota GT America para textos e títulos, preservando Aeonik Fono para conteúdo
  numérico e monoespaçado.
- Tabelas destacam a linha em foco com um trilho discreto na cor da marca.
- A listagem de lançamentos permite ordenar ao lado da busca e filtrar pagamentos pela fatura,
  mantendo a apresentação anterior da tabela.
- A caixa de lançamentos externos prioriza o nome do estabelecimento sobre a data e remove a
  coluna redundante de tipo da transação; a origem omite o prefixo "Fatura" e alinha o tamanho do
  logo ao avatar da pessoa.
- Textos e ícones das páginas web explicam melhor recebimentos, pagamentos, recorrências,
  compartilhamento, limites e exclusões, com orientação para o primeiro uso e estados vazios.
- Formulários apresentam erros visíveis e permitem cadastrar opções relacionadas sem abandonar
  o lançamento, com a ação de criar no final dos seletores; a importação exige a escolha explícita
  da conta ou cartão de destino.
- O painel de filtros de lançamentos oferece mais espaço para a grade e exibe integralmente as
  opções dos seletores, com cabeçalho, conteúdo rolável e ações visualmente separados.
- O formulário de lançamentos alinha parcelamento ou frequência à condição selecionada, identifica
  a opção única com um ícone de confirmação e amplia o menu de parcelas para exibir valores inteiros.
- O seletor de tipo de anotação usa cards mais compactos, com ícones discretos junto aos títulos.
- O cabeçalho web está mais compacto, usa fundo translúcido com blur e adapta à identidade do sistema
  o sublinhado animado e a transição de painéis da Hiro, reservando a cor primária para a URL ativa e
  mantendo menus compactos, descrições em uma linha e previews de cartões, contas e pessoas.
- A navegação mensal e seus seletores usam o mesmo tratamento translúcido com blur do cabeçalho.
- Títulos clicáveis nos widgets do dashboard revelam a seta com deslocamento suave no hover ou foco;
  os atalhos de receitas e despesas acompanham o mesmo movimento.
- As ações rápidas do dashboard distinguem cada operação com feedback semântico e microanimações.
- O dashboard ganhou um fundo atmosférico sutil com as cores da marca e adaptação ao tema escuro.
- O painel mantém contas, faturas e boletos na ordem inicial, preservando ordens personalizadas;
  os widgets de faturas e boletos usam a mesma apresentação de valores e registro de pagamento.
- As páginas possuem títulos próprios nas abas do navegador.

### Adicionado

- Prévia do ajuste de saldo calculada pela API, sem alterar dados antes da confirmação.
- Busca na biblioteca de anexos e nas categorias, busca de compras parceladas e acesso direto
  ao cadastro de recorrências, com filtros de cartão e situação nos parcelamentos.
- Lançamentos compartilhados exibem o logo de estabelecimento escolhido na conta de origem e o
  adotam na conta de destino após a importação, sem substituir uma escolha já existente.

### Corrigido

- Dependências de validação, OpenAPI e autenticação usam versões compatíveis; cálculos de vencimento
  recorrente e fim de período compartilham uma única regra no domínio.
- Contas de autenticação aceitam o campo legado de emissor vazio, mantendo o schema compatível
  com os inserts do Better Auth.
- Botões de ação no tema escuro não exibem sombra externa.
- Participações de uma mesma compra permanecem juntas na paginação e são contadas como um
  lançamento.
- Páginas de detalhes distinguem falhas temporárias de registros inexistentes e oferecem nova
  tentativa; despesas compartilhadas preservam o contexto quando ainda não há conexão.
- A confirmação de reabertura de fatura explica os registros removidos e usa uma ação curta,
  sem vazamento do texto dos botões.
- A evolução por categoria distribui melhor os valores, resume estados longos e adapta os períodos
  sem depender de rolagem horizontal; o botão de continuar editando comporta o texto no modal de
  descarte.
- Exclusão de categorias em uso retorna uma orientação específica, evitando falha genérica ou
  remoção de vínculos financeiros.

## [0.4.0] - 2026-09-12

Adiciona tarefas com vencimento e alertas, amplia as ações da caixa de entrada e corrige os ajustes
de fatura e saldo, com melhorias de apresentação e consulta das informações financeiras.

### Alterado

- Botões de ação primária mantêm a cor da marca com gradiente, brilho e relevo sutis.
- O seletor de tipo de anotação apresenta opções mais legíveis, responsivas e acessíveis por
  teclado.
- Itens de listas e tarefas concluídos usam a cor semântica de sucesso no checkbox.

### Adicionado

- A configuração de tipografia web permite alternar entre fontes locais e Google Fonts.
- A caixa de entrada permite excluir, mediante confirmação, todo o histórico das abas processada e
  descartada sem remover os lançamentos confirmados.
- Faturas discriminam os valores por pessoa em um hover card, e o relatório de parcelamentos
  sinaliza anotações ao lado do nome do lançamento.
- Anotações agora aceitam tarefas com data, conclusão e alerta de vencimento na Central de atenção.

### Corrigido

- O atalho da calculadora permanece centralizado nos campos monetários durante o clique.
- O changelog exibe integralmente itens que ocupam mais de uma linha no arquivo de origem.
- Formulários longos de anotações mantêm o cabeçalho e as ações fixos enquanto o conteúdo rola.
- PDFs anexados podem ser visualizados dentro do modal sem ampliar a política de frames para origens
  não configuradas.
- Reduções de fatura deixam de ser contabilizadas como receitas e passam a reduzir despesas de
  forma consistente no dashboard, categorias, tendências, pessoas e acertos; itens longos de
  listas quebram linha durante a edição e a visualização de anotações.
- Ajustes de fatura usam uma categoria de despesa própria e pertencem integralmente a uma pessoa.
  Faturas com pagamentos precisam ser reabertas antes de ajustar ou remover o ajuste; a reabertura
  desfaz todos os pagamentos e devolve cada movimentação à conta de origem.
- Ajustes de saldo consideram somente os lançamentos existentes até a data escolhida, não aceitam
  datas futuras e alteram o saldo sem inflar as métricas de entradas e saídas do extrato.
- Itens concluídos de listas de anotações aparecem depois dos itens pendentes.
- Reduções de despesas não tornam negativo o total de gastos sem orçamento.

## [0.3.2] - 2026-09-07

Corrige a contabilização de boletos divididos e mantém compatibilidade temporal com versões antigas
do Companion, além de equilibrar a densidade dos widgets financeiros.

### Alterado

- Os widgets de boletos, tendências, faturas e recorrências exibem até cinco itens, enquanto o de
  contas exibe até quatro cards.

### Corrigido

- Boletos pagos, inclusive recorrentes e divididos, mantêm saldos e previsões limitados à
  participação da pessoa administradora.
- Notificações do Companion até a versão `1.5.2` preservam a interpretação do horário local de
  Brasília, enquanto clientes corrigidos podem declarar timestamps UTC com o formato versão 2.

## [0.3.1] - 2026-09-07

Restaura a compatibilidade do migrator com bancos existentes sem alterar o fluxo de instalações
novas.

### Corrigido

- O migrator preserva a baseline publicada e atualiza bancos legados sem tentar recriar tipos e
  tabelas existentes.

## [0.3.0] - 2026-09-07

Amplia a análise por pessoa e torna ações recorrentes e informações contextuais mais claras em
toda a interface financeira.

### Adicionado

- Itens pendentes da caixa de entrada exibem as regras aplicadas ao lado da identificação da conta ou cartão.
- Seletor “Você / Todas as pessoas” no histórico da categoria, com resumo e lançamentos
  sincronizados pela URL e visão pessoal mantida como padrão nos widgets.
- Filtro individual por pessoa com avatar no header da categoria, incluindo a opção “Você”.

### Alterado

- A tela de pessoas prioriza a pessoa administradora, mantém a conexão dentro da aba Painel e
  exibe todos os totais mensais por forma de pagamento com espaçamento revisado.
- Logos de estabelecimentos agora podem ser alterados também em widgets, relatórios e diálogos.

### Corrigido

- A central de atenção exibe os logos dos estabelecimentos em boletos e dos cartões em faturas.
- Pagar uma fatura não registra mais repasses automáticos de outras pessoas; os acertos são
  registrados manualmente, de forma independente do pagamento da fatura.
- Ações para pausar ou encerrar recorrências na tabela de lançamentos agora exigem confirmação.
- Contas fora do saldo consolidado usam uma indicação discreta que não altera a altura dos cards.
- O seletor de ícones de categoria não exibe mais uma borda extra ao redor do ícone atual.

## [0.2.0] - 2026-09-06

Simplifica a configuração do banco de dados para desenvolvimento e Docker Compose, com uma única
fonte de credenciais e documentação direta para cada variável de ambiente.

### Adicionado

- Manual das variáveis de ambiente para desenvolvimento local e implantação com Docker Compose.

### Alterado

- O Docker Compose usa diretamente as imagens oficiais do OpenMonetis e compartilha as mesmas
  credenciais PostgreSQL entre processos locais e containers, com uma única URL opcional para banco
  externo.

### Corrigido

- O worker de recorrências não herda mais o healthcheck HTTP exclusivo do servidor da API.

## [0.1.0] - 2026-09-05

Primeira versão pública do OpenMonetis V2: um gerenciador de finanças pessoais self-hosted,
API-first, com cliente web em PT-BR, domínio financeiro isolado e implantação por Docker Compose.

### Adicionado

- Dashboard mensal configurável com receitas, despesas, balanço, evolução do período, contas,
  faturas, boletos, recorrências, status de pagamento e acertos por pessoa.
- Gestão de contas com saldos, extratos, transferências, ajustes e rendimentos.
- Gestão de cartões e faturas com limites, fechamento, vencimento, pagamentos, ajustes e estornos.
- Receitas, despesas e transferências com categorias, estabelecimentos, observações, anexos e
  importação por planilha.
- Compras parceladas, antecipação de parcelas e recorrências semanais, mensais, bimestrais,
  trimestrais, semestrais e anuais.
- Orçamentos, contas a pagar, agenda de vencimentos e central de atenção.
- Pessoas ativas e inativas, divisão de lançamentos, créditos, reembolsos e acertos parciais, com
  saldos, pagamentos e previsões calculados conforme a participação financeira de cada pessoa.
- Conexões entre contas para envio e importação independente de lançamentos compartilhados,
  incluindo parcelas e ocorrências recorrentes.
- Caixa de entrada para notificações capturadas pelo Companion Android, com tokens revogáveis e
  regras configuráveis de sugestão de categoria e pessoa.
- Notas de texto e checklists, além de preferências persistidas de aparência, privacidade,
  dashboard e criação de lançamentos.
- Autenticação por e-mail e senha, Google opcional e passkeys, com confirmação de senha no cadastro
  e encerramento das demais sessões após sua alteração.
- API Hono documentada com OpenAPI e validação Zod, organizada em routes, services, domínio puro e
  repositories com persistência PostgreSQL via Drizzle.
- Cliente web construído com TanStack Start, Router, Query e Form, com interface responsiva e
  acessível em PT-BR.
- Identidade visual em SVG, com favicons e ícones PWA dedicados para exibição comum e maskable.
- Imagens Docker separadas para web, API e migrator, worker de recorrências compartilhadas, scripts
  de instalação para Unix e Windows e documentação de implantação em produção.
- Changelog integrado à aplicação, aviso de versão e consulta de atualizações com fallback local.
- Suíte automatizada para domínio, services, contratos HTTP, segurança e apresentação web,
  executada na integração contínua.

### Segurança

- Isolamento obrigatório dos dados financeiros por usuário, com ownership validado nos casos de
  uso e reforçado por chaves compostas no banco.
- Validação de entradas externas, autenticação dos endpoints privados, rate limiting de login,
  cadastro e mutations, CORS explícito e respostas privadas sem cache.
- Proxy web same-origin com headers de defesa em profundidade e política de conteúdo restritiva.
- Tokens do Companion armazenados como digest, segredos independentes por finalidade e anexos em
  storage privado compatível com S3.
- Troca de senha protegida pela senha atual, invalidação das demais sessões e fluxo específico para
  contas autenticadas exclusivamente pelo Google.
- Backup e restauração definidos como operações de infraestrutura, cobrindo PostgreSQL, objetos do
  storage e segredos da implantação.

[Unreleased]: https://github.com/felipegcoutinho/openmonetis-v2/compare/v0.12.0...HEAD
[0.12.0]: https://github.com/felipegcoutinho/openmonetis-v2/compare/v0.11.1...v0.12.0
[0.11.1]: https://github.com/felipegcoutinho/openmonetis-v2/compare/v0.11.0...v0.11.1
[0.11.0]: https://github.com/felipegcoutinho/openmonetis-v2/compare/v0.10.2...v0.11.0
[0.10.2]: https://github.com/felipegcoutinho/openmonetis-v2/compare/v0.10.1...v0.10.2
[0.10.1]: https://github.com/felipegcoutinho/openmonetis-v2/compare/v0.10.0...v0.10.1
[0.10.0]: https://github.com/felipegcoutinho/openmonetis-v2/compare/v0.9.0...v0.10.0
[0.9.0]: https://github.com/felipegcoutinho/openmonetis-v2/compare/v0.8.1...v0.9.0
[0.8.1]: https://github.com/felipegcoutinho/openmonetis-v2/compare/v0.8.0...v0.8.1
[0.8.0]: https://github.com/felipegcoutinho/openmonetis-v2/compare/v0.7.0...v0.8.0
[0.7.0]: https://github.com/felipegcoutinho/openmonetis-v2/compare/v0.6.0...v0.7.0
[0.6.0]: https://github.com/felipegcoutinho/openmonetis-v2/compare/v0.5.0...v0.6.0
[0.5.0]: https://github.com/felipegcoutinho/openmonetis-v2/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/felipegcoutinho/openmonetis-v2/compare/v0.3.2...v0.4.0
[0.3.2]: https://github.com/felipegcoutinho/openmonetis-v2/compare/v0.3.1...v0.3.2
[0.3.1]: https://github.com/felipegcoutinho/openmonetis-v2/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/felipegcoutinho/openmonetis-v2/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/felipegcoutinho/openmonetis-v2/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/felipegcoutinho/openmonetis-v2/releases/tag/v0.1.0
