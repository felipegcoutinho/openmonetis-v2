# Implantação em produção

Este guia descreve a topologia Docker Compose fornecida pelo repositório. Adapte firewall, proxy,
storage, observabilidade e política de backup à infraestrutura da instalação.

> [!WARNING]
> O projeto está em desenvolvimento ativo. Recomendo manter backups atualizados antes de realizar atualizações e evitar a exposição direta do PostgreSQL ou da API à internet.

## Preparando o host de produção

O host precisa de:

- Docker Engine com o plugin Compose;
- acesso ao `compose.yml` e ao `.env` de produção;
- um proxy reverso com HTTPS na frente da porta web;
- armazenamento persistente e uma rotina externa de backup.

As imagens de release são publicadas no GitHub Container Registry pelo workflow acionado por tags.

## Variáveis obrigatórias

Consulte o [manual de variáveis de ambiente](environment-variables.md) para conhecer todas as
opções disponíveis.

Use a origem HTTPS final, sem path:

```dotenv
OPENMONETIS_URL=https://financas.exemplo.com
BETTER_AUTH_URL=https://financas.exemplo.com
WEB_URL=https://financas.exemplo.com
CORS_ORIGIN=https://financas.exemplo.com
```

Gere segredos independentes. Não reutilize o mesmo valor entre variáveis. Para os três segredos da
aplicação, use:

```bash
openssl rand -base64 48
```

Como a senha do PostgreSQL compõe uma URL interna, use um valor hexadecimal para evitar caracteres
reservados:

```bash
openssl rand -hex 32
```

Configure ao menos:

```dotenv
BETTER_AUTH_SECRET=<segredo-exclusivo>
DEVICE_TOKEN_SECRET=<segredo-exclusivo>
PERSON_CONNECTION_SECRET=<segredo-exclusivo>
POSTGRES_PASSWORD=<senha-forte>
```

Se usar um PostgreSQL externo, defina `EXTERNAL_DATABASE_URL`. Para anexos, configure juntos
`S3_BUCKET`, `S3_ACCESS_KEY_ID` e `S3_SECRET_ACCESS_KEY`; `S3_ENDPOINT` é necessário somente para
serviços compatíveis que não usam o endpoint padrão da AWS.

Valide a configuração resolvida antes de iniciar:

```bash
docker compose config --quiet
```

## Primeira implantação

Os instaladores clonam a tag da versão publicada mais recente e gravam a mesma versão em
`OPENMONETIS_VERSION`, mantendo `compose.yml`, `.env.example` e imagens alinhados. Para instalar
outra versão publicada, defina `OPENMONETIS_VERSION=0.12.0` antes de executar o instalador. Em uma
implantação manual, faça o mesmo: checkout da tag `v0.12.0` e imagens `0.12.0`. Evite `latest` em
produção: um `docker compose pull` passaria a aplicar versões novas, com suas migrations, sem
revisão das notas de atualização.

```bash
docker compose pull
docker compose up -d
docker compose ps
```

A inicialização respeita esta ordem:

```text
db saudável -> migrator concluído -> API e worker diário iniciados -> web após API saudável
```

Verifique os logs se algum serviço não alcançar o estado esperado:

```bash
docker compose logs migrator
docker compose logs api
docker compose logs recurring-worker
docker compose logs web
```

O `recurring-worker` sincroniza diariamente os lançamentos recorrentes compartilhados, a partir das
03:00 no horário de Brasília. Boletos são
disponibilizados no primeiro dia do mês do vencimento; cartão e demais meios ficam disponíveis na
data de cada ocorrência. Se o serviço estiver indisponível no momento previsto, a execução seguinte
recupera somente ocorrências elegíveis, sem criar duplicidades. Para boletos, uma série ou conexão
ativada depois do primeiro dia do mês, mas até o vencimento nominal, permite o envio na data de
ativação. Para os demais meios, a ativação precisa ocorrer até a data da ocorrência. Uma ativação
posterior ao vencimento do boleto não recupera aquele boleto.

Somente a porta do web deve ser publicada externamente. A porta do PostgreSQL fornecida pelo Compose
fica vinculada a `127.0.0.1`; mantenha essa restrição ou remova completamente o mapeamento no host de
produção.

## Primeiro usuário e fechamento do cadastro

1. Mantenha o acesso à instalação restrito ao host ou à rede privada durante o primeiro cadastro.
2. Configure `DISABLE_SIGNUP=false` no `.env`, inicie os serviços e crie a primeira conta pela web,
   com senha ou Google, caso o provedor esteja configurado.
3. Defina `DISABLE_SIGNUP=true` e aplique a configuração:

