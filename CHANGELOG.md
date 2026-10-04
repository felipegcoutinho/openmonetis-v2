# Changelog

Todas as mudanças notáveis do OpenMonetis serão documentadas neste arquivo.

O formato segue o [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e o projeto usa
[Versionamento Semântico](https://semver.org/lang/pt-BR/).

## [Unreleased]

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

[Unreleased]: https://github.com/felipegcoutinho/openmonetis-v2/compare/v0.10.2...HEAD
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
