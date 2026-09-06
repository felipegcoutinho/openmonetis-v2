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

```bash
docker compose pull
docker compose up -d
docker compose ps
```

A inicialização respeita esta ordem:

```text
db saudável -> migrator concluído -> API e worker mensal iniciados -> web iniciado
```

Verifique os logs se algum serviço não alcançar o estado esperado:

```bash
docker compose logs migrator
docker compose logs api
docker compose logs recurring-worker
docker compose logs web
```

O `recurring-worker` sincroniza diariamente os lançamentos recorrentes compartilhados. Boletos são
disponibilizados no primeiro dia do mês do vencimento; cartão e demais meios ficam disponíveis na
data de cada ocorrência. Se o serviço estiver indisponível no momento previsto, a execução seguinte
recupera somente ocorrências que já eram elegíveis, sem criar duplicidades nem tornar retroativas
recorrências ou conexões iniciadas depois da data de envio.

Somente a porta do web deve ser publicada externamente. A porta do PostgreSQL fornecida pelo Compose
fica vinculada a `127.0.0.1`; mantenha essa restrição ou remova completamente o mapeamento no host de
produção.

## HTTPS e proxy reverso

O proxy deve:

- terminar TLS com um certificado válido;
- encaminhar todos os paths para o web na porta configurada por `APP_PORT`;
- preservar `Host`, protocolo e cookies;
- aceitar os tamanhos necessários para uploads configurados;
- redirecionar HTTP para HTTPS.

Não encaminhe `/api-proxy` diretamente para o container da API. O web implementa o proxy same-origin
e adiciona o contexto esperado pela aplicação.

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

Em seguida, gere o dump no formato custom:

```bash
docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' \
  > openmonetis-$(date +%Y%m%d-%H%M%S).dump
```

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
Restaure primeiro o dump:

```bash
docker compose exec -T db sh -c \
  'pg_restore --exit-on-error --no-owner --no-privileges -U "$POSTGRES_USER" -d "$POSTGRES_DB"' \
  < openmonetis-AAAAMMDD-HHMMSS.dump
```

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
3. Defina uma versão explícita em `OPENMONETIS_VERSION`.
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