```bash
docker compose config --quiet
docker compose up -d --no-deps --force-recreate api
```

Confirme que o login da conta criada funciona, que “Criar conta” desapareceu e que `/signup` informa
“Cadastro desabilitado”. A API também bloqueia chamadas diretas e novos usuários via OAuth; Google
e passkeys continuam disponíveis para contas existentes. Não existe exceção automática para banco
vazio: com `DISABLE_SIGNUP=true`, o primeiro cadastro também é bloqueado.

Para adicionar outra conta, reabra temporariamente o cadastro em acesso restrito, crie a conta e
feche novamente. Não use o seed de dados demonstrativos para criar o primeiro usuário de produção.

## HTTPS e proxy reverso

O proxy deve:

- terminar TLS com um certificado válido;
- encaminhar todos os paths para o web na porta configurada por `APP_PORT`;
- preservar `Host`, protocolo e cookies;
- encaminhar as requisições JSON de preparação e confirmação de anexos;
- redirecionar HTTP para HTTPS.

Não encaminhe `/api-proxy` diretamente para o container da API. O web implementa o proxy same-origin
e adiciona o contexto esperado pela aplicação.

## Storage privado e CORS dos anexos

O navegador pede uma URL assinada à API, envia o arquivo diretamente ao storage por `PUT` e pede à
API a confirmação. A API verifica tamanho, MIME e assinatura do conteúdo antes de vincular o anexo.
URLs de upload e download expiram em cinco minutos. O corpo do arquivo não passa pelo proxy web.

Além das credenciais S3, configure o CORS do bucket para a origem web. Exemplo para a configuração
JSON de CORS do Amazon S3, substituindo a origem pela da instalação:

```json
[
  {
    "AllowedOrigins": ["https://financas.exemplo.com"],
    "AllowedMethods": ["PUT", "GET", "HEAD"],
    "AllowedHeaders": ["Content-Type"],
    "MaxAgeSeconds": 300
  }
]
```

Em um serviço compatível, aplique a configuração equivalente e permita as requisições de preflight
do navegador. `CORS_ORIGIN` configura somente a API; não configura o bucket. O endpoint do storage
precisa ser acessível pelo navegador e pela API, usando HTTPS em produção. Preserve o bucket
privado: URLs assinadas autorizam o acesso temporário sem tornar objetos públicos.

A credencial da API precisa permitir gravar, consultar, ler, copiar e excluir os objetos de anexos.
Valide um upload e um download pela origem HTTPS real; um erro de CORS pode impedir o envio mesmo
quando as credenciais da API estão corretas.

## Backup e restauração operacional

O OpenMonetis não cria nem restaura backups pela interface. A recuperação completa da instalação
depende de três conjuntos preservados pela infraestrutura:

- dump do PostgreSQL;
- objetos do bucket privado de anexos, mantendo as mesmas chaves;
- segredos e configuração da implantação, armazenados fora do banco e do próprio backup.

Para obter um ponto consistente entre banco e storage, interrompa escritas durante a cópia. Em uma
instalação pelo Compose, pare a API, o worker e o web, mantendo o PostgreSQL disponível:

```bash
docker compose stop api recurring-worker web
```

Escolha o procedimento conforme a conexão usada pela aplicação. Com `EXTERNAL_DATABASE_URL`
preenchida, API e migrator usam o servidor externo; o serviço `db` pode continuar em execução,
mas não é o banco usado pela aplicação. Não use os comandos de banco local nesse caso.

### Backup do PostgreSQL local do Compose

Sem `EXTERNAL_DATABASE_URL`, gere o dump no formato custom:

```bash
docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' \
  > openmonetis-$(date +%Y%m%d-%H%M%S).dump
```

### Backup do PostgreSQL externo

Use `pg_dump`, `pg_restore` e `psql` instalados em um host com acesso ao servidor externo. Prefira
clientes da mesma versão principal do PostgreSQL. Exporte `PGHOST`, `PGPORT`, `PGDATABASE` e
`PGUSER` com o mesmo destino de `EXTERNAL_DATABASE_URL`, além das opções TLS exigidas pelo provedor,
como `PGSSLMODE` e `PGSSLROOTCERT`. Autentique com um arquivo `.pgpass` ou `PGPASSFILE`, protegido
com permissão `0600` em sistemas Unix; não coloque a URL com senha na linha de comando.

Antes do dump, confirme o servidor, o banco e o usuário efetivos. Esses comandos usam as variáveis
de conexão do cliente PostgreSQL configuradas acima; não leem `EXTERNAL_DATABASE_URL` automaticamente:

