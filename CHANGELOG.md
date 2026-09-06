# Changelog

Todas as mudanças notáveis do OpenMonetis serão documentadas neste arquivo.

O formato segue o [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e o projeto usa
[Versionamento Semântico](https://semver.org/lang/pt-BR/).

## [Unreleased]

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

[Unreleased]: https://github.com/felipegcoutinho/openmonetis-v2/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/felipegcoutinho/openmonetis-v2/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/felipegcoutinho/openmonetis-v2/releases/tag/v0.1.0
