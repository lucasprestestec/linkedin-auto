import type { Settings } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { open, seal } from "@/lib/secretBox";

// WhatsApp pelo Deskcomm (o CRM do WhatsApp do corretor), via o servidor MCP
// dele em <url>/api/mcp com um token de API (dsk_...). O Deskcomm cuida do
// número (WAHA) e da caixa de entrada; aqui a secretária só manda e lê.
//
// Ferramentas usadas:
//   crm_start_conversation_and_send — primeira mensagem (abre a conversa no canal escolhido)
//   crm_send_whatsapp_message       — mensagem numa conversa que já existe
//   crm_list_conversations          — o que mudou desde a última leitura
//   crm_get_conversation_history    — mensagens de uma conversa (ordem cronológica)
//   crm_get_conversation            — descobre o canal (número) de uma conversa

export interface DeskcommConfig {
  url: string;
  token: string;
  channelId: string | null;
}

// Endereco unico do servidor de WhatsApp (DESKCOMM_URL). Quando definido, o cliente
// nao informa endereco nenhum: so a chave. Mudar de servidor vira trocar uma variavel.
export function fixedDeskcommUrl(): string | null {
  const raw = process.env.DESKCOMM_URL?.trim();
  return raw ? normalizeDeskcommUrl(raw) : null;
}

export function deskcommConfigOf(s: Pick<Settings, "deskcommUrl" | "deskcommToken" | "deskcommChannelId">): DeskcommConfig | null {
  const url = fixedDeskcommUrl() ?? s.deskcommUrl;
  if (!url || !s.deskcommToken) return null;
  try {
    return { url, token: open(s.deskcommToken), channelId: s.deskcommChannelId };
  } catch {
    return null;
  }
}

export async function deskcommConfig(): Promise<DeskcommConfig | null> {
  const s = await prisma.settings.findUnique({ where: { id: "singleton" }, select: { deskcommUrl: true, deskcommToken: true, deskcommChannelId: true } });
  return s ? deskcommConfigOf(s) : null;
}

// "http://localhost:3000/", "https://x.trycloudflare.com/app" → base sem barra final.
export function normalizeDeskcommUrl(raw: string): string | null {
  try {
    const u = new URL(raw.trim());
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    return `${u.origin}`;
  } catch {
    return null;
  }
}

export class DeskcommError extends Error {}

// Cliente MCP mínimo (JSON-RPC por POST no transporte "Streamable HTTP").
// O servidor do Deskcomm é stateless: cada POST é independente, então não há
// sessão nem canal de escuta aberto — só pedido e resposta, com tempo limite.
const PROTOCOL_VERSION = "2025-06-18";
const TIMEOUT_MS = 20_000;

interface Rpc {
  call<T>(name: string, args: Record<string, unknown>): Promise<T>;
  listTools(): Promise<string[]>;
}

