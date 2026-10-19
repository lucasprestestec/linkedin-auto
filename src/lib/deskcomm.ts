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

// Endereço do CRM de WhatsApp: um só para todos os clientes (cada um é uma organização lá),
// então vem de uma constante; DESKCOMM_URL só existe para trocar de servidor sem mexer no código.
export const DEFAULT_DESKCOMM_URL = "https://crm.lucasprestes.com";
export function fixedDeskcommUrl(): string {
  const raw = process.env.DESKCOMM_URL?.trim();
  return (raw ? normalizeDeskcommUrl(raw) : null) ?? DEFAULT_DESKCOMM_URL;
}

// A chave de acesso de cada cliente fica cifrada no banco dele e é posta pela central, sem passar
// pela Vercel. DESKCOMM_TOKEN continua valendo, só como atalho que vence a do banco.
export function fixedDeskcommToken(): string | null {
  return process.env.DESKCOMM_TOKEN?.trim() || null;
}

export function deskcommConfigOf(s: Pick<Settings, "deskcommUrl" | "deskcommToken" | "deskcommChannelId">): DeskcommConfig | null {
  const url = fixedDeskcommUrl() ?? s.deskcommUrl;
  const fixedToken = fixedDeskcommToken();
  if (!url || (!fixedToken && !s.deskcommToken)) return null;
  try {
    return { url, token: fixedToken ?? open(s.deskcommToken!), channelId: s.deskcommChannelId };
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
    const needed = ["crm_start_conversation_and_send", "crm_send_whatsapp_message", "crm_list_conversations", "crm_get_conversation_history", "crm_get_conversation", "crm_list_whatsapp_channels", "crm_get_whatsapp_channel_qr"];
    const missingTools = needed.filter((n) => !names.has(n));
    const channelId = missingTools.length ? null : await detectChannelId(client);
    return { channelId, missingTools };
  });
}

// Pareamento do número pelo QR Code (ferramentas crm_list_whatsapp_channels e
// crm_get_whatsapp_channel_qr). O número em si nasce no Deskcomm, na implantação
// (criar canal exige administrador logado lá); aqui o cliente só escaneia.
export type WhatsappPairing =
  | { state: "none" } // nenhum número criado no Deskcomm ainda
  | { state: "connected"; phone: string | null }
  | { state: "pair" } // precisa escanear, mas ninguém pediu o QR ainda
  | { state: "qr"; qr: string } // imagem PNG em base64
  | { state: "waiting"; hint: string | null }; // sessão subindo / QR sendo gerado: tente de novo em segundos

// Escolhe o número do cliente entre os canais do Deskcomm e guarda a escolha.
// Um número que está funcionando ganha de um caído (o cliente pode ter conectado um número novo
// e deixado o antigo para trás); entre iguais, vale o que já estava guardado.
async function pickChannel(client: Rpc, cfg: DeskcommConfig) {
  const names = new Set(await client.listTools());
  if (!names.has("crm_list_whatsapp_channels") || !names.has("crm_get_whatsapp_channel_qr")) {
    throw new DeskcommError("Esta instalação do WhatsApp ainda não conecta por QR Code. Fale com o suporte.");
  }
  const { channels } = await client.call<{ channels: { channel_session_id: string; phone_number: string | null; status: string; has_session: boolean }[] }>("crm_list_whatsapp_channels", {});
  const saved = channels.find((c) => c.channel_session_id === cfg.channelId);
  const ch = (saved?.status === "WORKING" ? saved : channels.find((c) => c.status === "WORKING")) ?? saved ?? channels.find((c) => c.has_session) ?? channels[0];
  if (ch && ch.channel_session_id !== cfg.channelId) {
    await prisma.settings.update({ where: { id: "singleton" }, data: { deskcommChannelId: ch.channel_session_id } });
  }
  return { ch, names };
}

// Desconectar (reconnect=false) ou trocar de número (reconnect=true: desloga e fica esperando um QR novo).
// O canal e as conversas continuam os mesmos; só o celular muda.
export async function resetWhatsapp(cfg: DeskcommConfig, reconnect: boolean): Promise<void> {
  await withClient(cfg, async (client) => {
    const { ch, names } = await pickChannel(client, cfg);
    if (!ch) throw new DeskcommError("Nenhum número de WhatsApp foi criado ainda. Fale com o suporte.");
    if (!names.has("crm_reset_whatsapp_channel")) {
      throw new DeskcommError("Esta instalação do WhatsApp ainda não permite desconectar ou trocar o número por aqui. Fale com o suporte.");
    }
    await client.call("crm_reset_whatsapp_channel", { channel_session_id: ch.channel_session_id, reconnect });
  });
}

export async function whatsappPairing(cfg: DeskcommConfig, withQr: boolean): Promise<WhatsappPairing> {
  return withClient(cfg, async (client) => {
    const { ch } = await pickChannel(client, cfg);
    if (!ch) return { state: "none" };
    if (ch.status === "WORKING") return { state: "connected", phone: ch.phone_number };
    if (!withQr) return { state: "pair" };
    const r = await client.call<{ status: string; qr_png_base64: string | null; message?: string }>("crm_get_whatsapp_channel_qr", { channel_session_id: ch.channel_session_id });
    if (r.status === "WORKING") return { state: "connected", phone: ch.phone_number };
    return r.qr_png_base64 ? { state: "qr", qr: r.qr_png_base64 } : { state: "waiting", hint: r.message ?? null };
  });
}

// Estado real do número para a lista de Ajustes. Tempo curto: a tela não espera o Deskcomm.
export async function whatsappLiveStatus(cfg: DeskcommConfig): Promise<"connected" | "down" | "unknown"> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const r = await Promise.race([
      whatsappPairing(cfg, false),
      new Promise<never>((_, reject) => (timer = setTimeout(() => reject(new Error("timeout")), 4000))),
    ]);
    return r.state === "connected" ? "connected" : "down";
  } catch {
    return "unknown";
  } finally {
    clearTimeout(timer);
  }
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
