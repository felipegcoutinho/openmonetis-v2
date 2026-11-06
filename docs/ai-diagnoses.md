# Assistente de IA

O assistente de IA tem duas partes, em **Relatórios › Diagnóstico com IA**:

- **Diagnóstico:** uma leitura da saúde financeira do mês, com pontuação, indicadores, gráficos e
  sugestões de próximos passos;
- **Conversar:** um chat sobre os dados de um mês.

Cada pessoa usa a **própria assinatura** de Claude (Pro ou Max), de ChatGPT (Codex) ou a própria
conta Google no Antigravity. Não há chave de API nem conta compartilhada da instalação.

O recurso é opcional e fica desligado por padrão. Em produção, veja também
[Assistente de IA no guia de produção](production-deployment.md#assistente-de-ia-opcional).

## Como funciona

```text
web /reports/ai-diagnoses e Ajustes › Integrações
  -> API (/ai-providers, /ai-diagnoses, /ai-chats, /ai-data-sharing, /ai-tools)
       ├─ domain calcula pontuação, indicadores e dados dos gráficos
       ├─ PostgreSQL guarda consentimento, permissões, diagnósticos, conversas e eventos das CLIs
       └─> serviço openmonetis-ai (rede interna, segredo compartilhado)
             ├─ Claude Code CLI  (CLAUDE_CONFIG_DIR por pessoa)
             ├─ Codex CLI        (CODEX_HOME por pessoa)
             └─ Antigravity CLI  (HOME por pessoa)
```

- **O modelo não calcula números.** A API calcula a pontuação e os indicadores no domain
  (`packages/domain/src/ai-diagnoses.ts`) antes de chamar a IA. O modelo recebe esses valores,
  escreve o texto, escolhe gráficos de uma lista fechada e sugere ações de um catálogo fechado.
  A resposta é validada com Zod; uma resposta fora do contrato marca o diagnóstico como falho.
- **Ações nunca alteram dados.** Cada sugestão apenas abre uma tela existente (orçamentos,
  categoria, faturas, contas a pagar, recorrentes ou metas). Sugestões que citam categorias de
  outra pessoa ou inexistentes são descartadas.
- **Dados enviados.** Veja [Permissões de dados](#permissões-de-dados).
- **Execução assíncrona.** `POST /ai-diagnoses` responde `202` com o diagnóstico `pending`; a web
  consulta o resultado até `completed` ou `failed`. Um diagnóstico pendente por mais de cinco
  minutos (por exemplo, após reiniciar a API) é encerrado como `interrupted`.
- **Parar e apagar.** `POST /ai-diagnoses/{id}/cancel` marca o diagnóstico como `failed` com o
  motivo `canceled` e pede ao serviço de IA que encerre a CLI da pessoa
  (`DELETE /homes/{homeId}/providers/{provider}/runs/current`). O diagnóstico é encerrado antes do
  processo, então uma resposta que chegue depois é descartada. `DELETE /ai-diagnoses/{id}` remove
  o diagnóstico do histórico, parando antes a análise se ela ainda estiver em andamento. Um
  diagnóstico parado continua contando no limite diário.
- **Limites.** Um diagnóstico por vez por pessoa, até dez por 24 horas, e o próprio limite da
  assinatura de cada pessoa.

## Estilo de escrita

`POST /ai-diagnoses` aceita `voice` opcional, de uma lista fechada (`aiDiagnosisVoices` em
`packages/domain/src/ai-diagnoses.ts`). Texto livre nunca é aceito, para que ninguém consiga
alterar as instruções do modelo por esse campo.

| `voice` | Na tela | Como escreve |
| --- | --- | --- |
| `balanced` | Equilibrado (padrão) | Acolhedor e honesto. |
| `direct` | Direto | Frases curtas, sem elogios nem rodeios: fato, número e próximo passo. |
| `encouraging` | Motivador | Destaca os avanços e trata cada problema como meta alcançável. |
| `sarcastic` | Sarcástico | Ironia seca sobre hábitos e números, do começo ao fim, sempre seguida do fato. |
| `stern` | Bronca | Firme e exigente, com próximos passos no imperativo, sem exagero nem moralismo. |

- **Só o texto muda.** Em todos os estilos os números, a pontuação e a gravidade de cada seção
  continuam iguais, e os rótulos dos botões seguem curtos e objetivos. As instruções de todos os
  estilos proíbem zombar da pessoa, da renda dela ou de terceiros citados nos dados, e proíbem
  palavrões.
- **Texto inteiro.** O estilo pedido é sempre o usado e vale para todo o texto: título, resumo,
  todas as seções (inclusive as críticas) e os motivos das ações. Nos pontos críticos o estilo
  continua, mas o fato, o valor e o próximo passo ficam explícitos. Os rótulos dos botões seguem
  curtos e objetivos. As instruções de cada estilo ficam em `apps/api/src/utils/ai-voices.ts`,
  compartilhadas com o chat.
- **Lembrado.** A tela começa no estilo do último diagnóstico gerado.
- **Diagnósticos antigos** aparecem como `balanced`.

## Conversar

A aba **Conversar** abre um chat com o assistente e o modelo escolhidos sobre os dados de um mês
(o mês vale para a conversa inteira e aparece no cabeçalho).

```text
web (AI Elements) --SSE--> API /ai-chats/{id}/messages --NDJSON--> openmonetis-ai /chats
                                                                     ├─ claude --output-format stream-json
                                                                     ├─ codex app-server (thread efêmera)
                                                                     └─ agy --output-format stream-json
```

- **Stateless no provedor.** Cada pergunta envia os dados do mês (com as mesmas
  [permissões](#permissões-de-dados)) e as últimas 20 mensagens. Nenhuma sessão fica guardada nas
  CLIs; o histórico vive só no PostgreSQL (`ai_chats`, `ai_chat_messages`).
- **Streaming.** A API responde em server-sent events: `start` (mensagens salvas), `reasoning` e
  `delta` enquanto o modelo escreve e `done` com a mensagem final. Placeholders de categoria são
  restaurados durante o streaming, mesmo quando chegam quebrados entre pedaços.
- **Parar.** Fechar a conexão (botão parar, trocar de conversa ou sair da página) aborta a requisição
  até a CLI; o texto já escrito fica salvo como `canceled`.
- **Estilo.** Cada pergunta (e cada "Responder de novo") aceita o mesmo `voice` opcional do
  diagnóstico, escolhido no compositor, aplicado à resposta inteira.
- **Responder de novo** troca a última resposta por uma nova para a mesma pergunta, com o
  assistente e o modelo selecionados no momento.
- **Limites.** Uma resposta por vez por conversa (e por conta no serviço de IA), 100 perguntas por
  24 horas, mensagens de até 4.000 caracteres. Respostas presas em `streaming` por mais de cinco
  minutos são encerradas como `interrupted`.
- **Interface.** Componentes AI Elements (`apps/web/src/components/ai-elements/`) adaptados ao Base
  UI do projeto: `Conversation`, `Message` com Markdown via `streamdown`, `Reasoning`,
  `Suggestion` e `PromptInput`.

## Permissões de dados

O que sai da API depende das permissões da pessoa (`GET`/`PUT /ai-data-sharing`, tabela
`ai_data_sharing`). Sem nenhuma marcada — o padrão —, vão somente agregados: totais mensais,
indicadores, até dez categorias de despesa com valores, distribuição por condição e forma de
pagamento e os pontos de atenção (tipo, gravidade, valor e vencimento). Os nomes das categorias são
trocados por “Categoria 1”, “Categoria 2”… e restaurados no texto devolvido pelo provedor.

| Permissão (`scope`) | O que passa a ser enviado |
| --- | --- |
| `categoryNames` | Nomes reais das categorias, inclusive nos lançamentos e orçamentos. |
| `transactions` | Até 300 lançamentos do mês (mais recentes primeiro): descrição, valor, data, tipo, condição, forma de pagamento, categoria, situação, vencimento, parcela e recorrência. |
| `people` | Pessoa de cada lançamento e divisões. Exige `transactions`. |
| `notes` | Anotações dos lançamentos. Exige `transactions`. |
| `accounts` | Contas (nome, tipo, saldo, entradas e saídas), cartões (nome, limite e fatura) e a conta ou cartão de cada lançamento. |
| `budgetsAndGoals` | Orçamentos do mês por categoria e metas com nome, alvo, progresso e prazo. |

Com todas marcadas, a tela mostra um aviso de privacidade e cada diagnóstico ou pergunta no chat
envia tudo isso.
Arquivos anexados, ids de usuário e dados de login nunca são enviados. As permissões em vigor são
gravadas em cada diagnóstico (`shared_scopes`) e exibidas no relatório. A regra de dependência e a
troca de nomes ficam em `packages/domain/src/ai-data-sharing.ts`.

Os lançamentos são lidos em páginas até o limite de 300; um mês cheio não é mais cortado na
primeira página. As instruções explicam ao modelo que o período é um mês de competência e que
compras no cartão pertencem ao mês da fatura, mesmo com data de compra anterior.

### Prévia do que é enviado

`GET /ai-data-sharing/preview?period=YYYY-MM` devolve exatamente o objeto de dados que um
diagnóstico ou uma conversa daquele mês enviaria agora, com as permissões salvas e os nomes já
trocados quando for o caso. A web mostra essa prévia em **Ver dados enviados**, em Ajustes (mês
atual) e no Diagnóstico com IA (mês selecionado), com o tamanho aproximado e um botão para
copiar. Além desse objeto, seguem apenas as instruções do OpenMonetis e, no chat, as mensagens da
conversa.

### Histórico e retenção

Conversas e diagnósticos ficam no banco por um prazo escolhido em Ajustes (30 dias, 90 dias, 1
ano ou até a pessoa apagar), contado desde a última atividade: `updated_at` da conversa e
`created_at` do diagnóstico. O padrão é 90 dias (`ai_data_sharing.retention_days`, `null` para
manter). A API apaga o que passou do prazo um minuto depois de subir e a cada seis horas; cada
rodada é um `DELETE` idempotente, seguro com várias instâncias.

- `PUT /ai-data-sharing/retention` muda o prazo.
- `DELETE /ai-data-sharing/history` apaga na hora todas as conversas e diagnósticos da pessoa.
  Permissões e assistentes conectados continuam; o que já foi enviado segue a política de cada
  provedor.
- Se a conta for removida do banco, as tabelas de IA são apagadas em cascata. A pasta de login no
  serviço de IA só é apagada ao desconectar o assistente; ainda não existe exclusão de conta no
  app.

### Telemetria das CLIs

As CLIs rodam com a telemetria do fornecedor desligada:

| CLI | Como |
| --- | --- |
| Claude Code | `DISABLE_TELEMETRY`, `DISABLE_ERROR_REPORTING`, `DISABLE_BUG_COMMAND`, `CLAUDE_CODE_DISABLE_FEEDBACK_SURVEY` e `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC`. |
| Codex | `-c analytics.enabled=false` (que também desliga o exportador de métricas padrão) e `-c feedback.enabled=false`. |
| Antigravity | A telemetria é uma opção da conta Google, não da CLI, e não pode ser desligada por execução. Quem quiser desligá-la usa `/config` › Enable Telemetry no `agy`; em contas Business ela já vem desligada. |

## Modelos

Cada CLI informa os modelos liberados pela assinatura: o Claude Code expõe os aliases `sonnet`,
`opus` e `haiku`, o Codex lista o catálogo da conta via `app-server` (`model/list`) e o
Antigravity, via `agy models`. O serviço de
IA guarda essa lista em cache por dez minutos e a limpa no login e no logout.

- Em **Ajustes › Integrações**, cada assistente conectado mostra o logo e um modelo padrão, salvo
  com `PATCH /ai-providers/{provider}`. Os logos são arquivos fixos da web, em
  `apps/web/public/images/ai-providers/` (o Codex usa a marca da OpenAI, com variante clara e
  escura); não dependem de serviço externo. "Padrão do plano" deixa a escolha com a CLI.
- `POST /ai-diagnoses` aceita `model` opcional. A ordem é: modelo pedido, modelo padrão da conexão
  e, por fim, o padrão do plano. Um modelo pedido fora do catálogo retorna `ai_model_unavailable`;
  um modelo padrão que deixou de existir volta silenciosamente ao padrão do plano.
- Ids de modelo seguem `^[A-Za-z0-9][A-Za-z0-9._:-]{0,79}$`, para nunca virarem uma opção da CLI.
- Cada diagnóstico guarda o modelo pedido e o modelo efetivamente usado, informado pela CLI
  (`modelUsage` no Claude; o modelo resolvido no Codex), exibidos no relatório e no histórico.

## Login nas assinaturas

O login acontece sempre no fluxo oficial de cada fornecedor, executado pela CLI dentro do
container `openmonetis-ai`:

| Provedor | Comando | O que a pessoa faz |
| --- | --- | --- |
| Claude | `claude auth login --claudeai` | Abre o link, entra na conta e cola na tela o código exibido ao final. |
| Codex | `codex login --device-auth` com `forced_login_method="chatgpt"` | Abre o link e digita o código de uso único mostrado na tela. |
| Antigravity | `agy --print` dentro de um terminal criado por `script` | Abre o link do Google, entra na conta e cola o código em até 1 minuto (prazo fixo da CLI; a tela mostra um contador). |

O `agy` não tem comando de login nem de logout: ele pede o login quando roda um prompt e só aceita
o código colado num terminal. Por isso o login roda sob `script`, e a conexão consome uma resposta
mínima da conta. Desconectar apaga a pasta, onde a CLI guarda as credenciais.

As credenciais ficam somente no volume `OMv2_ai_homes`, em uma pasta por pessoa e provedor. O
nome da pasta é um HMAC do id do usuário (`AI_HOME_SECRET`); o serviço de IA nunca recebe o id
real, e a API nunca lê as credenciais. Desconectar executa o logout da CLI e apaga a pasta.

O ambiente de cada CLI é uma lista permitida: chaves de API, URLs de banco e segredos da instalação
não chegam aos processos. Sem chave de API no ambiente, as CLIs só podem usar o login da
assinatura; o Claude só é considerado conectado com `authMethod` de assinatura, e o Codex só com
login ChatGPT.

## Habilitando

1. Gere dois segredos exclusivos (os instaladores já fazem isso):

   ```bash
   openssl rand -base64 48
   ```

2. No `.env`, defina:

   ```bash
   AI_ENABLED=true
   AI_SERVICE_SECRET=<segredo-exclusivo>
   AI_HOME_SECRET=<outro-segredo-exclusivo>
   ```

3. Suba o serviço com o profile `ai` e recrie a API:

   ```bash
   docker compose --profile ai up -d
   ```

4. Cada pessoa conecta a própria assinatura em **Ajustes › Integrações › Assistente de IA** e gera
   diagnósticos em **Relatórios › Diagnóstico com IA**.

Alterar `AI_HOME_SECRET` desvincula todas as pessoas dos logins existentes; elas precisarão
conectar novamente. Trate o volume `OMv2_ai_homes` como dado sensível: ele contém os logins das
assinaturas. Não o inclua em backups sem criptografia.

### Desenvolvimento local

Com `claude`, `codex` ou `agy` instalados na máquina, `pnpm dev` já sobe o serviço de IA na porta `7003`
junto com a API e o web. Para rodá-lo sozinho:

```bash
pnpm dev:ai
```

Defina `AI_ENABLED=true` no `.env` e reinicie a API. Em desenvolvimento, os logins ficam em
`apps/ai/.ai-homes/` e as versões instaladas pela interface em `apps/ai/.ai-tools/` (ambos
ignorados pelo Git); os segredos usam os valores do `.env.example`. Quem administra é a primeira
conta do banco local.

## Atualizar as ferramentas

A imagem traz uma versão revisada de cada CLI. A pessoa que administra a instalação pode instalar
versões mais novas em **Ajustes › Integrações › Ferramentas do assistente**, sem esperar uma nova
imagem. Quem administra é a **primeira conta criada** na instalação; as demais contas não veem a
seção e recebem `403` nas rotas `/ai-tools`.

Uma versão só é ativada se passar por todas as etapas:

1. **Idade mínima:** a versão precisa estar publicada há pelo menos 3 dias. No npm conta pela data
   de publicação; o manifesto do Antigravity não informa data, então conta desde a primeira vez que
   o serviço viu a versão (ele consulta as origens a cada 6 horas).
2. **Origem fixa:** só a versão estável mais nova, das origens oficiais escritas no código:
   - Claude: pacote nativo `@anthropic-ai/claude-code-<sistema>-<arquitetura>` no npm;
   - Codex: build nativo `@openai/codex@<versão>-<sistema>-<arquitetura>` no npm;
   - Antigravity: manifesto oficial do Google, que só aceita downloads de
     `storage.googleapis.com/antigravity-public/antigravity-cli/`.
3. **Assinatura e integridade:** no npm, a assinatura do registro é conferida com a chave do npm
   fixada no código, e o arquivo baixado precisa bater com o SHA-512 publicado. No Antigravity,
   vale o SHA-512 do manifesto. Só o binário nativo é instalado, então nenhum script de pacote roda.
4. **Teste:** `--version` precisa informar a versão pedida, e o `--help` precisa conter todas as
   opções que os adaptadores usam. Opcionalmente, um diagnóstico curto com a conta de quem
   administra, sem dados financeiros, confirma que o formato da resposta não mudou.

As versões ficam em `/data/tools/<provedor>/<versão>/` (volume `OMv2_ai_tools`), **somente
leitura** depois de instaladas, para que nenhuma CLI se atualize sozinha. O arquivo `state.json`
guarda qual está ativa. Ficam guardadas a versão ativa e a anterior, além da versão da imagem, que
é sempre o último recurso. Uma versão só é apagada quando nenhum diagnóstico, conversa ou login
está usando, e versões iguais ou mais antigas que a da imagem também saem. Cada atualização e cada
troca de versão ficam registradas na tabela `ai_tool_events`.

Apagar o volume volta todas as ferramentas para as versões da imagem.

## Termos de uso dos fornecedores

A documentação da Anthropic permite que uma plataforma hospede o binário oficial do Claude Code
para que cada usuário entre com a própria assinatura, desde que o binário não seja modificado, o
login aconteça no fluxo da Anthropic e a plataforma não intermedeie nem revenda o uso. A mesma
documentação proíbe oferecer o login claude.ai para encaminhar requisições em nome de usuários sem
aprovação. O uso como motor de um relatório financeiro fica entre esses dois casos; consulte os
termos atuais da Anthropic, da OpenAI e do Google antes de habilitar o recurso para outras pessoas.

Este recurso foi desenhado para ficar do lado permitido: binários oficiais com versão fixa, login
apenas pelo fluxo do fornecedor, uma conta por pessoa e execução sempre disparada pela própria
pessoa. Nunca conecte a assinatura de uma pessoa para uso de outra.

## Serviço `openmonetis-ai`

API interna, autenticada por `Authorization: Bearer <AI_SERVICE_SECRET>`:

| Método | Caminho | Uso |
| --- | --- | --- |
| `GET` | `/health` | Healthcheck sem autenticação. |
| `GET` | `/homes/{homeId}/providers/{provider}` | Status do login. |
| `GET` | `/homes/{homeId}/providers/{provider}/models` | Modelos liberados pela assinatura. |
| `DELETE` | `/homes/{homeId}/providers/{provider}` | Logout e remoção da pasta. |
| `POST` | `/homes/{homeId}/providers/{provider}/logins` | Inicia o login da CLI. |
| `GET` | `/homes/{homeId}/providers/{provider}/logins/{loginId}` | Acompanha o login. |
| `POST` | `/homes/{homeId}/providers/{provider}/logins/{loginId}/code` | Entrega o código colado (Claude). |
| `POST` | `/homes/{homeId}/providers/{provider}/runs` | Executa uma geração com saída estruturada. |
| `DELETE` | `/homes/{homeId}/providers/{provider}/runs/current` | Encerra a geração ou resposta em andamento. |
| `POST` | `/homes/{homeId}/providers/{provider}/chats` | Responde no chat em NDJSON, enquanto o texto é escrito. |
| `GET` | `/tools` | Versões da imagem, ativa, anterior e mais recente de cada CLI. |
| `POST` | `/tools/{provider}/installs` | Inicia a instalação de uma versão. |
| `GET` | `/tools/{provider}/installs/{jobId}` | Acompanha a instalação. |
| `PUT` | `/tools/{provider}/active` | Troca para uma versão instalada ou para a da imagem (`null`). |

As gerações rodam sem ferramentas, sem MCP, sem configurações do usuário e em diretório temporário
vazio: `claude --print --tools "" --json-schema ...`,
`codex exec --sandbox read-only --ephemeral --json --output-schema ...` e
`agy --print ... --agent openmonetis --output-format stream-json`.

No Codex, o sandbox `read-only` só bloqueia escrita e rede: a leitura de arquivos continua
liberada, e todas as homes pertencem ao mesmo usuário do sistema. Por isso o chat e o diagnóstico
desligam as ferramentas embutidas (`features.shell_tool=false`, `features.view_image=false`,
`web_search="disabled"` e as demais de `toolsOffConfig` em `apps/ai/src/providers/codex.ts`) e
acompanham o stream de eventos: qualquer item que não seja mensagem, raciocínio ou plano
(`commandExecution`, `fileChange`, `mcpToolCall`, `webSearch` e outros) interrompe a resposta como
falha, antes que o resultado chegue ao texto.

No Antigravity, cada execução grava um agente próprio em `.agents/agents/openmonetis.md`, sem
ferramentas, MCP nem customizações (`tools: []`, `excludeDefaultComponents: true`). Na prática o
agente fica só com `manage_task`, sem acesso a arquivos, terminal, navegador ou web. As
instruções e os dados vão no corpo desse arquivo, nunca como argumento de linha de comando.

- O evento `init` lista o catálogo inteiro da CLI, qualquer que seja o agente, então a proteção é
  sobre o que a execução faz: qualquer chamada de ferramenta fora de `manage_task` e `finish`
  interrompe a execução como falha.
- Sem os componentes padrão, a CLI ignora `--json-schema`. O schema vai nas instruções e o JSON é
  lido da resposta; a API o valida com Zod como nos outros provedores.
- A CLI grava toda conversa no `HOME` da pessoa (transcrição em `brain/<id>/`, banco em
  `conversations/<id>.db`) e não tem opção para desligar isso. Ao fim de cada execução o serviço
  apaga tudo o que tem o `conversation_id` daquela execução.
- `agy models` separa id e nome por tabulação; o login é confirmado quando essa lista não vem
  vazia.
- Os modelos "High" do Gemini raciocinam por minutos (cerca de 20 mil tokens de raciocínio e 3,5
  min num diagnóstico de teste com o Argon High, contra 80 s do Flash High). Por isso a execução do
  Antigravity tem 270 s, a chamada da API ao serviço tem 285 s e o diagnóstico pendente expira em 5
  min.

As versões da imagem são fixadas pelos argumentos `CLAUDE_CODE_VERSION`, `CODEX_VERSION` e
`ANTIGRAVITY_CLI_RELEASE` do `Dockerfile` (o binário do Antigravity é baixado do bucket público do
Google e conferido por SHA-256 por arquitetura) e mudam com uma nova versão do OpenMonetis. Entre
versões, quem administra pode instalar uma CLI mais nova pela interface, como descrito em
[Atualizar as ferramentas](#atualizar-as-ferramentas). Nenhuma CLI se atualiza sozinha.
