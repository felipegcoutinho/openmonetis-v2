# Variáveis de ambiente

O arquivo `.env` configura o desenvolvimento local e a implantação com Docker Compose. Crie-o a
partir do exemplo:

```bash
cp .env.example .env
```

Não envie o `.env` ao repositório. Os valores de segredo presentes no exemplo servem somente para
desenvolvimento. Em produção, siga o [guia de implantação](production-deployment.md), incluindo a
fixação de versão. Para configuração manual, gere a senha
do PostgreSQL com `openssl rand -hex 32` e os demais segredos com `openssl rand -base64 48`.

## Docker Compose

| Variável | Descrição |
| --- | --- |
| `OPENMONETIS_PROJECT_NAME` | Nome do projeto Compose e prefixo dos recursos criados. |
| `OPENMONETIS_VERSION` | Versão das imagens oficiais, alinhada à tag do checkout (`0.12.0` com `v0.12.0`). Os instaladores gravam a versão instalada; para escolher uma versão publicada, defina a variável antes de executá-los. Evite `latest` em produção. |
| `APP_PORT` | Porta do host que publica o cliente web. Ao alterá-la, ajuste também as URLs públicas. |

## PostgreSQL

| Variável | Descrição |
| --- | --- |
| `POSTGRES_DB` | Nome do banco criado pelo container PostgreSQL. |
| `POSTGRES_USER` | Usuário do PostgreSQL. |
| `POSTGRES_PASSWORD` | Senha do PostgreSQL. Use um valor forte em produção. |
| `DB_HOST_PORT` | Porta local do PostgreSQL, vinculada somente a `127.0.0.1`. |
| `EXTERNAL_DATABASE_URL` | Conexão opcional com um PostgreSQL externo, usada tanto por processos locais quanto pelos containers. |

Sem `EXTERNAL_DATABASE_URL`, a conexão é montada automaticamente com as variáveis acima. Processos
locais usam `localhost:DB_HOST_PORT`; containers recebem `db:5432`. Assim, usuário, senha e nome do
banco são declarados uma única vez.

As antigas entradas `DATABASE_URL` e `DOCKER_DATABASE_URL` podem ser removidas do `.env`; elas não
são mais necessárias no fluxo fornecido pelo Compose. O Compose gera `DATABASE_URL` para os
containers a partir de `EXTERNAL_DATABASE_URL` ou das credenciais locais. Se executar os processos
diretamente com `NODE_ENV=production`, `DATABASE_URL` é obrigatória; `EXTERNAL_DATABASE_URL` sozinha
não a substitui nesse modo.

### Pool e limites de consultas

Estas variáveis são lidas pelos processos que usam o client de `@openmonetis/db`, como a API e o
worker diário. Os limites são por processo, não por instalação.

| Variável | Padrão | Descrição |
| --- | --- | --- |
| `DB_POOL_MAX` | `10` | Máximo de conexões no pool de cada processo. |
| `DB_CONNECTION_TIMEOUT_MS` | `5000` | Tempo máximo, em milissegundos, para obter uma conexão. |
| `DB_IDLE_TIMEOUT_MS` | `30000` | Tempo ocioso, em milissegundos, antes de remover uma conexão do pool. |
| `DB_STATEMENT_TIMEOUT_MS` | `15000` | Limite de execução de cada comando SQL, em milissegundos. |

Valores definidos devem ser inteiros positivos; valores inválidos impedem a inicialização do client.
O migrator usa a configuração própria do Drizzle Kit, não esse pool.

## URLs da aplicação

| Variável | Descrição |
| --- | --- |
| `OPENMONETIS_URL` | URL pública principal e entrada aceita pelos scripts de instalação. Em edição manual, mantenha as três URLs abaixo alinhadas com ela. |
| `BETTER_AUTH_URL` | URL pública usada pelos endpoints de autenticação. |
| `WEB_URL` | Origem do cliente web, usada também por passkeys. |
| `CORS_ORIGIN` | Origens permitidas pela API, separadas por vírgula quando houver mais de uma. |
| `BETTER_AUTH_TRUSTED_ORIGINS` | Origens adicionais confiáveis para autenticação, separadas por vírgula. Pode ficar vazia. |

Em produção, use a origem HTTPS final, sem caminho, por exemplo
`https://financas.exemplo.com`. Como a autenticação passa pelo proxy web, normalmente
`OPENMONETIS_URL`, `BETTER_AUTH_URL`, `WEB_URL` e `CORS_ORIGIN` têm o mesmo valor.

## Autenticação e integrações entre pessoas

| Variável | Descrição |
| --- | --- |
| `BETTER_AUTH_SECRET` | Assina e protege dados da autenticação. Deve ser exclusivo da instalação. |
| `DEVICE_TOKEN_SECRET` | Protege os tokens usados pelo Companion Android. Alterá-lo invalida as credenciais existentes. |
| `PERSON_CONNECTION_SECRET` | Protege os tokens das conexões entre pessoas. Deve ser diferente dos demais segredos. |
| `AUTH_SESSION_EXPIRES_IN_DAYS` | Quantidade de dias até a expiração da sessão. Deve ser um inteiro positivo. |
| `AUTH_SESSION_UPDATE_AGE_HOURS` | Intervalo, em horas, para renovação da sessão. Deve ser um inteiro positivo. |
| `DISABLE_SIGNUP` | `true` bloqueia a criação de usuários por senha e Google. O padrão é `false`. Login de contas existentes continua disponível. Aceita apenas `true` ou `false`; valores inválidos impedem a inicialização. |

