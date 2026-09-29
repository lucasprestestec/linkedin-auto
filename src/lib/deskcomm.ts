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

export function deskcommConfigOf(s: Pick<Settings, "deskcommUrl" | "deskcommToken" | "deskcommChannelId">): DeskcommConfig | null {
  if (!s.deskcommUrl || !s.deskcommToken) return null;
  try {
    return { url: s.deskcommUrl, token: open(s.deskcommToken), channelId: s.deskcommChannelId };
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
    throw new DeskcommError(`Não foi possível falar com o Deskcomm (${msg}). Confira o endereço e se ele está no ar.`);
  }
  if (res.status === 401 || res.status === 403) throw new DeskcommError("O Deskcomm recusou o token. Confira se ele está ativo e com os escopos de MCP.");
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
    if (msg.error) throw new DeskcommError(`Deskcomm: ${msg.error.message ?? "erro"}`);
    return msg.result;
  }
  if (!res.ok) throw new DeskcommError(`O Deskcomm respondeu ${res.status}. Confira o endereço (${cfg.url}).`);
  throw new DeskcommError("O Deskcomm respondeu num formato inesperado.");
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
      if (r.isError) throw new DeskcommError(`Deskcomm (${name}): ${text ?? "erro"}`);
      if (r.structuredContent) return r.structuredContent as T;
      try {
        return JSON.parse(text ?? "null") as T;
      } catch {
        throw new DeskcommError(`Deskcomm (${name}) respondeu num formato inesperado.`);
      }
    },
  });
}

// Conectar: confere endereço + token e descobre o canal (número) olhando uma
// conversa existente. Sem nenhuma conversa ainda, o canal fica pra informar.
export async function inspectDeskcomm(cfg: Pick<DeskcommConfig, "url" | "token">): Promise<{ channelId: string | null; missingTools: string[] }> {
  return withClient(cfg, async (client) => {
    const names = new Set(await client.listTools());
    const needed = ["crm_start_conversation_and_send", "crm_send_whatsapp_message", "crm_list_conversations", "crm_get_conversation_history", "crm_get_conversation"];
    const missingTools = needed.filter((n) => !names.has(n));
    let channelId: string | null = null;
    if (!missingTools.length) {
      const list = await client.call<{ conversations: { id: string; is_group?: boolean }[] }>("crm_list_conversations", { limit: 10 });
      const first = list.conversations.find((c) => !c.is_group);
      if (first) {
        const conv = await client.call<{ channel_session_id?: string | null }>("crm_get_conversation", { conversation_id: first.id });
        channelId = conv.channel_session_id ?? null;
      }
    }
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

// Manda uma mensagem pro número da ficha. Primeira vez abre a conversa no
// canal configurado; depois segue na mesma conversa.
export async function sendWhatsapp(input: { conversationId: string | null; phone: string; name: string | null; body: string; idempotencyKey: string }): Promise<SentWhatsapp> {
  const cfg = await deskcommConfig();
  if (!cfg) throw new DeskcommError("WhatsApp (Deskcomm) não conectado.");
  return withClient(cfg, async (client) => {
    if (input.conversationId) {
      const r = await client.call<{ message_id: string; sent_at?: string | null }>("crm_send_whatsapp_message", {
        conversation_id: input.conversationId,
        body: input.body,
        idempotency_key: input.idempotencyKey,
      });
      return { conversationId: input.conversationId, messageId: r.message_id, sentAt: r.sent_at ? new Date(r.sent_at) : new Date() };
    }
    if (!cfg.channelId) throw new DeskcommError("Falta escolher o número (canal) do Deskcomm de onde as conversas novas saem. Veja em Canais.");
    const r = await client.call<{ conversation_id: string; message_id: string; sent_at?: string | null }>("crm_start_conversation_and_send", {
      channel_session_id: cfg.channelId,
      phone_number: `+${input.phone.replace(/\D/g, "")}`,
      ...(input.name ? { name: input.name } : {}),
      body: input.body,
      idempotency_key: input.idempotencyKey,
    });
    return { conversationId: r.conversation_id, messageId: r.message_id, sentAt: r.sent_at ? new Date(r.sent_at) : new Date() };
  });
}

export interface WhatsappHistoryMessage {
  id: string;
  direction: "inbound" | "outbound" | string;
  type: string;
  body: string | null;
  sent_via?: string | null;
  sent_at: string | null;
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
