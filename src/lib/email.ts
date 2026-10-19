import nodemailer from "nodemailer";
import MailComposer from "nodemailer/lib/mail-composer";
import type Mail from "nodemailer/lib/mailer";
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { prisma } from "@/lib/prisma";
import { gmailSend } from "@/lib/gmail";
import { trackingBase } from "@/lib/trackingUrl";

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

export type PasswordConfig = NonNullable<ReturnType<typeof passwordConfig>>;

export type EmailConnection = { provider: "google"; address: string } | { provider: "password"; address: string; cfg: PasswordConfig };

// Qual caixa está conectada agora (Google tem prioridade).
export async function emailConnection(): Promise<EmailConnection | null> {
  const s = await prisma.settings.findUnique({ where: { id: "singleton" }, select: { googleEmail: true, googleRefreshToken: true } });
  if (s?.googleEmail && s.googleRefreshToken) return { provider: "google", address: s.googleEmail };
  const cfg = passwordConfig();
  return cfg ? { provider: "password", address: cfg.address, cfg } : null;
}

// E-mail de prospecção disponível: só com caixa de envio ativa. A conta Google do corretor (agenda e avisos)
// nunca prospecta: a entrega de um Gmail pessoal sofreria e o risco seria dele.
export async function emailEnabled(): Promise<boolean> {
  return (await prisma.mailbox.count({ where: { status: "ACTIVE" } })) > 0;
}

// Só a caixa única conectada (Google ou senha de app): os avisos internos (equipe, resumo do dia) saem por ela,
// nunca pelas caixas de prospecção.
export async function internalEmailEnabled(): Promise<boolean> {
  return (await emailConnection()) !== null;
}

// Senha de app configurada no ambiente (plano B, aparece só no admin).
export function passwordEmailAddress(): string | null {
  return passwordConfig()?.address ?? null;
}

export function smtpTransport(cfg: PasswordConfig) {
  return nodemailer.createTransport({
    host: cfg.smtp.host,
    port: cfg.smtp.port,
    secure: cfg.smtp.secure,
    auth: { user: cfg.address, pass: cfg.password },
  });
}

export function imapClient(cfg: PasswordConfig) {
  return new ImapFlow({
    host: cfg.imap.host,
    port: cfg.imap.port,
    secure: cfg.imap.secure,
    auth: { user: cfg.address, pass: cfg.password },
    logger: false,
  });
}

export const errMessage = (err: unknown) => (err instanceof Error ? err.message : "erro desconhecido");

// Confere envio (SMTP) e leitura (IMAP) de uma caixa com senha, sem enviar nem ler nada. null = funcionando.
export async function testServers(cfg: PasswordConfig): Promise<string | null> {
  const errors: string[] = [];
  try {
    await smtpTransport(cfg).verify();
  } catch (err) {
    errors.push(`Envio (SMTP): ${errMessage(err)}`);
  }
  const client = imapClient(cfg);
  try {
    await client.connect();
  } catch (err) {
    errors.push(`Leitura (IMAP): ${errMessage(err)}`);
  } finally {
    await client.logout().catch(() => {});
  }
  return errors.join(" · ") || null;
}

export async function fromName(): Promise<string | undefined> {
  if (process.env.EMAIL_FROM_NAME) return process.env.EMAIL_FROM_NAME;
  // Com assistente de nome próprio (Helena), o e-mail sai no nome dela, nunca no do corretor.
  const s = await prisma.settings.findUnique({ where: { id: "singleton" }, select: { ownerName: true, assistantName: true } });
  return s?.assistantName?.trim() || s?.ownerName || undefined;
}

// Endereço da imagem invisível que marca a abertura. Sem endereço (TRACKING_URL ou APP_URL), sem rastreio.
export function openPixelUrl(token: string): string | null {
  const base = trackingBase();
  return base ? `${base}/api/o/${token}.gif` : null;
}

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Mesmo texto em HTML simples (parece e-mail escrito à mão), com a imagem de
// abertura no fim quando há rastreio.
function htmlBody(text: string, pixel: string | null, optOut: string | null | undefined) {
  const paragraphs = text
    .trim()
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 12px">${escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
  const foot = optOut === undefined ? "" : `<p style="margin:16px 0 0;font-size:12px;color:#888">${optOut ? `Se preferir não receber mais mensagens, <a href="${optOut}" style="color:#888">clique aqui</a>.` : "Se preferir não receber mais mensagens, é só responder este e-mail avisando."}</p>`;
  const img = pixel ? `<img src="${pixel}" width="1" height="1" alt="" style="border:0;width:1px;height:1px">` : "";
  return `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.5;color:#222">${paragraphs}${foot}${img}</div>`;
}

// Texto puro do e-mail; para pessoa de fora (unsubscribeUrl definido), com o rodapé de descadastro.
function plainBody(text: string, optOut: string | null | undefined) {
  if (optOut === undefined) return text;
  return `${text}

---
${optOut ? `Para não receber mais mensagens: ${optOut}` : "Para não receber mais mensagens, responda este e-mail avisando."}`;
}

export interface SentEmail {
  messageId: string;
  threadId: string | null;
  date: Date;
}

export interface EmailInput {
  to: string;
  subject: string;
  text: string;
  inReplyTo?: string | null;
  references?: string[];
  threadId?: string | null;
  openToken?: string | null;
  // E-mail para uma pessoa de fora (não aviso interno): leva o rodapé de descadastro. O link vai no rodapé e no
  // cabeçalho que o Gmail usa no botão "cancelar inscrição"; null = sem link (sem APP_URL), o rodapé manda responder.
  unsubscribeUrl?: string | null;
  // Primeiro e-mail para quem nunca recebeu da gente: só texto, sem imagem de rastreio e sem link no corpo (o
  // descadastro fica no cabeçalho). O Gmail costuma mandar para o spam o e-mail de remetente novo com imagem e link.
  simple?: boolean;
}

// Monta o e-mail pronto para sair de uma caixa (a conectada ou uma caixa de envio).
export function composeMail(input: EmailInput, address: string, name: string | undefined): Mail.Options {
  const pixel = !input.simple && input.openToken ? openPixelUrl(input.openToken) : null;
  const footerLink = input.simple && input.unsubscribeUrl ? null : input.unsubscribeUrl;
  return {
    from: name ? { name, address } : address,
    to: input.to,
    subject: input.subject,
    text: plainBody(input.text, footerLink),
    html: input.simple ? undefined : htmlBody(input.text, pixel, input.unsubscribeUrl),
    headers: input.unsubscribeUrl ? { "List-Unsubscribe": `<${input.unsubscribeUrl}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" } : undefined,
    inReplyTo: input.inReplyTo ?? undefined,
    references: input.references?.length ? input.references : input.inReplyTo ? [input.inReplyTo] : undefined,
  };
}

export async function sendEmail(input: EmailInput): Promise<SentEmail> {
  const conn = await emailConnection();
  if (!conn) throw new Error("Nenhum e-mail conectado.");
  const mail = composeMail(input, conn.address, await fromName());

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

export async function parseRaw(raw: Buffer, threadId: string | null): Promise<IncomingEmail | null> {
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

