# Variáveis de ambiente

O arquivo `.env` configura o desenvolvimento local e a implantação com Docker Compose. Crie-o a
partir do exemplo:

```bash
cp .env.example .env
```

Não envie o `.env` ao repositório. Os valores de segredo presentes no exemplo servem somente para
desenvolvimento. Em produção, use os scripts de instalação. Para configuração manual, gere a senha
do PostgreSQL com `openssl rand -hex 32` e os demais segredos com `openssl rand -base64 48`.

## Docker Compose

| Variável | Descrição |
| --- | --- |
| `OPENMONETIS_PROJECT_NAME` | Nome do projeto Compose e prefixo dos recursos criados. |
| `OPENMONETIS_VERSION` | Tag das imagens oficiais. Use `latest` ou uma versão publicada, como `0.2.0`. |
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
são mais necessárias.

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

Nunca reutilize a senha do PostgreSQL ou o mesmo segredo nessas três variáveis.

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

## Validando alterações

Depois de editar o `.env`, valide e aplique a configuração:

```bash
docker compose config --quiet
docker compose up -d
```

Use `docker compose config` sem `--quiet` somente em um ambiente privado, pois a saída resolvida
pode conter segredos.
