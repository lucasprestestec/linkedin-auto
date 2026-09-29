import nodemailer from "nodemailer";
import MailComposer from "nodemailer/lib/mail-composer";
import type Mail from "nodemailer/lib/mailer";
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { prisma } from "@/lib/prisma";
import { gmailCheck, gmailNewInboxMessages, gmailSend } from "@/lib/gmail";

// E-mail pela caixa do PRÓPRIO corretor. Sem serviço pago: a mensagem sai no
// nome dele, da caixa dele, e a resposta do cliente chega onde ele já lê.
//
// Dois jeitos de conectar:
//  1. "Entrar com Google" (principal): o corretor autoriza em Conta, sem senha.
//     Ver lib/gmail.ts.
//  2. Plano B, só pelo admin/variáveis de ambiente, com senha de app (SMTP+IMAP):
//     EMAIL_ADDRESS, EMAIL_PASSWORD, EMAIL_PROVIDER (gmail|outlook|custom),
//     EMAIL_SMTP_HOST/PORT e EMAIL_IMAP_HOST/PORT (custom).
// EMAIL_FROM_NAME (opcional) — nome no "De:" (padrão: nome do corretor).

type Server = { host: string; port: number; secure: boolean };

const PRESETS: Record<string, { smtp: Server; imap: Server }> = {
  gmail: { smtp: { host: "smtp.gmail.com", port: 465, secure: true }, imap: { host: "imap.gmail.com", port: 993, secure: true } },
  outlook: { smtp: { host: "smtp.office365.com", port: 587, secure: false }, imap: { host: "outlook.office365.com", port: 993, secure: true } },
};

function providerOf(address: string): string {
  const explicit = process.env.EMAIL_PROVIDER?.toLowerCase();
  if (explicit) return explicit;
  const domain = address.split("@")[1]?.toLowerCase() ?? "";
  if (domain === "gmail.com" || domain === "googlemail.com") return "gmail";
  if (["outlook.com", "hotmail.com", "live.com", "msn.com"].includes(domain)) return "outlook";
  return "custom";
}

function passwordConfig() {
  const address = process.env.EMAIL_ADDRESS?.trim();
  const password = process.env.EMAIL_PASSWORD;
  if (!address || !password) return null;
  const provider = providerOf(address);
  const preset = PRESETS[provider];
  const port = (v: string | undefined, fallback: number) => (v ? Number(v) : fallback);
  const smtp: Server = preset?.smtp ?? {
    host: process.env.EMAIL_SMTP_HOST ?? "",
    port: port(process.env.EMAIL_SMTP_PORT, 465),
    secure: port(process.env.EMAIL_SMTP_PORT, 465) === 465,
  };
  const imap: Server = preset?.imap ?? {
    host: process.env.EMAIL_IMAP_HOST ?? "",
    port: port(process.env.EMAIL_IMAP_PORT, 993),
    // 993 = TLS direto; outras portas (143) sobem pra TLS com STARTTLS.
    secure: port(process.env.EMAIL_IMAP_PORT, 993) === 993,
  };
  if (!smtp.host || !imap.host) return null;
  return { address, password, smtp, imap };
}

type PasswordConfig = NonNullable<ReturnType<typeof passwordConfig>>;

export type EmailConnection = { provider: "google"; address: string } | { provider: "password"; address: string; cfg: PasswordConfig };

// Qual caixa está conectada agora (Google tem prioridade).
export async function emailConnection(): Promise<EmailConnection | null> {
  const s = await prisma.settings.findUnique({ where: { id: "singleton" }, select: { googleEmail: true, googleRefreshToken: true } });
  if (s?.googleEmail && s.googleRefreshToken) return { provider: "google", address: s.googleEmail };
  const cfg = passwordConfig();
  return cfg ? { provider: "password", address: cfg.address, cfg } : null;
}

export async function emailEnabled(): Promise<boolean> {
  return (await emailConnection()) !== null;
}

// Senha de app configurada no ambiente (plano B, aparece só no admin).
export function passwordEmailAddress(): string | null {
  return passwordConfig()?.address ?? null;
}

function smtpTransport(cfg: PasswordConfig) {
  return nodemailer.createTransport({
    host: cfg.smtp.host,
    port: cfg.smtp.port,
    secure: cfg.smtp.secure,
    auth: { user: cfg.address, pass: cfg.password },
  });
}

function imapClient(cfg: PasswordConfig) {
  return new ImapFlow({
    host: cfg.imap.host,
    port: cfg.imap.port,
    secure: cfg.imap.secure,
    auth: { user: cfg.address, pass: cfg.password },
    logger: false,
  });
}

const errMessage = (err: unknown) => (err instanceof Error ? err.message : "erro desconhecido");

// Confere a conexão sem enviar nem ler nada. null = funcionando.
export async function testEmailConnection(): Promise<{ address: string | null; error: string | null }> {
  const conn = await emailConnection();
  if (!conn) return { address: null, error: "Nenhum e-mail conectado." };
  if (conn.provider === "google") {
    try {
      await gmailCheck();
      return { address: conn.address, error: null };
    } catch (err) {
      return { address: conn.address, error: errMessage(err) };
    }
  }
  const errors: string[] = [];
  try {
    await smtpTransport(conn.cfg).verify();
  } catch (err) {
    errors.push(`Envio (SMTP): ${errMessage(err)}`);
  }
  const client = imapClient(conn.cfg);
  try {
    await client.connect();
  } catch (err) {
    errors.push(`Leitura (IMAP): ${errMessage(err)}`);
  } finally {
    await client.logout().catch(() => {});
  }
  return { address: conn.address, error: errors.join(" · ") || null };
}

