import { createHmac, timingSafeEqual } from "node:crypto";

// Confere o aviso que o Deskcomm manda quando chega mensagem (ação "Chamar webhook" de uma regra).
// Cabeçalhos dele: X-Webhook-Timestamp, X-Webhook-Delivery e X-Webhook-Signature = "t=<ts>,v1=<hex>",
// onde hex = HMAC-SHA256(segredo, "<ts>.<delivery>.<corpo>"). A hora entra na conta, então um aviso
// capturado e repetido depois da janela é recusado.
const WINDOW_SECONDS = 300;

export function verifyDeskcommSignature(
  rawBody: string,
  headers: { signature: string | null; delivery: string | null },
  secret: string | undefined,
  nowSeconds = Math.floor(Date.now() / 1000),
): boolean {
  if (!secret || !headers.signature || !headers.delivery) return false;
  const parts = Object.fromEntries(headers.signature.split(",").map((p) => p.trim().split("=", 2) as [string, string]));
  const ts = Number(parts.t);
  const given = parts.v1;
  if (!Number.isInteger(ts) || !given || Math.abs(nowSeconds - ts) > WINDOW_SECONDS) return false;
  const expected = createHmac("sha256", secret).update(`${ts}.${headers.delivery}.${rawBody}`).digest("hex");
  const a = Buffer.from(given, "hex");
  const b = Buffer.from(expected, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

// Id da conversa dentro do aviso "message.received" (envelope {event, data: {conversation_id, ...}}).
export function conversationIdOf(rawBody: string): string | null {
  try {
    const body = JSON.parse(rawBody) as { event?: unknown; data?: { conversation_id?: unknown } };
    if (body.event !== "message.received") return null;
    const id = body.data?.conversation_id;
    return typeof id === "string" && id ? id : null;
  } catch {
    return null;
  }
}
