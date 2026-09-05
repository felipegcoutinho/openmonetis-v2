# AGENTS.md — OpenMonetis (OpenMonetis V2)

Sistema financeiro API-first, baseado no OpenMonetis (`github.com/felipegcoutinho/openmonetis`). Neste momento só o cliente **web** é implementado; mobile não faz parte do escopo atual.

O repo original é apenas referência de fluxo/produto, nunca autoridade de modelagem. Toda entidade/feature portada deve ser criticamente redesenhada (dados, contratos, nomes, UX) antes de existir no OpenMonetis.

---

## 1. Princípio Central

A API é a única fonte de verdade para dados financeiros e persistentes. Clientes renderizam esse
estado e podem manter apenas estado efêmero de interface. A arquitetura segue **Clean Architecture
leve**: dependências de negócio apontam para dentro, em direção ao domain.

## 2. Stack

**Backend:** Hono, Drizzle, PostgreSQL, Zod, OpenAPI
**Web:** TanStack Start / Router / Query
**Infra:** pnpm workspaces, Docker Compose, Biome

## 3. Direção de Dependência

```
web routes/components
  -> feature *.api/*.queries/*.mutations/*.presentation
  -> Hono routes
  -> services (use cases)
       |-> domain
       `-> repositories -> Drizzle -> PostgreSQL
```

- UI nunca importa `@OpenMonetis/db`, tabelas ou client de banco, nem implementa regra financeira.
- Rotas nunca importam Drizzle. Services nunca leem `Request`/`Context`/headers/cookies.
- Repositories nunca retornam o formato de resposta pública (DTO é do service).
- Domain nunca importa Hono, React, Drizzle, Zod, env ou rede — é puro e testável isolado.

## 4. Estrutura e Padronização de Pastas

Padronização é obrigatória e verificada por inspeção — nenhuma feature nova pode inventar um shape próprio.

```
OpenMonetis/
├─ apps/
│  ├─ api          # Hono backend core
│  ├─ web          # TanStack Start
├─ packages/
│  ├─ db           # Drizzle schema + client
│  ├─ domain       # regras de negócio puras
│  ├─ validators   # Zod schemas
│  └─ shared       # utils, enums, constantes
├─ compose.yml
├─ pnpm-workspace.yaml
└─ package.json
```

**Shape esperado por feature** (usar o mesmo nome de `<feature>` em todas as camadas aplicáveis):

```
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

**Convenções de nomenclatura de arquivos/pastas:**

| Item               | Padrão                              | Exemplo                                |
| ------------------ | ----------------------------------- | -------------------------------------- |
| Pastas             | kebab-case                          | `financial-accounts/`                  |
| Arquivo de rota    | `<feature>.ts`                      | `accounts.ts`                          |
| Service            | `<feature>.service.ts`              | `accounts.service.ts`                  |
| Repository         | `<feature>.repository.ts`           | `accounts.repository.ts`               |
| Domain             | `<feature>.ts` (sem sufixo)         | `accounts.ts`                          |
| Validator (Zod)    | `<feature>.ts`                      | `accounts.ts`                          |
| API client (web)   | `<feature>.api.ts`                  | `accounts.api.ts`                      |
| Query (web)        | `<feature>.queries.ts`              | `accounts.queries.ts`                  |
| Mutation (web)     | `<feature>.mutations.ts`            | `accounts.mutations.ts`                |
| Apresentação (web) | `<feature>.presentation.ts`         | `accounts.presentation.ts`             |
| Componente React   | kebab-case                          | `account-card.tsx`                     |
| Hook               | `use<Nome>.ts`                      | `useAccounts.ts`                       |
| Variáveis/funções  | camelCase                           | `createAccount`                        |
| Tipos/Schemas      | PascalCase                          | `CreateAccountInput`                   |
| Tabelas/colunas DB | snake_case                          | `financial_accounts`, `user_id`        |
| Enums de domínio   | camelCase de valor, tipo PascalCase | `type AccountType`, valor `"checking"` |

Regras adicionais de padronização:

