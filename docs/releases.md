# Versionamento e publicação

O OpenMonetis usa versões estáveis no formato `MAJOR.MINOR.PATCH`. A versão raiz é a referência da
release e deve permanecer igual em todos os `package.json` do workspace, no badge do `README.md` e
na entrada correspondente do `CHANGELOG.md`.

## Concluir cada mudança

1. Revise uma mudança por vez e atualize seus testes e documentação.
2. Registre mudanças notáveis em `Unreleased` no changelog, incluindo as notas de atualização
   aplicáveis. Preserve as entradas das outras mudanças e mantenha a versão atual dos pacotes e
   do badge do README.
3. Execute as [validações e suítes afetadas](../CONTRIBUTING.md#antes-de-enviar).
4. Crie commits coesos com a implementação, testes e documentação da mudança. Essa etapa pode ser
   repetida para cada feature, sem push e sem preparar uma versão a cada commit.

## Preparar uma versão com as mudanças commitadas

Comece com as mudanças de produto e seus registros em `Unreleased` já commitados. Resolva
alterações pendentes antes de preparar a release; não as misture ao commit de versionamento.

1. Revise o conjunto de commits desde a última versão e escolha o incremento pelo maior impacto
   conforme o Versionamento Semântico.
2. Atualize todos os `package.json` do workspace.
3. Mova as mudanças de `Unreleased` para `## [X.Y.Z] - YYYY-MM-DD` no changelog e escreva um resumo
   curto antes das seções.
4. Atualize o badge de versão do README e `OPENMONETIS_VERSION` no `.env.example`.
5. Valide o conjunto final com `pnpm release:check`, `pnpm check`, `pnpm test:coverage`,
   `pnpm build`, `pnpm test:integration` e `pnpm test:e2e`. `test:coverage` executa a suíte de
   `pnpm test` e verifica os limites de cobertura. Prepare os ambientes isolados conforme
   [o guia de testes](testing.md); falhas ou verificações obrigatórias sem execução impedem a
   publicação. O workflow de publicação repete a CI completa.
6. Crie o commit de preparação da versão, incluindo somente os metadados e o changelog consolidado.
7. Envie os commits para `main` e aguarde a CI do mesmo SHA passar antes de criar e enviar a tag.

## Notas de atualização

Toda versão com migration, mudança de contrato, variável de ambiente ou alteração no Compose deve
incluir `### Notas de atualização`. Registre as notas primeiro em `Unreleased` e mantenha-as ao
preparar a versão. Use um item por assunto, com passos executáveis e valores padrão explícitos:

```markdown
### Notas de atualização

- Banco: identifique as migrations e seus efeitos nos dados. Informe o backup necessário e
  acompanhe `docker compose logs migrator` após iniciar a nova versão.
- API: descreva rotas/campos adicionados, alterados ou removidos e a adaptação exigida dos clientes.
- Ambiente: indique variáveis novas/removidas, valores padrão e quais serviços devem ser recriados.
- Compose: identifique serviços, volumes, portas ou dependências alteradas e os comandos necessários.
```

Mencione somente os assuntos afetados e substitua as instruções do modelo por ações específicas da
versão. Não apresente reverter a imagem como forma de desfazer uma migration: documente as condições
de recuperação, incluindo restauração de backup quando necessária. As notas são distribuídas nas
imagens, apresentadas em `GET /releases` como `upgradeNotes` e exibidas separadamente na web.

Antes de publicar, confira os quatro assuntos mesmo que só parte deles exija ações. Versões antigas
sem essa seção continuam sendo aceitas; o leitor retorna uma lista vazia de notas.

Os instaladores clonam a tag `vX.Y.Z` da versão instalada e gravam a mesma versão em
`OPENMONETIS_VERSION`. Por isso, uma versão só fica disponível para novas instalações depois que a
tag é publicada, e o `.env.example` de cada tag precisa apontar para a própria versão;
`pnpm release:check` recusa a divergência.

## Publicar

A publicação só é iniciada por uma tag anotada `vX.Y.Z` que aponte para o commit validado na
`main`. O workflow verifica que a referência é uma tag anotada, confirma que o commit pertence à
história da `main`, repete a CI e confere os metadados novamente. Cada imagem é compilada
separadamente em runners nativos `ubuntu-24.04` (AMD64) e `ubuntu-24.04-arm` (ARM64), sem QEMU,
com cache independente por imagem e arquitetura.

Os seis builds enviam imagens ao GHCR somente por digest. Depois que todos concluem com sucesso,
o workflow reúne os dois digests de cada imagem em um manifesto, publica as tags `X.Y.Z`, `X.Y`,
`X`, `sha-<commit>` e `latest` e verifica as duas arquiteturas. Uma falha de build impede a
atualização das tags de todas as imagens. A publicação dos três manifestos não é uma operação
atômica do registry; falhas nessa etapa precisam ser verificadas antes de atualizar uma instalação.
A GitHub Release só é criada após os três manifestos serem publicados e verificados, com as notas
extraídas do changelog.

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