```bash
psql -X --set=ON_ERROR_STOP=1 \
  --command='SELECT current_database(), current_user, inet_server_addr(), inet_server_port();'
pg_dump -Fc > openmonetis-$(date +%Y%m%d-%H%M%S).dump
```

### Conclusão do backup e restauração

Confirme que `pg_dump` terminou com código de saída zero antes de considerar o dump válido. Uma
falha pode deixar um arquivo vazio ou incompleto.

Copie o bucket com a ferramenta do provedor e preserve, em um cofre separado, pelo menos as variáveis
de autenticação, conexão entre pessoas, Companion e storage. Depois que banco e objetos estiverem
seguros, reinicie os serviços:

```bash
docker compose up -d
```

O dump contém hashes de senha, passkeys, sessões e credenciais persistidas. Trate-o como segredo,
criptografe-o em repouso, mantenha-o fora do host da aplicação e aplique retenção. Registre junto ao
backup a versão do OpenMonetis e a versão principal do PostgreSQL.

Para restaurar, use uma instalação parada, um banco vazio e a mesma versão principal do PostgreSQL.
Restaure primeiro o dump no destino escolhido.

**Banco local do Compose**, sem `EXTERNAL_DATABASE_URL`:

```bash
docker compose exec -T db sh -c \
  'pg_restore --exit-on-error --no-owner --no-privileges -U "$POSTGRES_USER" -d "$POSTGRES_DB"' \
  < openmonetis-AAAAMMDD-HHMMSS.dump
```

**Banco externo:** configure novamente as variáveis do cliente PostgreSQL e o arquivo de senha,
agora para o banco vazio de destino. Confirme a conexão antes da restauração:

```bash
psql -X --set=ON_ERROR_STOP=1 \
  --command='SELECT current_database(), current_user, inet_server_addr(), inet_server_port();'
pg_restore --exit-on-error --no-owner --no-privileges --dbname="${PGDATABASE:?Defina o banco de destino}" \
  < openmonetis-AAAAMMDD-HHMMSS.dump
```

Mantenha `EXTERNAL_DATABASE_URL` alinhada ao banco restaurado antes de iniciar API, migrator e
worker. O comando no serviço `db` não restaura o servidor externo.

Depois, restaure o bucket nas mesmas chaves, recoloque os mesmos segredos e inicie a versão da
aplicação registrada no backup. Só então atualize a aplicação e deixe o migrator aplicar migrations
mais recentes.

Uma restauração sobrescreve dados e precisa ser planejada para o ambiente específico. Faça-a com os
serviços da aplicação parados, valide o banco de destino e preserve uma cópia do estado anterior.

Teste periodicamente o procedimento completo em outro ambiente. Um dump sem o bucket, sem os
segredos necessários ou nunca restaurado em teste não deve ser considerado um backup recuperável.

## Atualização

1. Leia as alterações da versão e revise as migrations.
2. Faça backup do banco e do storage.
3. Atualize o checkout para a tag publicada desejada e defina a mesma versão em `OPENMONETIS_VERSION`.
4. Atualize as imagens e acompanhe o migrator.

```bash
docker compose pull
docker compose up -d
docker compose ps
docker compose logs migrator
```

O migrator aplica migrations forward-only antes da API. Reverter apenas a tag da imagem não desfaz o
schema. Se uma versão anterior não for compatível com o schema novo, a recuperação exige uma versão
corretiva ou a restauração consciente de um backup.

## Verificação pós-deploy

- o web responde pela origem HTTPS pública;
- os headers de segurança foram validados;
- login, logout e cookies funcionam na mesma origem;
- `/robots.txt` responde sem erro;
- a API aparece saudável no Compose;
- o `recurring-worker` está em execução e sem falhas recorrentes nos logs;
- migrations foram concluídas;
- upload e download funcionam quando S3 está habilitado;
- uma rotina externa confirma e monitora backups.

## Checklist de produção

- [ ] Segredos são fortes, exclusivos e diferentes dos exemplos.
- [ ] `OPENMONETIS_URL`, `BETTER_AUTH_URL`, `WEB_URL` e `CORS_ORIGIN` usam a origem correta.
- [ ] HTTPS está ativo e HTTP redireciona para HTTPS.
- [ ] DNSSEC, CAA e DMARC foram configurados e validados no provedor DNS.
- [ ] PostgreSQL e API não estão expostos publicamente.
- [ ] O `recurring-worker` está ativo junto com a API.
- [ ] O bucket de anexos é privado.
- [ ] Backup do banco e storage foi testado.
- [ ] Uma versão explícita das imagens está configurada.
- [ ] Logs e espaço em disco são monitorados.
