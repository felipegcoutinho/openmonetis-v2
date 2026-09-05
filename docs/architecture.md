# Arquitetura do OpenMonetis V2

## Objetivo

O OpenMonetis V2 separa interface, casos de uso, regras financeiras e persistência. A API é a única
fonte de verdade; clientes renderizam contratos HTTP e não acessam o banco diretamente.

As regras obrigatórias de implementação estão em [`../AGENTS.md`](../AGENTS.md). Este documento
explica as decisões de alto nível e o caminho dos dados.

## Direção das dependências

```text
apps/web
  -> API client / TanStack Query
  -> proxy same-origin
  -> Hono routes
  -> services
       ├─> packages/domain
       └─> repositories -> packages/db -> PostgreSQL
```

- **Web:** renderiza estado, mantém cache assíncrono e envia comandos validados.
- **Routes:** definem HTTP/OpenAPI, exigem autenticação e traduzem respostas.
- **Services:** implementam casos de uso, coordenam repositories e produzem DTOs públicos.
- **Domain:** contém regras financeiras puras, determinísticas e sem I/O.
- **Repositories:** executam consultas Drizzle e aplicam isolamento obrigatório por `userId`.
- **Database:** mantém schema e migrations versionadas.

O domain não importa Hono, React, Drizzle, Zod, ambiente ou rede. Repositories não produzem DTOs
públicos e routes não consultam Drizzle diretamente.

## Fluxo HTTP

O navegador usa uma única origem pública:

```text
/api/*       -> mantém o path; Better Auth e compatibilidade do Companion
/api-proxy/* -> remove o prefixo; endpoints financeiros
```

No desenvolvimento, o proxy encaminha para `http://localhost:7001`. No Compose, `API_INTERNAL_URL`
aponta para `http://api:7001` dentro da rede privada.

Entradas externas são validadas por schemas Zod antes do service. Endpoints financeiros retornam o
envelope `{ data, error }`; erros públicos usam `{ error: true, message, code? }`.

## Organização por feature

Uma feature mantém o mesmo termo de domínio em todas as camadas aplicáveis:

```text
apps/api/src/routes/<feature>.ts
apps/api/src/services/<feature>.service.ts
apps/api/src/repositories/<feature>.repository.ts
packages/domain/src/<feature>.ts
packages/validators/src/<feature>.ts

apps/web/src/features/<feature>/<feature>.api.ts
apps/web/src/features/<feature>/<feature>.queries.ts
apps/web/src/features/<feature>/<feature>.mutations.ts
apps/web/src/features/<feature>/<feature>.presentation.ts
apps/web/src/features/<feature>/components/
```

O shape indica onde cada responsabilidade deve ficar quando existir. Arquivos vazios não devem ser
criados apenas para completar a estrutura. Uma ausência recorrente deve provocar a revisão do
recorte da feature ou do padrão global, em vez de gerar um padrão local implícito.

## Isolamento e segurança

- Todo endpoint financeiro exige sessão autenticada.
- Toda leitura, atualização e remoção filtra pelo usuário autenticado.
- IDs relacionados são validados por ownership antes de qualquer mutation.
- Produção exige segredos independentes, CORS explícito e HTTPS na origem web.
- O frontend não recebe `userId`, hashes, tokens, stack traces ou detalhes internos.
- Migrations são forward-only e precisam ser revisadas antes da publicação.

## Da V1 para a V2

A V1 cresceu como uma aplicação Next.js full-stack. App Router, Server Components, Server Actions,
rotas HTTP, consultas Drizzle e componentes React conviviam no mesmo projeto. Essa organização
permitiu evoluir rapidamente, mas tornou mais fácil atravessar as fronteiras entre UI, regra
financeira e persistência.

No ambiente usado pelo mantenedor, App Router e Turbopack também passaram a apresentar um custo de
memória e recompilação maior do que o desejado. A V2 adotou processos separados e limites mais
explícitos.

| Aspecto | V1 | V2 |
| --- | --- | --- |
| Organização | aplicação Next.js única | monorepo com web, API e packages |
| Web | Next.js App Router e Turbopack | TanStack Start, Router, Query e Form |
| Backend | Server Actions e rotas Next.js | API Hono com Zod/OpenAPI |
| Casos de uso | actions e queries por feature | services independentes de HTTP |
| Regras financeiras | próximas das features | package domain puro |
| Banco | Drizzle dentro da aplicação | repositories exclusivos da API |
| Contratos | principalmente internos ao web | HTTP documentado por OpenAPI |
| Execução | um processo principal | imagens web, API e migrator |
| Schema | migrations e uso histórico de push | migrations versionadas e forward-only |

O repositório original continua sendo referência de produto e fluxo, nunca autoridade de modelagem.
Cada funcionalidade portada deve ser reavaliada antes de entrar na V2.

## Decisões atuais

- O cliente completo é web; mobile não faz parte do escopo.
- O Companion Android é externo ao monorepo e usa endpoints de compatibilidade.
- Não existe package SDK; o OpenAPI é a base para um cliente futuro.
- A suíte automatizada cobre regras de domínio, services, contratos HTTP, middlewares de segurança
  e apresentação do cliente. Os gates de CI são `pnpm check`, `pnpm test` e `pnpm build`.
