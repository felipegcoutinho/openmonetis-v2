# Segredo dos tokens do Companion

`DEVICE_TOKEN_SECRET` protege as credenciais usadas pelos dispositivos OpenMonetis Companion. Ele é
um segredo da instalação e não deve ser enviado ao cliente, registrado em logs ou armazenado no
repositório.

## Geração

Gere um valor aleatório exclusivo para produção:

```bash
openssl rand -base64 48
```

Configure-o no ambiente da API:

```dotenv
DEVICE_TOKEN_SECRET=<valor-gerado>
```

Não reutilize `BETTER_AUTH_SECRET`, `PERSON_CONNECTION_SECRET`, senha do PostgreSQL ou credenciais do
storage.

## Efeito da rotação

Os tokens persistidos são derivados do segredo da instalação. Alterar `DEVICE_TOKEN_SECRET` invalida
as credenciais existentes: os registros podem continuar visíveis, mas os dispositivos não conseguirão
autenticar novas requisições.

Depois de uma rotação:

1. revogue os tokens antigos na interface;
2. crie uma credencial nova para cada dispositivo;
3. atualize o Companion com o novo token exibido;
4. confirme o recebimento de um item de teste no inbox.

O token completo é exibido apenas na criação. Se ele for perdido, crie outro; não existe fluxo para
recuperar o valor anterior.

## Quando rotacionar

- suspeita de exposição do `.env` ou do ambiente da API;
- acesso indevido ao host, logs ou sistema de secrets;
- cópia de produção usada fora do ambiente autorizado;
- troca planejada segundo a política operacional da instalação.

Não altere o segredo durante uma atualização comum sem planejar o recadastro dos dispositivos.

## Diagnóstico

Se todos os dispositivos deixarem de autenticar ao mesmo tempo, confirme se:

- `DEVICE_TOKEN_SECRET` está presente no container da API;
- o valor não foi alterado por substituição de `.env` ou secret manager;
- espaços ou quebras de linha não foram adicionados;
- a API e os dispositivos apontam para a mesma instalação.

Nunca imprima o segredo ou tokens completos para diagnosticar o problema.
