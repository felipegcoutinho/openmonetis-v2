# Changelog

Todas as mudanças notáveis do OpenMonetis serão documentadas neste arquivo.

O formato segue o [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e o projeto usa
[Versionamento Semântico](https://semver.org/lang/pt-BR/).

## [Unreleased]

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

[Unreleased]: https://github.com/felipegcoutinho/openmonetis-v2/compare/v0.5.0...HEAD
[0.5.0]: https://github.com/felipegcoutinho/openmonetis-v2/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/felipegcoutinho/openmonetis-v2/compare/v0.3.2...v0.4.0
[0.3.2]: https://github.com/felipegcoutinho/openmonetis-v2/compare/v0.3.1...v0.3.2
[0.3.1]: https://github.com/felipegcoutinho/openmonetis-v2/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/felipegcoutinho/openmonetis-v2/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/felipegcoutinho/openmonetis-v2/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/felipegcoutinho/openmonetis-v2/releases/tag/v0.1.0
