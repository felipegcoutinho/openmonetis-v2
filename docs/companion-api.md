# Contrato de compatibilidade do Companion

Este documento descreve o protocolo legado usado pelo OpenMonetis Companion Android. A referência de
compatibilidade atual é o Companion `1.0.4`. O OpenAPI publicado em `/openapi.json` é o contrato de
máquina; este documento registra as exceções, os limites operacionais e a política de evolução.

Somente estas rotas pertencem à integração:

- `GET /api/health`;
- `POST /api/auth/device/verify`;
- `POST /api/inbox`;
- `POST /api/inbox/batch`.

Outras rotas sob `/api/auth/*` pertencem ao Better Auth. O cliente web não consome as rotas do
Companion; em produção, a URL configurada no Android é a origem HTTPS pública do OpenMonetis, cujo
servidor web encaminha `/api/*` para a API privada.

## Autenticação

O Companion envia `Authorization: Bearer <device-token>`. O token:

- é criado por uma sessão web autenticada em `POST /device-tokens`;
- é exibido uma única vez pelo servidor;
- usa o prefixo `opm_`, 256 bits de aleatoriedade e validade de 365 dias;
- pode ser revogado independentemente;
- autoriza apenas verificação da própria credencial e ingestão no inbox;
- é persistido no servidor somente como digest HMAC-SHA-256.

Cada usuário pode manter até dez tokens ativos. Credenciais ausentes, inválidas, expiradas ou
malformadas retornam HTTP `401`:

```json
{ "valid": false, "error": "Token inválido ou expirado" }
```

O identificador do proprietário, o digest, o segredo da instalação e detalhes internos nunca são
retornados. A API não oferece refresh token em `/api/auth/device/refresh`: após expiração ou revogação,
o usuário deve gerar uma nova credencial pela sessão web.

### Pareamento por QR Code

Após criar uma credencial, o cliente web gera localmente um QR Code com o payload versionado:

```text
openmonetis://companion/token?v=1&token=opm_<credencial>
```

O Companion aceita somente o scheme `openmonetis`, host `companion`, path `/token`, versão `1` e um
token no formato oficial. Parâmetros adicionais, versões desconhecidas e tokens malformados são
rejeitados. O token puro continua aceito como fallback para entrada manual.

O payload é uma credencial secreta: não deve ser enviado a serviços externos de geração de QR,
registrado em logs ou mantido após o fechamento do modal. O leitor interno interpreta o conteúdo sem
abrir o URI em outro aplicativo.

## Health e verificação

`GET /api/health` é público e retorna HTTP `200`, sem envelope:

```json
{
  "status": "ok",
  "name": "OpenMonetis",
  "version": "0.1.0",
  "timestamp": "2026-08-10T12:00:00.000Z"
}
```

`POST /api/auth/device/verify` exige o Bearer token e retorna HTTP `200`:

```json
{
  "valid": true,
  "tokenId": "00000000-0000-4000-8000-000000000000",
  "tokenName": "Celular pessoal",
  "expiresAt": "2027-08-10T12:00:00.000Z"
}
```

## Ingestão individual

`POST /api/inbox` aceita JSON estrito com:

| Campo | Obrigatório | Limite |
| --- | --- | --- |
| `sourceApp` | sim | 255 caracteres; somente letras, números, `.`, `_` e `-` |
| `sourceAppName` | não | 255 caracteres |
| `originalTitle` | não | 500 caracteres |
| `originalText` | sim | 2.000 caracteres |
| `notificationTimestamp` | sim | ISO 8601 com offset |
| `timestampFormatVersion` | não | `2` para timestamps que representam um instante UTC real |
| `parsedName` | não | 160 caracteres |
| `parsedAmount` | não | maior que zero e no máximo `999999999.99` |
| `clientId` | não | 255 caracteres |

O timestamp pode ter no máximo 365 dias no passado e dez minutos no futuro. O Companion até a versão
`1.5.2` enviava o relógio local de Brasília com o sufixo `Z`; quando `timestampFormatVersion` está
ausente, a API mantém essa interpretação legada. Clientes corrigidos enviam
`timestampFormatVersion: 2`, e o timestamp passa a ser interpretado como o instante ISO 8601 informado.
O corpo HTTP pode ter no máximo 16 KiB.

Uma ingestão aceita retorna HTTP `201`, inclusive em repetição idempotente:

```json
{
  "id": "00000000-0000-4000-8000-000000000000",
  "clientId": "notification-123",
  "message": "Notificação recebida"
}
```

Quando `clientId` não é enviado, a API deriva um identificador legado do conteúdo normalizado. Reusar
um identificador com o mesmo conteúdo retorna o registro existente; reutilizá-lo com conteúdo diferente
retorna HTTP `409`.

## Ingestão em lote

`POST /api/inbox/batch` recebe `{ "items": [...] }`, com um a cinquenta itens e corpo de até 256 KiB.
O envelope e todos os itens passam pela validação estrutural antes do service; portanto, um item
estruturalmente inválido rejeita o lote inteiro com HTTP `400`.

Depois da validação, conflitos esperados são informados individualmente em `results`. O lote retorna
HTTP `201`:

```json
{
  "message": "1 notificações processadas, 1 falharam",
  "total": 2,
  "success": 1,
  "failed": 1,
  "results": [
    {
      "clientId": "notification-123",
      "serverId": "00000000-0000-4000-8000-000000000000",
      "success": true,
      "error": null
    },
    {
      "clientId": "notification-124",
      "serverId": null,
      "success": false,
      "error": "inbox_idempotency_conflict"
    }
  ]
}
```

Falhas inesperadas abortam a requisição com erro genérico e são registradas somente no servidor; códigos
internos do PostgreSQL ou stack traces não fazem parte do contrato público.

## Erros e limites

Erros das rotas de inbox usam `{ "error": "mensagem" }`, sem o envelope padrão do OpenMonetis:

- `400`: payload inválido;
- `409`: conflito de idempotência;
- `413`: corpo acima do limite;
- `429`: limite de requisições;
- `500`: falha interna genérica.

A verificação permite vinte tentativas por minuto. A ingestão permite cem requisições individuais ou
vinte lotes por minuto por token, além do limite global da instalação. Respostas privadas usam
`Cache-Control: private, no-store`.

## Política de evolução

As demais rotas de domínio do OpenMonetis mantêm `{ data, error: null }` ou
`{ error: true, message, code? }`; Better Auth mantém seu próprio protocolo.

Qualquer alteração incompatível nas rotas acima exige uma destas opções:

1. comprovação por testes de contrato contra todas as versões suportadas do Companion; ou
2. uma nova versão sob `/api/v2/*`, mantendo as rotas atuais durante a janela de migração.

Quando a compatibilidade legado for encerrada, a remoção ou migração dessas rotas deve ocorrer em uma
mudança separada, registrada no changelog e validada nos dois repositórios.