Nunca reutilize a senha do PostgreSQL ou o mesmo segredo nessas três variáveis.

`DISABLE_SIGNUP` é lida pela API na inicialização; a web consulta sua disponibilidade em tempo de
execução. Depois de alterá-la, recrie a API com `docker compose up -d --no-deps --force-recreate api`.
No desenvolvimento local, reinicie o processo da API. Não é necessário recompilar a web.
Consulte o procedimento de primeiro acesso no [guia de produção](production-deployment.md#primeiro-usuário-e-fechamento-do-cadastro).

## Armazenamento de anexos

| Variável | Descrição |
| --- | --- |
| `S3_BUCKET` | Nome do bucket de anexos. |
| `S3_ACCESS_KEY_ID` | Identificador da credencial S3. |
| `S3_SECRET_ACCESS_KEY` | Segredo da credencial S3. |
| `S3_ENDPOINT` | Endpoint de um serviço compatível com S3. Deixe vazio para AWS S3; em produção, endpoints personalizados devem usar HTTPS. |
| `S3_REGION` | Região do bucket, como `us-east-1` ou `sa-east-1`. |

`S3_BUCKET`, `S3_ACCESS_KEY_ID` e `S3_SECRET_ACCESS_KEY` devem ser configuradas juntas. Se todas
ficarem vazias, o recurso de anexos permanece desabilitado.

O upload ocorre diretamente do navegador para o storage por URL assinada. Configure também o CORS
do bucket para a origem web e o método `PUT`; `CORS_ORIGIN` não configura o storage. Consulte o
[fluxo e exemplo de configuração](production-deployment.md#storage-privado-e-cors-dos-anexos).

## Google OAuth

| Variável | Descrição |
| --- | --- |
| `GOOGLE_CLIENT_ID` | Client ID criado no Google Cloud Console. |
| `GOOGLE_CLIENT_SECRET` | Client secret correspondente. |

Configure as duas variáveis juntas ou deixe ambas vazias. O callback autorizado deve ser
`<WEB_URL>/api/auth/callback/google`.

## Logo.dev

| Variável | Descrição |
| --- | --- |
| `LOGO_DEV_PUBLISHABLE_KEY` | Chave pública usada para carregar imagens do CDN da Logo.dev. |
| `LOGO_DEV_SECRET_KEY` | Chave secreta usada pela API para pesquisar estabelecimentos. |

Configure as duas variáveis para habilitar completamente a busca e a exibição de logos. Se não usar
a integração, deixe ambas vazias.

## Configurações de execução

| Variável | Serviço | Padrão | Descrição |
| --- | --- | --- | --- |
| `API_INTERNAL_URL` | Web | `http://localhost:7001`; no Compose, `http://api:7001` | Destino HTTP(S) do proxy same-origin, acessível pelo servidor web. |
| `API_PROXY_MAX_BODY_BYTES` | Web | `8388608` (8 MiB) | Limite dos corpos de requisição no proxy. Deve ser um inteiro positivo seguro; valores inválidos usam o padrão. As rotas Companion mantêm limites fixos de 16 KiB por item e 256 KiB por lote. |
| `RELEASE_REPOSITORY` | API | `felipegcoutinho/openmonetis-v2` | Repositório GitHub consultado para avisos de atualização, no formato `owner/repository`. Valor vazio ou inválido usa o padrão. |

### Aplicação das variáveis opcionais

O `.env` do Compose serve para interpolar o YAML: uma variável só chega ao container quando está
declarada no `environment` do serviço. O Compose atual já define `API_INTERNAL_URL` para a web, mas
não repassa `API_PROXY_MAX_BODY_BYTES`, `RELEASE_REPOSITORY` nem as quatro variáveis do pool.

Para personalizá-las em Docker, adicione as entradas aos serviços correspondentes em um arquivo
local `compose.override.yml`. Por exemplo, para alterar o pool da API e do worker:

```yaml
services:
  api:
    environment:
      DB_POOL_MAX: ${DB_POOL_MAX:-10}
  recurring-worker:
    environment:
      DB_POOL_MAX: ${DB_POOL_MAX:-10}
```

Defina `DB_POOL_MAX` no `.env` e recrie os serviços afetados após validar o Compose. Aplique o mesmo
padrão às demais variáveis, respeitando o serviço consumidor indicado nas tabelas. Preserve também
o arquivo de override no backup da configuração.

Na execução local, a API e o worker carregam o `.env` pelos seus scripts de desenvolvimento. Para
as configurações de execução da web, exporte as variáveis no ambiente do processo antes de iniciá-lo.
Reinicie o processo consumidor após alterar seus valores.

## Validando alterações

Depois de editar o `.env`, valide e aplique a configuração:

```bash
docker compose config --quiet
docker compose up -d
```

Use `docker compose config` sem `--quiet` somente em um ambiente privado, pois a saída resolvida
pode conter segredos.
