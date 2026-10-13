# Mudança necessária no Deskcomm: áudio, foto e vídeo recebidos

**Por que:** para o assistente entender o áudio, a foto ou o vídeo que o lead manda, o sistema precisa **baixar o arquivo**.
Hoje a ferramenta `crm_get_conversation_history` do Deskcomm só informa que a mensagem é um áudio e devolve o endereço
**interno** do gateway (`media_url`), que não funciona fora dele. Sem esta mudança, o sistema continua se comportando como antes:
passa a conversa pro corretor quando o lead manda mídia (nada quebra).

**O que muda:** a ferramenta passa a devolver, para cada mensagem com mídia, o tipo (`media_mime`), o tamanho
(`media_size_bytes`), o estado (`media_status`: `ready`, `pending` ou `none`) e um **link temporário de 1 hora**
(`media_signed_url`) do arquivo já guardado. É a mesma validade e o mesmo bucket (`whatsapp-media`) que a rota
`/api/v1/messages/[id]/media` já usa. Os campos que existiam continuam iguais.

Arquivo: `historico-com-midia.patch` (altera `lib/mcp/tools/conversations.ts` e acrescenta um teste).
Foi conferido que ele se aplica limpo na versão 1.67.0 (`14e2953bd`) e a função nova foi testada isoladamente (6 verificações).
**Não foi rodado dentro do repositório do Deskcomm.**

## Como aplicar (quem cuida do Deskcomm)

```bash
cd DeskcommCRM
git checkout -b feat/mcp-historico-com-midia   # se já existir uma com esse nome (meia-feita), veja a nota abaixo
git apply ../Linkedin_AUTO/docs/deskcomm/historico-com-midia.patch
npm run test:unit -- lib/mcp/tools/conversations-historico-midia.test.ts
```

Depois, o deploy normal do Deskcomm. Não precisa de migração de banco.

> **Nota:** durante o trabalho, ficou na máquina de desenvolvimento uma branch local `feat/mcp-historico-com-midia` do Deskcomm com **metade**
> da mudança, sem commit. Para aplicar o patch inteiro, descarte antes essa metade (`git checkout -- lib/mcp/tools/conversations.ts`).

## Como conferir depois do deploy

1. Mande um **áudio** do seu celular para o número do WhatsApp conectado.
2. Em poucos minutos, em Conversas, a mensagem deve aparecer como `[Áudio] ...` com o texto do que foi dito, e o assistente responde a ele.
3. Se aparecer "Mandou um áudio que não consegui entender", o motivo vem entre parênteses (arquivo indisponível, sem fala etc.).
