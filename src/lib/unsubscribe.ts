import { createHmac, timingSafeEqual } from "crypto";
import { trackingBase } from "./trackingUrl";

// Link de "não quero mais receber" dos e-mails: o código é o id da pessoa assinado
// com o segredo da sessão, então não dá para adivinhar nem trocar por outra pessoa.
function sign(leadId: string): string | null {
  const secret = process.env.SESSION_SECRET;
  return secret ? createHmac("sha256", secret).update(`unsub:${leadId}`).digest("base64url").slice(0, 22) : null;
}

export function unsubscribeUrl(leadId: string): string | null {
  const base = trackingBase();
  const sig = sign(leadId);
  return base && sig ? `${base}/api/u/${leadId}.${sig}` : null;
}

export function leadIdFromUnsubscribeToken(token: string): string | null {
  const [leadId, sig, ...rest] = token.split(".");
  const expected = leadId ? sign(leadId) : null;
  if (rest.length || !sig || !expected || sig.length !== expected.length) return null;
  return timingSafeEqual(Buffer.from(sig), Buffer.from(expected)) ? leadId : null;
}
