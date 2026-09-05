# Versionamento e publicação

O OpenMonetis usa versões estáveis no formato `MAJOR.MINOR.PATCH`. A versão raiz é a referência da
release e deve permanecer igual em todos os `package.json` do workspace, no badge do `README.md` e
na entrada correspondente do `CHANGELOG.md`.

## Preparar uma versão

1. Escolha o incremento conforme o Versionamento Semântico.
2. Atualize todos os `package.json` do workspace.
3. Mova as mudanças de `Unreleased` para `## [X.Y.Z] - YYYY-MM-DD` no changelog e escreva um resumo
   curto antes das seções.
4. Atualize o badge de versão do README.
5. Execute `pnpm release:check`, `pnpm check`, `pnpm test` e `pnpm build`.
6. Envie a mudança para `main` e aguarde a CI passar.

## Publicar

A publicação só é iniciada por uma tag anotada `vX.Y.Z` que aponte para o commit validado na
`main`. O workflow confere os metadados novamente, publica as três imagens no GHCR com tags
`X.Y.Z`, `X.Y`, `X` e `latest` e só então cria a GitHub Release com as notas extraídas do changelog.

```bash
git tag -a v0.1.0 -m "v0.1.0"
git push origin v0.1.0
```

Criar ou enviar uma tag publica artefatos externos. Essa ação exige autorização explícita do
mantenedor e não faz parte da preparação normal de uma versão.

## Comportamento da aplicação

A API lê a versão do próprio pacote e o changelog distribuído com a imagem. O cliente web consulta
`GET /releases`; ele não lê `package.json`, não analisa Markdown e não consulta o GitHub diretamente.
O estado de leitura do aviso da versão atual é salvo por usuário pela API. A consulta à release mais
recente no GitHub possui timeout, cache e fallback, por isso uma instalação sem acesso à internet
continua funcional.
