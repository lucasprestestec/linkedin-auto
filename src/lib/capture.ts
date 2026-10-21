import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { parseEmail, parsePhone } from "@/lib/contactFields";

// Formulário público de captação: quem preenche vira contato da campanha, com consentimento registrado.
// A página é aberta a qualquer pessoa, então as regras de entrada ficam todas aqui (e testadas).

const SLUG_CHARS = "abcdefghijkmnpqrstuvwxyz23456789"; // sem letras e números fáceis de confundir

export function newCaptureSlug(): string {
  const bytes = randomBytes(8);
  return Array.from(bytes, (b) => SLUG_CHARS[b % SLUG_CHARS.length]).join("");
}

export const isCaptureSlug = (v: unknown): v is string => typeof v === "string" && /^[a-z0-9]{6,16}$/.test(v);

// O formulário carrega um carimbo de quando a página foi aberta, assinado: robô que envia na hora (menos de 3 s) é ignorado.
const sign = (ts: string): string => createHmac("sha256", process.env.SESSION_SECRET ?? "dev").update(`capture:${ts}`).digest("base64url").slice(0, 22);

export function formToken(now = Date.now()): string {
  const ts = String(now);
  return `${ts}.${sign(ts)}`;
}

// Idade da página em milissegundos; null = carimbo inválido.
export function formTokenAge(token: unknown, now = Date.now()): number | null {
  if (typeof token !== "string") return null;
  const [ts, sig, ...rest] = token.split(".");
  if (rest.length || !ts || !sig || !/^\d{10,15}$/.test(ts)) return null;
  const expected = sign(ts);
  if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  return now - Number(ts);
}

export const MIN_FILL_MS = 3_000;
export const MAX_FILL_MS = 3 * 60 * 60 * 1000;

export interface CaptureData {
  firstName: string;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  jobTitle: string | null;
}

export type CaptureRead = { ok: true; data: CaptureData } | { ok: false; error: string } | { ok: false; ignore: true };

const field = (form: FormData, name: string, max: number) => String(form.get(name) ?? "").trim().slice(0, max);

// Lê e confere o que a pessoa preencheu. "ignore" = parece robô: a página responde "recebido" e não grava nada.
export function readCapture(form: FormData, now = Date.now()): CaptureRead {
  if (field(form, "website", 200)) return { ok: false, ignore: true }; // campo escondido, só robô preenche
  const age = formTokenAge(form.get("t"), now);
  if (age === null || age < MIN_FILL_MS) return { ok: false, ignore: true };
  if (age > MAX_FILL_MS) return { ok: false, error: "A página ficou aberta por muito tempo. Recarregue e preencha de novo." };

  const full = field(form, "name", 120);
  if (!full) return { ok: false, error: "Informe o seu nome." };
  if (form.get("consent") !== "on") return { ok: false, error: "Marque a caixa para autorizar o contato." };
  const e = parseEmail(field(form, "email", 160));
  if ("error" in e) return { ok: false, error: e.error };
  const p = parsePhone(field(form, "phone", 30));
  if ("error" in p) return { ok: false, error: p.error };
  if (!e.email && !p.phone) return { ok: false, error: "Informe um e-mail ou um WhatsApp para a gente falar com você." };

  const [firstName, ...rest] = full.split(/\s+/);
  const role = field(form, "role", 100);
  const company = field(form, "company", 100);
  return {
    ok: true,
    data: { firstName: firstName.slice(0, 80), lastName: rest.join(" ").slice(0, 80) || null, email: e.email, phone: p.phone, jobTitle: [role, company].filter(Boolean).join(" · ") || null },
  };
}