async function fromName(): Promise<string | undefined> {
  if (process.env.EMAIL_FROM_NAME) return process.env.EMAIL_FROM_NAME;
  const s = await prisma.settings.findUnique({ where: { id: "singleton" }, select: { ownerName: true } });
  return s?.ownerName ?? undefined;
}

// Endereço da imagem invisível que marca a abertura. Sem APP_URL, sem rastreio.
export function openPixelUrl(token: string): string | null {
  const base = process.env.APP_URL?.replace(/\/$/, "");
  return base ? `${base}/api/o/${token}.gif` : null;
}

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Mesmo texto em HTML simples (parece e-mail escrito à mão), com a imagem de
// abertura no fim quando há rastreio.
function htmlBody(text: string, pixel: string | null) {
  const paragraphs = text
    .trim()
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 12px">${escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
  const img = pixel ? `<img src="${pixel}" width="1" height="1" alt="" style="border:0;width:1px;height:1px">` : "";
  return `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.5;color:#222">${paragraphs}${img}</div>`;
}

export interface SentEmail {
  messageId: string;
  threadId: string | null;
  date: Date;
}

export async function sendEmail(input: {
  to: string;
  subject: string;
  text: string;
  inReplyTo?: string | null;
  references?: string[];
  threadId?: string | null;
  openToken?: string | null;
}): Promise<SentEmail> {
  const conn = await emailConnection();
  if (!conn) throw new Error("Nenhum e-mail conectado.");
  const name = await fromName();
  const pixel = input.openToken ? openPixelUrl(input.openToken) : null;
  const mail: Mail.Options = {
    from: name ? { name, address: conn.address } : conn.address,
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: htmlBody(input.text, pixel),
    inReplyTo: input.inReplyTo ?? undefined,
    references: input.references?.length ? input.references : input.inReplyTo ? [input.inReplyTo] : undefined,
  };

  if (conn.provider === "google") {
    const raw = await new MailComposer(mail).compile().build();
    const r = await gmailSend(raw, input.threadId);
    return { messageId: r.messageId ?? `<gmail-${r.id}>`, threadId: r.threadId, date: new Date() };
  }
  const info = await smtpTransport(conn.cfg).sendMail(mail);
  return { messageId: info.messageId, threadId: null, date: new Date() };
}

// Tira a parte citada da resposta ("Em ... escreveu:", linhas com ">"...),
// pra conversa guardar só o que o cliente escreveu agora.
export function stripQuoted(text: string): string {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  for (const line of lines) {
    const t = line.trim();
    if (
      /^>/.test(t) ||
      /^(em|on)\s.+(escreveu|wrote):?$/i.test(t) ||
      /^-{2,}\s*(mensagem original|original message|forwarded message)/i.test(t) ||
      /^(de|from):\s.+/i.test(t)
    ) {
      break;
    }
    out.push(line);
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

export interface IncomingEmail {
  from: string;
  subject: string;
  text: string;
  messageId: string;
  inReplyTo: string | null;
  threadId: string | null;
  date: Date;
}

async function parseRaw(raw: Buffer, threadId: string | null): Promise<IncomingEmail | null> {
  const parsed = await simpleParser(raw);
  const from = parsed.from?.value?.[0]?.address?.toLowerCase();
  if (!from || !parsed.messageId) return null;
  return {
    from,
    subject: parsed.subject ?? "",
    text: stripQuoted(parsed.text ?? ""),
    messageId: parsed.messageId,
    inReplyTo: typeof parsed.inReplyTo === "string" ? parsed.inReplyTo : null,
    threadId,
    date: parsed.date ?? new Date(),
  };
}

// Lê só o que chegou desde a última leitura. Na primeira vez, apenas marca
// onde a caixa está — não processa e-mails antigos.
export async function fetchNewEmails(): Promise<IncomingEmail[]> {
  const conn = await emailConnection();
  if (!conn) return [];
  if (conn.provider === "google") {
    const raws = await gmailNewInboxMessages();
    const out: IncomingEmail[] = [];
    for (const m of raws) {
      const e = await parseRaw(m.raw, m.threadId);
      if (e) out.push(e);
    }
    return out;
  }
  return fetchImap(conn.cfg);
}

async function fetchImap(cfg: PasswordConfig): Promise<IncomingEmail[]> {
  const settings = await prisma.settings.findUniqueOrThrow({ where: { id: "singleton" }, select: { emailLastUid: true, emailUidValidity: true } });
  const client = imapClient(cfg);
  await client.connect();
  const lock = await client.getMailboxLock("INBOX");
  const emails: IncomingEmail[] = [];
  let maxUid = 0;
  try {
    const box = client.mailbox;
    if (!box) return [];
    const validity = String(box.uidValidity);
    const next = Number(box.uidNext);
    const firstRun = settings.emailLastUid == null || settings.emailUidValidity !== validity;
    if (!firstRun && next - 1 > settings.emailLastUid!) {
      for await (const msg of client.fetch(`${settings.emailLastUid! + 1}:*`, { uid: true, source: true }, { uid: true })) {
        if (!msg.source || msg.uid <= settings.emailLastUid!) continue;
        maxUid = Math.max(maxUid, msg.uid);
        const e = await parseRaw(msg.source, null);
        if (e) emails.push(e);
      }
    }
    await prisma.settings.update({ where: { id: "singleton" }, data: { emailLastUid: Math.max(0, next - 1, maxUid), emailUidValidity: validity } });
  } finally {
    lock.release();
    await client.logout().catch(() => {});
  }
  return emails;
}
