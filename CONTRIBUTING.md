# Contribuindo com o OpenMonetis

O OpenMonetis é um projeto pessoal guiado pelo uso real do mantenedor. Sugestões e contribuições são
bem-vindas, mas não formam um roadmap e podem não se encaixar na direção do repositório principal.

## Antes de implementar

- Explique o problema concreto e o fluxo desejado.
- Verifique se a proposta preserva o modelo API-first.
- Não copie automaticamente a modelagem do OpenMonetis V1; ele é somente referência de produto.
- Para mudanças amplas, alinhe o recorte antes de investir em toda a implementação.

As regras obrigatórias estão em [`AGENTS.md`](AGENTS.md) e a visão arquitetural em
[`docs/architecture.md`](docs/architecture.md).

## Ambiente local

Use Node.js 22.12 ou superior, preferencialmente uma versão LTS, e Docker com o plugin Compose.

```bash
corepack enable
corepack prepare pnpm@11.25.0 --activate
pnpm install --frozen-lockfile
cp .env.example .env
pnpm docker:db
pnpm db:migrate
pnpm dev
```

`pnpm dev` também sobe o serviço de IA na porta `7003`. Para usar o assistente localmente, instale
as CLIs `claude`, `codex` ou `agy`, defina `AI_ENABLED=true` no `.env` e veja o
[guia do assistente de IA](docs/ai-diagnoses.md#desenvolvimento-local).

## Regras de implementação

- UI não acessa banco nem implementa regra financeira.
- Routes são finas e validam entradas.
- Services implementam um caso de uso por função.
- Regras financeiras ficam no domain puro.
- Repositories filtram toda operação por `userId`.
- Código, banco e contratos usam inglês; a interface usa PT-BR.
- Mudanças de schema sempre incluem migration revisada.
- Migrations publicadas são imutáveis: preserve arquivos, hashes e timestamps existentes e adicione
  uma nova migration incremental para cada alteração.
- Novas features mantêm o mesmo nome e seguem o shape padronizado nas camadas aplicáveis, sem criar
  arquivos vazios apenas para completar a estrutura.

## Concluir uma mudança

Revise e registre uma mudança por vez. Inclua implementação, testes e documentação em commits
coesos, preservando alterações independentes para seus próprios commits. Registre mudanças
notáveis e notas de atualização em `Unreleased`, sem alterar a versão dos pacotes ou o badge do
README. É possível acumular esses commits localmente antes de preparar e publicar uma versão.

## Antes de enviar

```bash
pnpm check
pnpm test
pnpm build
pnpm release:check
```

A suíte automatizada cobre domínio, services, contratos HTTP, segurança e apresentação web.
Descreva no pull request também os cenários manuais executados e os riscos não cobertos.
O comando `pnpm test` descobre automaticamente arquivos `*.test.ts` e `*.test.tsx` em `src` dos
workspaces, excluindo `*.integration.test.*`. Novos testes nessas pastas não precisam ser
adicionados manualmente ao `package.json`. Consulte [o guia de testes](docs/testing.md) para os
limites atuais e as próximas prioridades.

### Testes de integração

`pnpm test` executa a suíte sem banco; as integrações PostgreSQL são comandos separados. Execute as
suítes relacionadas à mudança, além dos comandos acima. A CI executa todas as quatorze integrações.

| Mudança | Comando | Cobertura principal |
| --- | --- | --- |
| Autenticação | `pnpm test:auth:integration` | Cadastro aberto/fechado e login existente por senha e Google, com callback OAuth simulado. |
| Categorias | `pnpm test:categories:integration` | Hierarquia, unicidade, ownership e integridade dos vínculos financeiros. |
| Etiquetas | `pnpm test:tags:integration` | Persistência, ownership e vínculos de lançamentos e escopos de recorrência. |
| Recorrências | `pnpm test:recurring:integration` | Ações datadas, histórico, prazo final, projeções e relatórios. |
| Baixas e vencimentos | `pnpm test:settlements:integration` | Valores efetivos, rateios, extratos, desfazimentos, regras de vencimento e snapshots. |
| Transações e segurança HTTP | `pnpm test:transactions:integration` | API montada com sessões reais, bloqueio de acesso anônimo, isolamento entre usuários, transferências, estornos e concorrência. |
| Integridade financeira | `pnpm test:financial-integrity:integration` | Baixas e rateios, lotes atômicos, parcelas, recorrências, exportações e permissões de faturas e orçamentos. |
| Distribuição financeira | `pnpm test:financial-distribution:integration` | Recortes por pessoa, rateios, baixas, previsões, contas fora do saldo e isolamento entre usuários. |

As suítes adicionais de conexões, importação, ajustes, ownership, migrations e storage estão
listadas em [docs/testing.md](docs/testing.md). Para executar todas, use `pnpm test:integration`
com PostgreSQL e S3Mock disponíveis. `pnpm test:coverage` gera o relatório e verifica os limites
mínimos de domínio/services; `pnpm test:e2e` inicia a aplicação isolada para os testes Chromium.
Essa suíte inclui passkeys com autenticador virtual e verificação WebAuthn real. Os comandos
optativos de storage real usam `pnpm test:storage:live`; consulte o guia para credenciais e limpeza.

Cada suíte cria um banco exclusivo, aplica as migrations e o remove ao terminar. Use um PostgreSQL
de desenvolvimento ou teste, com uma credencial que possa criar e remover bancos. Não execute com
`NODE_ENV=production` nem aponte esses comandos para infraestrutura de produção.

Com `pnpm docker:db`, os testes usam a configuração local do `.env`. Para escolher outro servidor de
teste, configure `TEST_DATABASE_URL`; essa variável tem precedência sobre a conexão local em todas
as suítes. Na CI, ela aponta para o PostgreSQL temporário do job.

O fechamento de uma versão parte dessas mudanças já commitadas e segue o fluxo documentado em
[`docs/releases.md`](docs/releases.md), com nova validação do conjunto, consolidação do changelog
e atualização sincronizada dos metadados em um commit de preparação da release. Preparar os
metadados não autoriza criar ou enviar tags.

Um pull request deve informar:

- problema resolvido;
- decisão de domínio adotada;
- alterações de contrato ou migration;
- passos de validação;
- capturas de tela quando houver mudança visual;
- impactos de segurança, compatibilidade ou deploy.

Se houver migration, mudança de contrato, variável de ambiente ou alteração no Compose, inclua
`### Notas de atualização` em `CHANGELOG.md` com as ações necessárias para o operador. Revise banco,
API, ambiente e Compose conforme o modelo em [`docs/releases.md`](docs/releases.md#notas-de-atualização).

## Licença das contribuições

Ao enviar uma contribuição, você declara que possui autorização para disponibilizá-la e concorda
que ela seja licenciada sob os mesmos termos da [Sustainable Use License 1.0](LICENSE) aplicada ao
OpenMonetis.
