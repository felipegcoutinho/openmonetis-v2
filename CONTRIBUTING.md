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

```bash
corepack enable
corepack prepare pnpm@11.25.0 --activate
pnpm install --frozen-lockfile
cp .env.example .env
pnpm docker:db
pnpm db:migrate
pnpm dev
```

## Regras de implementação

- UI não acessa banco nem implementa regra financeira.
- Routes são finas e validam entradas.
- Services implementam um caso de uso por função.
- Regras financeiras ficam no domain puro.
- Repositories filtram toda operação por `userId`.
- Código, banco e contratos usam inglês; a interface usa PT-BR.
- Mudanças de schema sempre incluem migration revisada.
- Novas features mantêm o mesmo nome e seguem o shape padronizado nas camadas aplicáveis, sem criar
  arquivos vazios apenas para completar a estrutura.

## Antes de enviar

```bash
pnpm check
pnpm test
pnpm build
pnpm release:check
```

A suíte automatizada cobre domínio, services, contratos HTTP, segurança e apresentação web.
Descreva no pull request também os cenários manuais executados e os riscos não cobertos.

Mudanças destinadas a uma nova versão também devem seguir o fluxo documentado em
[`docs/releases.md`](docs/releases.md). Preparar os metadados não autoriza criar ou enviar tags.

Um pull request deve informar:

- problema resolvido;
- decisão de domínio adotada;
- alterações de contrato ou migration;
- passos de validação;
- capturas de tela quando houver mudança visual;
- impactos de segurança, compatibilidade ou deploy.

## Licença das contribuições

Ao enviar uma contribuição, você declara que possui autorização para disponibilizá-la e concorda
que ela seja licenciada sob os mesmos termos da [Sustainable Use License 1.0](LICENSE) aplicada ao
OpenMonetis.
