# Testes do OpenMonetis

Os testes usam `node:test`, `node:assert/strict` e `tsx`. A suíte web usa Chromium via Playwright; os testes sem banco não iniciam navegador. As suítes sem banco, PostgreSQL, S3Mock e Chromium são executadas pela CI. Os testes de provedores reais são optativos e separados. Lint, tipos e build são verificações
complementares, sem substituir os testes de comportamento.

## Suíte sem banco

```bash
pnpm test
```

O script `scripts/run-tests.mjs` procura automaticamente `*.test.ts` e `*.test.tsx` nas pastas
`src` de `apps/*` e `packages/*`. Arquivos `*.integration.test.*` são excluídos dessa execução.

- Domain: regras puras, cálculos em centavos, datas e transições.
- Services: casos de uso com dependências controladas; esses testes não comprovam o SQL real.
- HTTP: contratos pontuais em aplicações Hono de teste.
- Web: apresentação, validação, parâmetros de URL, proxy e cabeçalhos; não há interação com telas.

Ao adicionar testes, prefira resultados observáveis: conservação dos valores, proteção de
histórico, ausência de gravações após rejeições e isolamento entre usuários. Um arquivo de teste
por módulo não significa cobertura completa das suas funções ou ramificações.

## Integrações com PostgreSQL

```bash
pnpm test:auth:integration
pnpm test:categories:integration
pnpm test:tags:integration
pnpm test:recurring:integration
pnpm test:settlements:integration
pnpm test:transactions:integration
pnpm test:financial-integrity:integration
pnpm test:financial-distribution:integration
pnpm test:connections:integration
pnpm test:imports:integration
pnpm test:settings:integration
pnpm test:ownership:integration
pnpm test:migrations:integration
pnpm test:storage:integration
```

Cada suíte cria um banco exclusivo, aplica as migrations e o remove ao terminar. Use o
PostgreSQL de desenvolvimento iniciado por `pnpm docker:db` ou configure `TEST_DATABASE_URL` com
uma conexão de teste. A credencial precisa poder criar e remover bancos. Não use infraestrutura
de produção; as suítes recusam `NODE_ENV=production`.

A integração de transações usa `apps/api/src/app.ts`, a mesma montagem de rotas, services e
middlewares utilizada pelo servidor. `apps/api/src/index.ts` apenas inicia o servidor HTTP.
As requisições passam por `app.request`, sem abrir uma porta e sem simular o middleware de
sessão. Usuários e cookies são criados pelo endpoint real de cadastro.

Essa integração verifica:

- todas as operações documentadas, exceto a lista explícita de rotas públicas, recusando
  requisições sem sessão ou token de dispositivo e enviando cabeçalhos de cache privado;
- sessões adulteradas e reutilização do cookie após logout;
- isolamento entre dois usuários e ownership de pessoas, categorias, contas e participantes;
- transferências com dois lançamentos opostos, conservação do saldo, edição, exclusão,
  pendências, rejeição por saldo insuficiente e transferências concorrentes;
- estornos parciais e totais, limite disponível, rateio, etiquetas herdadas, exclusão e
  estornos concorrentes sem créditos órfãos;
- estornos em faturas abertas e bloqueio em faturas pagas;
- ausência de campos internos sensíveis nas respostas financeiras verificadas.

Os cenários financeiros usam contas próprias por caso. O teste pai aguarda cada subteste, e a
conexão e o banco temporário são encerrados mesmo quando um caso falha. As requisições
concorrentes são intencionais e limitadas aos cenários que verificam disputa pelo mesmo saldo
ou valor de estorno. Eles são regressões de concorrência, não testes de carga.

## Cobertura adicional