async function rpcRequest(cfg: Pick<DeskcommConfig, "url" | "token">, method: string, params: Record<string, unknown>, id: number) {
  let res: Response;
  try {
    res = await fetch(new URL("/api/mcp", cfg.url), {
      method: "POST",
      headers: {
        authorization: `Bearer ${cfg.token}`,
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
        "mcp-protocol-version": PROTOCOL_VERSION,
      },
      body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new DeskcommError(`Não foi possível falar com o WhatsApp (${msg}). Confira o endereço e se ele está no ar.`);
  }
  if (res.status === 401 || res.status === 403) throw new DeskcommError("O WhatsApp recusou a chave. Confira se ele está ativo.");
  const text = await res.text();
  // A resposta vem como JSON ou como SSE ("data: {...}").
  const payloads = (res.headers.get("content-type") ?? "").includes("text/event-stream")
    ? text
        .split("\n")
        .filter((l) => l.startsWith("data:"))
        .map((l) => l.slice(5).trim())
    : [text];
  for (const p of payloads) {
    let msg: { id?: number; result?: unknown; error?: { message?: string } };
    try {
      msg = JSON.parse(p);
    } catch {
      continue;
    }
    if (msg.id !== id) continue;
    if (msg.error) throw new DeskcommError(`WhatsApp: ${msg.error.message ?? "erro"}`);
    return msg.result;
  }
  if (!res.ok) throw new DeskcommError(`O WhatsApp respondeu ${res.status}. Confira o endereço (${cfg.url}).`);
  throw new DeskcommError("O WhatsApp respondeu num formato inesperado.");
}

async function withClient<T>(cfg: Pick<DeskcommConfig, "url" | "token">, fn: (client: Rpc) => Promise<T>): Promise<T> {
  let seq = 0;
  // Apresenta-se uma vez (valida endereço e token antes de qualquer ação).
  await rpcRequest(cfg, "initialize", { protocolVersion: PROTOCOL_VERSION, capabilities: {}, clientInfo: { name: "linkedin-auto-secretaria", version: "1.0.0" } }, ++seq);
  return fn({
    async listTools() {
      const r = (await rpcRequest(cfg, "tools/list", {}, ++seq)) as { tools?: { name: string }[] };
      return (r.tools ?? []).map((t) => t.name);
    },
    async call<T>(name: string, args: Record<string, unknown>) {
      const r = (await rpcRequest(cfg, "tools/call", { name, arguments: args }, ++seq)) as {
        isError?: boolean;
        content?: { type: string; text?: string }[];
        structuredContent?: unknown;
      };
      const text = r.content?.find((c) => c.type === "text")?.text;
      if (r.isError) throw new DeskcommError(`WhatsApp (${name}): ${text ?? "erro"}`);
      if (r.structuredContent) return r.structuredContent as T;
      try {
        return JSON.parse(text ?? "null") as T;
      } catch {
        throw new DeskcommError(`WhatsApp (${name}) respondeu num formato inesperado.`);
      }
    },
  });
}

// O canal (número) de onde as conversas novas saem só aparece olhando uma
// conversa que já existe. Sem nenhuma conversa ainda, não há como descobrir.
async function detectChannelId(client: Rpc): Promise<string | null> {
  const list = await client.call<{ conversations: { id: string; is_group?: boolean }[] }>("crm_list_conversations", { limit: 10 });
  const first = list.conversations.find((c) => !c.is_group);
  if (!first) return null;
  const conv = await client.call<{ channel_session_id?: string | null }>("crm_get_conversation", { conversation_id: first.id });
  return conv.channel_session_id ?? null;
}

// Conectar: confere endereço + token e tenta descobrir o canal.
export async function inspectDeskcomm(cfg: Pick<DeskcommConfig, "url" | "token">): Promise<{ channelId: string | null; missingTools: string[] }> {
  return withClient(cfg, async (client) => {
    const names = new Set(await client.listTools());
    const needed = ["crm_start_conversation_and_send", "crm_send_whatsapp_message", "crm_list_conversations", "crm_get_conversation_history", "crm_get_conversation"];
    const missingTools = needed.filter((n) => !names.has(n));
    const channelId = missingTools.length ? null : await detectChannelId(client);
    return { channelId, missingTools };
  });
}

export async function saveDeskcommConnection(url: string, token: string, channelId: string | null) {
  await prisma.settings.update({
    where: { id: "singleton" },
    data: { deskcommUrl: url, deskcommToken: seal(token), deskcommChannelId: channelId },
  });
}

export interface SentWhatsapp {
  conversationId: string;
  messageId: string;
  sentAt: Date;
}

// O Deskcomm grava a mensagem antes de entregar, então uma recusa (ex.: modo de
// teste do canal) volta como chamada bem-sucedida com status "failed". Aqui
// vira erro legível — levando a conversa, que já existe lá.
export class WhatsappNotSentError extends DeskcommError {
  constructor(public readonly conversationId: string) {
    super(
      "O WhatsApp recusou o envio. Se o número estiver em modo de teste, autorize o destino em Conexões → Configurar acesso da IA; o motivo aparece na conversa dentro do sistema de WhatsApp.",
    );
  }
}

// Manda uma mensagem pro número da ficha. Primeira vez abre a conversa no
// canal configurado; depois segue na mesma conversa.
export async function sendWhatsapp(input: { conversationId: string | null; phone: string; name: string | null; body: string; idempotencyKey: string }): Promise<SentWhatsapp> {
  const cfg = await deskcommConfig();
  if (!cfg) throw new DeskcommError("WhatsApp não conectado.");
  return withClient(cfg, async (client) => {
    if (input.conversationId) {
      const r = await client.call<{ message_id: string; status?: string; sent_at?: string | null }>("crm_send_whatsapp_message", {
        conversation_id: input.conversationId,
        body: input.body,
        idempotency_key: input.idempotencyKey,
      });
      if (r.status === "failed") throw new WhatsappNotSentError(input.conversationId);
      return { conversationId: input.conversationId, messageId: r.message_id, sentAt: r.sent_at ? new Date(r.sent_at) : new Date() };
    }
    let channelId = cfg.channelId;
    if (!channelId) {
      // Ainda não sabíamos o número: tenta descobrir agora, e guarda para as próximas.
      channelId = await detectChannelId(client);
      if (!channelId) throw new DeskcommError("Ainda não achei o número do WhatsApp. Fale com o suporte para concluir a configuração.");
      await prisma.settings.update({ where: { id: "singleton" }, data: { deskcommChannelId: channelId } });
    }
    const r = await client.call<{ conversation_id: string; message_id: string; status?: string; sent_at?: string | null }>("crm_start_conversation_and_send", {
      channel_session_id: channelId,
      phone_number: `+${input.phone.replace(/\D/g, "")}`,
      ...(input.name ? { name: input.name } : {}),
      body: input.body,
      idempotency_key: input.idempotencyKey,
    });
    if (r.status === "failed") throw new WhatsappNotSentError(r.conversation_id);
    return { conversationId: r.conversation_id, messageId: r.message_id, sentAt: r.sent_at ? new Date(r.sent_at) : new Date() };
  });
}

// Manda uma MENSAGEM DE VOZ numa conversa que já existe (áudio, foto e vídeo só vão em conversa
// aberta). O Deskcomm baixa o arquivo pelo endereço público e converte pro formato do WhatsApp.
export async function sendWhatsappAudio(input: { conversationId: string; mediaUrl: string; mime: string; idempotencyKey: string }): Promise<SentWhatsapp> {
  const cfg = await deskcommConfig();
  if (!cfg) throw new DeskcommError("WhatsApp não conectado.");
  return withClient(cfg, async (client) => {
    const r = await client.call<{ message_id: string; status?: string; sent_at?: string | null }>("crm_send_whatsapp_message", {
      conversation_id: input.conversationId,
      type: "audio",
      media_url: input.mediaUrl,
      media_mime: input.mime,
      idempotency_key: input.idempotencyKey,
    });
    if (r.status === "failed") throw new WhatsappNotSentError(input.conversationId);
    return { conversationId: input.conversationId, messageId: r.message_id, sentAt: r.sent_at ? new Date(r.sent_at) : new Date() };
  });
}

export interface WhatsappHistoryMessage {
  id: string;
  direction: "inbound" | "outbound" | string;
  type: string;
  body: string | null;
  sent_via?: string | null;
  // Estado da entrega (sending, sent, delivered, read, failed). "failed" = o WhatsApp recusou: não saiu.
  status?: string | null;
  sent_at: string | null;
  // Mídia (áudio, foto, vídeo). O Deskcomm entrega um link temporário do arquivo quando já o guardou
  // (media_status "ready"); "pending" = ainda guardando, tente de novo; ausente/"none" = sem mídia ou
  // uma versão do Deskcomm que ainda não entrega o arquivo.
  media_mime?: string | null;
  media_size_bytes?: number | null;
  media_status?: "none" | "pending" | "ready" | string;
  media_signed_url?: string | null;
}

// Conversas que tiveram mensagem nova desde `since` (entre as conhecidas) e
// o histórico recente de cada uma.
export async function fetchWhatsappUpdates(
  known: Map<string, Date | null>,
): Promise<{ conversationId: string; lastAt: Date; messages: WhatsappHistoryMessage[] }[]> {
  const cfg = await deskcommConfig();
  if (!cfg || known.size === 0) return [];
  return withClient(cfg, async (client) => {
    const list = await client.call<{ conversations: { id: string; last_message_at: string | null }[] }>("crm_list_conversations", { limit: 50 });
    const changed = list.conversations.filter((c) => {
      if (!known.has(c.id) || !c.last_message_at) return false;
      const seen = known.get(c.id);
      return !seen || new Date(c.last_message_at) > seen;
    });
    const out: { conversationId: string; lastAt: Date; messages: WhatsappHistoryMessage[] }[] = [];
    for (const c of changed) {
      const h = await client.call<{ messages: WhatsappHistoryMessage[] }>("crm_get_conversation_history", { conversation_id: c.id, limit: 20 });
      out.push({ conversationId: c.id, lastAt: new Date(c.last_message_at!), messages: h.messages });
    }
    return out;
  });
}
