import nodemailer from "nodemailer";
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { prisma } from "@/lib/prisma";

// E-mail pela caixa do PRÓPRIO corretor (SMTP pra enviar, IMAP pra ler as
// respostas), com senha de app. Sem serviço pago: a mensagem sai no nome dele,
// da caixa dele, e a resposta do cliente chega onde ele já lê.
//
// Configuração (variáveis de ambiente):
//   EMAIL_ADDRESS   — endereço da caixa (ex.: lucas@gmail.com)
//   EMAIL_PASSWORD  — senha de app (Gmail/Outlook: gerada nas configurações de segurança)
//   EMAIL_PROVIDER  — gmail | outlook | custom (padrão: deduz pelo domínio)
//   EMAIL_FROM_NAME — nome que aparece no "De:" (padrão: nome do corretor)
//   custom: EMAIL_SMTP_HOST, EMAIL_SMTP_PORT, EMAIL_IMAP_HOST, EMAIL_IMAP_PORT

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

function config() {
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

export function emailEnabled(): boolean {
  return config() !== null;
}

export function emailAddress(): string | null {
  return config()?.address ?? null;
}

async function fromName(): Promise<string | undefined> {
  if (process.env.EMAIL_FROM_NAME) return process.env.EMAIL_FROM_NAME;
  const s = await prisma.settings.findUnique({ where: { id: "singleton" }, select: { ownerName: true } });
  return s?.ownerName ?? undefined;
}

export interface SentEmail {
  messageId: string;
  date: Date;
}

type Config = NonNullable<ReturnType<typeof config>>;

function smtpTransport(cfg: Config) {
  return nodemailer.createTransport({
    host: cfg.smtp.host,
    port: cfg.smtp.port,
    secure: cfg.smtp.secure,
    auth: { user: cfg.address, pass: cfg.password },
  });
}

function imapClient(cfg: Config) {
  return new ImapFlow({
    host: cfg.imap.host,
    port: cfg.imap.port,
    secure: cfg.imap.secure,
    auth: { user: cfg.address, pass: cfg.password },
    logger: false,
  });
}

// Só entra no SMTP e no IMAP com a senha e sai — não envia nem lê nada.
export async function testEmailConnection(): Promise<{ smtp: string | null; imap: string | null }> {
  const cfg = config();
  if (!cfg) return { smtp: "E-mail não configurado.", imap: "E-mail não configurado." };
  const message = (err: unknown) => (err instanceof Error ? err.message : "erro desconhecido");
  let smtp: string | null = null;
  let imap: string | null = null;
  try {
    await smtpTransport(cfg).verify();
  } catch (err) {
    smtp = message(err);
  }
  const client = imapClient(cfg);
  try {
    await client.connect();
  } catch (err) {
    imap = message(err);
  } finally {
    await client.logout().catch(() => {});
  }
  return { smtp, imap };
}

export async function sendEmail(input: { to: string; subject: string; text: string; inReplyTo?: string | null; references?: string[] }): Promise<SentEmail> {
  const cfg = config();
  if (!cfg) throw new Error("E-mail não configurado.");
  const transport = smtpTransport(cfg);
  const name = await fromName();
  const info = await transport.sendMail({
    from: name ? { name, address: cfg.address } : cfg.address,
    to: input.to,
    subject: input.subject,
    text: input.text,
    inReplyTo: input.inReplyTo ?? undefined,
    references: input.references?.length ? input.references : input.inReplyTo ? [input.inReplyTo] : undefined,
  });
  return { messageId: info.messageId, date: new Date() };
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
  date: Date;
}

// Lê só o que chegou desde a última leitura (UID). Na primeira vez, apenas
// marca onde a caixa está — não processa e-mails antigos.
export async function fetchNewEmails(): Promise<IncomingEmail[]> {
  const cfg = config();
  if (!cfg) return [];
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
        const parsed = await simpleParser(msg.source);
        const from = parsed.from?.value?.[0]?.address?.toLowerCase();
        if (!from || !parsed.messageId) continue;
        emails.push({
          from,
          subject: parsed.subject ?? "",
          text: stripQuoted(parsed.text ?? ""),
          messageId: parsed.messageId,
          inReplyTo: typeof parsed.inReplyTo === "string" ? parsed.inReplyTo : null,
          date: parsed.date ?? new Date(),
        });
      }
    }
    await prisma.settings.update({ where: { id: "singleton" }, data: { emailLastUid: Math.max(0, next - 1, maxUid), emailUidValidity: validity } });
  } finally {
    lock.release();
    await client.logout().catch(() => {});
  }
  return emails;
}