- Um arquivo = uma responsabilidade exportada como principal (evitar arquivos "kitchen sink" com múltiplas entidades não relacionadas).
- Sem barrel files (`index.ts` re-exportando tudo) dentro de `features/<feature>/` — import direto do arquivo específico, para manter rastreável de onde cada função vem.
- Toda feature nova segue o shape da seção 4 nas camadas que realmente utiliza. Não criar arquivo
  vazio apenas para completar a estrutura; uma ausência recorrente pode indicar que a feature está
  mal recortada ou que o padrão precisa ser revisto globalmente.
- Nomes de arquivo, pasta, tabela e rota usam sempre o mesmo termo de domínio em inglês (ex.: `people` em toda parte — nunca `person` numa pasta e `people` noutra).

## 5. Responsabilidades por Camada

| Camada           | Faz                                                                                   | Não faz                                     |
| ---------------- | ------------------------------------------------------------------------------------- | ------------------------------------------- |
| **Web UI**       | Renderiza telas, chama `*.api.ts`, usa TanStack Query, formata em `*.presentation.ts` | Cálculo financeiro, ownership, persistência |
| **API Routes**   | Método/path/OpenAPI, valida com Zod, exige auth, repassa `userId` ao service          | Query de banco, regra de negócio            |
| **Services**     | Orquestra use case, chama domain, coordena repositories, retorna DTO                  | Formatar HTTP, SQL/Drizzle direto, UI       |
| **Domain**       | Regra financeira pura (saldo, faturas, parcelas, orçamento, transferências)           | Qualquer I/O                                |
| **Repositories** | Query Drizzle, filtro obrigatório `userId`                                            | Expor tokens/hashes/detalhes internos       |

## 6. SOLID / Clean Code Aplicado

- **SRP:** cada função de service = um único caso de uso; cada camada muda por um único motivo.
- **OCP:** regra nova (ex.: frequência de recorrência) é um caso novo no domain, nunca reescrita da lógica existente.
- **LSP:** qualquer repository deve ser substituível sem quebrar o service que o consome.
- **ISP:** schemas específicos por operação (`CreateAccountInput` ≠ `UpdateAccountInput`), nunca um tipo genérico forçado.
- **DIP:** service depende da assinatura do repository, nunca do client Drizzle direto; domain não depende de nada externo.
- Nomes revelam intenção; função = um nível de abstração; sem números/strings mágicas (usar enums em `packages/shared` ou `domain`); zero duplicação de regra entre service e domain; erros tipados e traduzidos explicitamente entre camadas.

## 7. Segurança (não negociável)