| Suíte | Comportamentos verificados |
| --- | --- |
| Anexos sem banco | Whitelist, limites, assinatura de PDF/JPEG/PNG/WebP, metadados, ownership, confirmação repetida, falhas de assinatura/cópia/banco, limpeza e tombstones. |
| Storage S3 | Upload e download HTTP por URLs assinadas, inspeção de conteúdo e tamanho, cópia para a chave definitiva, vínculos compartilhados, remoção e isolamento. |
| Conexões | Token entregue apenas na criação e armazenado como digest, claim único, confirmação, expiração, limite de tentativas, concorrência e revogação bilateral. |
| Importação | Arquivos OFX e Excel, formatos brasileiros, datas, duplicidades concorrentes por usuário, ownership e desfazimento isolado de lotes. |
| Ajustes | Confirmação explícita, falha de storage antes de alterar o banco, limpeza de agregados no reset, preservação de outro usuário e revogação da sessão na exclusão. |
| Ownership | Leitura e alterações de contas, cartões, pessoas, categorias, etiquetas, orçamentos, metas e notas, além dos vínculos usados na criação; diagnósticos, conversas, permissões e histórico da IA de outra pessoa (404) e ferramentas da IA restritas à primeira conta (403). |
| Migrations | Base até a migration 0010 com dados financeiros; upgrade incremental até a atual, preservação de valores, rateios, âncoras e baixas antigas; conversão de regras de vencimento e reaplicação idempotente. |
| Services adicionais | Notificações, releases, estabelecimentos e conexões: ownership, estados inválidos, expiração, respostas públicas sem segredos, indisponibilidade e falhas de persistência. Notas e inbox incluem versões concorrentes, itens arquivados e transições rejeitadas sem gravação. |

Os testes de contratos também rejeitam ownership fornecido pelo cliente nos schemas estritos de
conexões e ajustes, códigos inválidos e uploads fora dos limites.

## Integridade financeira e permissões

`test:financial-integrity:integration` usa a API montada, sessões reais e PostgreSQL para verificar:

- baixa em lote com IDs de usuários diferentes: rejeição integral sem alterações ou eventos;
- contas de baixa e participantes de rateio pertencentes a outro usuário;
- filtros e exportações que tentam consultar dados de outro usuário;
- valor efetivo e rateio em centavos, extrato no mês da baixa e restauração ao desfazer;
- conservação do total parcelado e exclusão de uma parcela preservando as demais;
- recorrências com data inválida, prazo final inclusivo e baixa isolada por ocorrência;
- confirmação concorrente e IDs repetidos sem baixa ou evento duplicado;
- rollback de um lote quando um dos lançamentos já está confirmado;
- operações de fatura com cartões, contas ou pessoas de outro usuário;
- cópia de orçamentos com fontes de usuários diferentes sem criar cópias parciais;
- baixa pequena demais para o rateio retornando erro de validação, sem gravações.

Os testes sem banco também verificam margens de rateio por pessoa e por parcela em 45 combinações,
valores efetivos de receitas/despesas, limites de orçamento, estornos e projeções, mudança de mês
no vencimento, histórico congelado e versões de séries recorrentes. Os testes de service usam
repositórios controlados; a persistência e a atomicidade são verificadas na integração.

## Storage local

