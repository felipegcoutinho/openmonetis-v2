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

`GET /transactions/installments/preview?amount=3` exige sessão e retorna opções de 2 a 60 parcelas,
com `count`, `minimumAmount` e `maximumAmount` por opção. O domínio distribui os centavos; a web
consulta a prévia por TanStack Query e apenas formata os valores. A prévia não persiste dados.

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
- O frontend não recebe `userId`, hashes, digests, segredos da instalação, stack traces ou detalhes internos. Tokens do Companion e de convites entre pessoas são entregues somente na criação autorizada pela sessão web e descartados da interface ao encerrar o fluxo; o valor original não pode ser recuperado depois.
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
| Execução | um processo principal | imagens web, API e migrator, mais a imagem opcional `ai`; worker diário reutiliza a imagem da API |
| Schema | migrations e uso histórico de push | migrations versionadas e forward-only |

O repositório original continua sendo referência de produto e fluxo, nunca autoridade de modelagem.
Cada funcionalidade portada deve ser reavaliada antes de entrar na V2.

## Decisões atuais

- O cliente completo é web; mobile não faz parte do escopo.
- O Companion Android é externo ao monorepo e usa endpoints de compatibilidade.
- Não existe package SDK; o OpenAPI é a base para um cliente futuro.
- A suíte automatizada cobre regras de domínio, services, contratos HTTP, middlewares de segurança
  e apresentação do cliente. A CI executa `pnpm check`, `pnpm test`, `pnpm build` e as cinco suítes
  de integração com PostgreSQL descritas em [CONTRIBUTING.md](../CONTRIBUTING.md#testes-de-integração).
- Recorrências distinguem série, versões e estados por ocorrência; o prazo final é opcional e
  inclusivo. Veja [recorrências](recurring-transactions.md), [baixas efetivas](settlements.md) e
  [regras de vencimento](due-date-rules.md).
- Prévias financeiras também são calculadas pela API. O formulário consulta as opções de parcelas
  por TanStack Query e apenas formata os valores retornados pelo domínio.
- O assistente de IA (diagnóstico e chat) é opcional e roda em um serviço separado, `apps/ai`, que
  hospeda as CLIs oficiais de Claude Code, Codex e Antigravity com a assinatura de cada pessoa. Ele
  não acessa o banco, não recebe o id do usuário e só é alcançado pela API, com um segredo
  compartilhado. Pontuação, indicadores e gráficos continuam calculados no domain; o modelo só
  escreve o texto e escolhe itens de listas fechadas, e a API valida a resposta com Zod. Veja
  [assistente de IA](ai-diagnoses.md).

```text
apps/web -> API (/ai-diagnoses, /ai-chats, /ai-providers, /ai-data-sharing, /ai-tools)
              ├─> domain (saúde financeira, permissões, estilos)
              ├─> repositories -> PostgreSQL (consentimento, histórico, eventos)
              └─> apps/ai (rede interna) -> CLIs oficiais, uma pasta de login por pessoa
```