- Todo endpoint financeiro exige sessão autenticada; toda query/update/delete filtra por `userId`; mutations validam ownership de todo ID relacionado.
- Nunca expor `userId`, tokens, hashes, stack traces ou paths internos em resposta pública.
- Todo input externo validado com Zod antes do service; Drizzle sempre parametrizado (SQL raw só com justificativa, nunca com input concatenado).
- CORS com credenciais nunca usa `*`; endpoints privados enviam `Cache-Control: private, no-store`; login/signup/mutations têm rate limit.
- Produção exige `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `WEB_URL`, `CORS_ORIGIN` sem placeholder; cookies com `httpOnly`, `sameSite`, `secure`.
- Erros internos logados só no servidor; cliente recebe mensagem genérica. Variáveis `VITE_`/`NEXT_PUBLIC_` nunca contêm segredo.
- Uploads futuros: limite de tamanho, whitelist de MIME, validação pós-upload, ownership. Nova dependência é avaliada antes de instalar (evitar pacotes recentes/pouco usados/typosquatting).

## 8. Idioma

UI em PT-BR. Código, banco e contratos (OpenAPI/SDK/JSON) sempre em inglês. Nunca misturar idioma dentro do mesmo tipo de artefato (ver regra de consistência de termo na seção 4).

## 9. Backend (Hono)

Rotas finas, delegam a services; toda rota valida com Zod; rotas protegidas passam `userId` ao service; service nunca confia em ID de cliente sem filtrar por `userId`.

```
apps/api/src/{index.ts, routes/, services/, repositories/, middlewares/, types/, utils/}
```

Resposta: `{ "data": {}, "error": null }` — Erro: `{ "error": true, "message": "...", "code": "optional" }`

## 10. Database (Drizzle)

Schema tipado, migrations obrigatórias (nunca `push` em produção), nomes consistentes, tipos inferidos.

## 11. Domain

Nenhuma regra financeira existe fora do domain.

**Transações:**

- Toda transação pertence a uma pessoa (`people`/`person`/`personId`); criação de usuário gera pessoa `admin` padrão, que não pode ser removida.
- Recorrência não tem quantidade fixa: tem `frequency` (weekly, monthly, bimonthly, quarterly, semiannual, annual), é regra expandida por período consultado, nunca materializada em lista finita.
- Geração/contabilização/vencimento/status de recorrência vivem no domain (ver OCP, seção 6).

## 12. Frontend (TanStack Start)

- Zero lógica financeira no frontend; chamadas via `*.api.ts`; TanStack Query obrigatório para
  estado remoto. Dados financeiros e persistentes vêm do backend; estado efêmero de interface pode
  permanecer local ao cliente.
- Formulários usam TanStack Form (`useForm`, `form.Field` e `form.Subscribe`) integrado aos schemas Zod de `packages/validators`; não implementar formulários com um `useState` monolítico nem duplicar validação contratual manualmente.
- Em React 19.2, preferir os comportamentos nativos dos hooks adequados ao problema (ex.: `useId` para associações acessíveis, estado de submissão do próprio form e identidade por `key` para reinicialização) em vez de sincronizar props e estado derivado com `useEffect`.
- Mensagens de validação e erro exibidas na UI devem ser breves e em PT-BR; nunca apresentar diretamente mensagens técnicas, internas ou em inglês recebidas de validators/API.
- Imagens de conteúdo no React usam `Image` de `@unpic/react`, sempre com `width` e `height` (ou `aspectRatio`) explícitos e `alt` adequado; não usar `<img>` diretamente. Primitives de bibliotecas que controlam carregamento/fallback internamente (ex.: `AvatarImage`) e SVGs decorativos de componentes são exceções.
- shadcn/ui por padrão — instalar componente faltante antes de criar um próprio; customizar só quando não existir opção shadcn ou a composição for específica da feature.
- Sem identidade visual/regra de domínio dentro de componente shadcn genérico. Sem cor arbitrária (`text-[#...]`); usar tokens Tailwind/shadcn. Fontes só em `apps/web/src/styles/fonts.css`.

## 13. OpenAPI / SDK / Mobile

OpenAPI gerado automaticamente pela API, com schemas completos e versionamento `/v1` futuro. Ainda
não existe `packages/sdk`; o contrato OpenAPI será a base para esse cliente quando ele entrar no
escopo.

## 14. Checklist de PR

- [ ] Regra financeira só existe no domain.
- [ ] Nenhuma rota importa Drizzle direto; todo repository filtra `userId`.
- [ ] Shape de pastas da seção 4 respeitado nas camadas aplicáveis (nomes, sufixos, sem barrel file
      e sem arquivos vazios apenas para completar estrutura).
- [ ] Função de service = um caso de uso (SRP); regra nova estendida, não reescrita (OCP).
- [ ] Schemas específicos por operação (ISP); service depende de interface de repository (DIP).
- [ ] Nomes revelam intenção; zero duplicação service↔domain; erros tipados por camada.

## 15. Versionamento e Releases

- Toda mudança notável entra em `CHANGELOG.md` seguindo Keep a Changelog; versões oficiais usam
  SemVer estável.
- Todos os `package.json` do workspace, a entrada do changelog e o badge do README usam sempre a
  mesma versão. Validar com `pnpm release:check`.
- A `main` apenas valida. Imagens e GitHub Releases são publicadas exclusivamente por tags
  `vX.Y.Z`, conforme `docs/releases.md`.
- Criar ou enviar uma tag publica artefatos externos e exige um pedido explícito e inequívoco para
  publicar uma versão. Pedidos para criar commit ou fazer push, isoladamente, não autorizam tag,
  imagens ou GitHub Release.
- Nunca mover, apagar ou recriar automaticamente uma tag publicada para contornar uma falha.

## 16. Princípio Final

Backend é o núcleo, frontend é interface. Domain é a camada mais estável — tudo gira em torno dela, nunca o contrário.