A suíte de storage usa o gateway AWS SDK da aplicação contra o [S3Mock da Adobe](https://github.com/adobe/S3Mock).
A imagem é fixada por versão e digest e a porta é publicada somente no loopback:

```bash
docker compose -p openmonetis-tests -f compose.test.yml up -d
pnpm test:storage:integration
docker compose -p openmonetis-tests -f compose.test.yml down
```

Aguarde o serviço responder com HTTP 200 em `http://127.0.0.1:19000/` antes de executar a suíte.
`TEST_S3_ENDPOINT` permite escolher outro endpoint de teste. Cada execução cria e remove seu próprio
bucket, com credenciais artificiais, e não usa o storage configurado no `.env`.
O S3Mock não valida políticas IAM, privacidade do bucket ou expiração/autenticidade das URLs.
A suíte verifica a geração das assinaturas, o prazo configurado e o protocolo de objetos; as
políticas e o CORS do provedor real precisam da suíte optativa abaixo e de revisão operacional.

Com PostgreSQL e S3Mock disponíveis, `pnpm test:integration` executa todas as quatorze suítes em
processos separados e informa falha se qualquer uma não passar.

## Storage no provedor real

```bash
pnpm test:storage:live
```

Esse comando usa as credenciais `S3_*` do ambiente/`.env`, ou as substituições
`TEST_REAL_S3_BUCKET`, `TEST_REAL_S3_ACCESS_KEY_ID`, `TEST_REAL_S3_SECRET_ACCESS_KEY`,
`TEST_REAL_S3_ENDPOINT` e `TEST_REAL_S3_REGION`. Endpoints personalizados devem usar HTTPS.
`TEST_REAL_WEB_ORIGIN` substitui a origem de `WEB_URL` na verificação de CORS.

A suíte envia somente um PDF sintético pequeno para duas chaves exclusivas sob
`openmonetis-infrastructure-tests/<uuid>/`. Verifica upload por URL assinada, inspeção, cópia
condicional, conteúdo do download, cabeçalhos privados e bloqueio de URLs sem assinatura,
adulteradas e expiradas. Também verifica o preflight de upload para a origem configurada e
a ausência de permissão CORS para uma origem aleatória. Remove os próprios objetos ao terminar;
falha de limpeza faz a suíte falhar. Não lista objetos existentes, cria buckets ou altera políticas.

Foi executada com sucesso no endpoint real configurado nesta etapa. Isso verifica esses objetos
e essa origem; não audita todas as permissões IAM, domínios públicos alternativos, regras de
retenção/versionamento, recuperação de desastres ou disponibilidade do provedor. Use um bucket
de teste quando disponível. O comando não faz parte da CI comum nem de `test:integration`.

## Navegador

```bash
pnpm exec playwright install chromium
pnpm test:e2e
```

Os testes usam [Playwright](https://playwright.dev/docs/test-webserver), criam um banco temporário e
iniciam a API e a web nas portas 17001 e 17002. Servidores já abertos nessas portas não são
reutilizados. A inicialização não usa o banco da aplicação nem credenciais reais de Google/S3.
O banco e os processos são removidos ao finalizar.

Os fluxos verificam login com falha e sucesso; criação, edição e baixa de uma despesa com
atualização da tabela e recarregamento; falha de gravação preservando o formulário e bloqueio de
submissão duplicada; pagamento de fatura e seu efeito persistido. Requisições usadas para montar
os dados de teste compartilham os cookies do contexto do navegador. O cenário de falha intercepta
apenas a gravação que falha; as operações bem-sucedidas usam a API e o PostgreSQL reais.

O relatório de etiquetas verifica o total das transferências sem duplicar os dois lançamentos,
preservando receitas, despesas e resultado nas visualizações desktop e celular, inclusive após
recarregar a página e consultar outro mês.

Distribuição financeira verifica fluxos e totais, previsões, subcategorias, filtros, exportações
CSV e PNG, privacidade e visualização mobile. Sua integração verifica isolamento entre usuários,
rateios, valores efetivos e contas excluídas, incluindo a conta de baixa das recorrências.

Os seletores responsivos também são verificados ao alternar entre desktop e celular com a lista
aberta, sem perder o estado nem emitir avisos de controle do componente.

O seletor de período de Evolução por categoria e Compromissos futuros verifica a escolha dos meses
em qualquer ordem, o descarte ao fechar, o limite de 24 meses, a persistência na URL e o popup no
celular sem rolagem horizontal.

Os três cenários de passkeys usam WebAuthn do Chromium com um autenticador virtual CTAP2 e
verificação criptográfica real do Better Auth. Cobrem cadastro, login sem senha, rejeição da
repetição da mesma resposta, renomeação, remoção, login com credencial revogada, isolamento
entre contas, exigência de sessão e rejeição de registro sem prova de verificação do usuário.
O autenticador virtual não comprova o funcionamento de biometria ou chaves físicas.

Em caso de falha, consulte `playwright-report/index.html`, os screenshots e traces em
`test-results/`. A CI instala Chromium e publica esses diagnósticos e o relatório de cobertura.

## Google OAuth

`pnpm test:auth:integration` usa PostgreSQL real e um provedor Google controlado. Além de cadastro
aberto/fechado e login existente, verifica callback sem cookie, `state` adulterado, consentimento
negado e redirecionamento para origem não confiável. Os callbacks inválidos não emitem sessão
nem criam usuários; os três primeiros casos não chegam à troca do código com o provedor.

Não há testes contra o Google real: o projeto não mantém uma conta de teste nesse provedor.

## Métricas de cobertura

```bash
pnpm test:coverage
```

O [c8](https://github.com/bcoe/c8) produz HTML em `coverage/index.html`, LCOV em `coverage/lcov.info`
e JSON em `coverage/coverage-summary.json`. O escopo inclui **todos** os arquivos de domínio e
services, mesmo quando não foram carregados pelos testes, excluindo os próprios testes.
Não é um percentual do sistema inteiro: repositories, HTTP, React e navegador são verificados
nas respectivas suítes, mas não entram nesse denominador.

A configuração `.c8rc.json` exige pelo menos 91% de linhas e statements, 82% de branches e 89%
de funções. Esses limites preservam a base medida nesta etapa; alterações futuras devem ampliar
a cobertura onde mudam comportamento. O relatório mede somente a suíte sem banco, sem somar
artificialmente as execuções de integração.

Na última execução, os 650 testes sem banco passaram. A cobertura conjunta de domínio/services
foi de **91,88% das linhas/statements, 83,46% das ramificações e 89,89% das funções**.

| Service | Linhas | Ramificações | Funções |
| --- | ---: | ---: | ---: |
| Transações | 94,32% | 82,13% | 100% |
| Parcelas | 100% | 100% | 100% |
| Faturas | 100% | 86,89% | 100% |

100% de linhas ou ramificações significa que o código foi executado nessa métrica; não significa
que todas as combinações de dados, estados e concorrência foram verificadas.

## Antecipações, faturas e cópias

A suíte sem banco inclui testes próprios de sucesso, rejeição e falha de persistência para:

- consulta de antecipação e desfazimento parcial/total, preservando desconto em centavos e as
  responsabilidades remanescentes; IDs inválidos, ausência de ownership e alterações concorrentes;
- desfazimento de pagamentos e remoção de ajustes de fatura, com tradução de estados pagos e
  recursos ausentes; alteração de datas validada antes da gravação e novamente com o estado bloqueado;
- cópias de receitas, despesas, parcelas e recorrências, preservando vínculos, etiquetas e notas;
  identidade independente, bloqueio de lançamentos gerados, faturas pagas e relações indisponíveis;
- falhas de criação sem copiar vínculos de anexos e sem modificar o registro original.

A ampliação dos testes de transações inclui transferências pendentes/confirmadas e conservação
dos dois lançamentos, tradução de erros financeiros, confirmação de inbox/despesa externa,
ownership de vínculos e estornos parciais com rateio em centavos. Também exercita importação
OFX/Excel, células de fórmula/texto formatado/datas, categorias sugeridas, deduplicação,
limite do cartão, faturas pagas e desfazimento do lote. Edições rejeitam alterações financeiras
de baixas confirmadas e mudanças estruturais de parcelas; falhas de gravação não são repetidas.

Parcelas incluem sucesso e conflito na antecipação, seleção entre usuários/séries/cartões,
parcelas já pagas, descontos inválidos e falhas de leitura/gravação. Faturas incluem rateios
inválidos, recursos indisponíveis, ajustes sem mudança de total, datas inválidas, pagamento
concorrente durante pagamento/ajuste e recorrências contabilizadas somente na fatura correta.

A integração de integridade financeira verifica cópia de despesa dividida, etiquetas e rateios
persistidos, cópia de recorrência sem herdar baixas e rejeição de cópias por outro usuário.
Também verifica a cópia de parcelas com arredondamento: a nova compra usa o valor original da
série, sem multiplicar o valor arredondado de uma parcela. O rateio da parcela selecionada é
reaplicado proporcionalmente ao total da nova compra pelo domínio.

## Limites que permanecem

- Transações ainda têm caminhos de listagem/filtros, apresentação de recorrências e escopos de
  edição sem cobertura unitária; faturas ainda têm ramificações sem execução. As integrações
  complementam essa verificação, sem esgotar combinações de estados e falhas de persistência.
- Chromium cobre os fluxos essenciais e passkeys virtuais; Firefox, WebKit, passkeys físicas,
  acessibilidade completa, regressão visual e testes de carga ainda não compõem essa suíte.
- O upgrade exercita dados representativos da versão anterior, não todas as combinações de
  dados de instalações existentes. Backups e validação operacional seguem necessários.
- A matriz de ownership cobre recursos principais e IDs relacionados; ela não afirma cobertura
  de todas as combinações de endpoints, estados e filtros.
- As cinco integrações originais ainda possuem casos encadeados. As novas usam subtestes para
  identificar falhas e continuar verificando os casos seguintes.
- O storage real passou nos cenários de URLs assinadas, objetos privados e CORS descritos acima;
  a auditoria completa das políticas do provedor continua fora dessa suíte.
- O assistente de IA é testado sem as CLIs reais: domain, services, contratos e adaptadores usam
  saídas gravadas de cada CLI. Login, geração e atualização das CLIs com assinaturas reais são
  verificados manualmente no container `ai`, e mudanças de formato das CLIs só aparecem nessa
  verificação ou no teste opcional da atualização em Ajustes.
- Cobertura de código e testes aprovados não comprovam ausência de bugs em cenários ainda não especificados.
