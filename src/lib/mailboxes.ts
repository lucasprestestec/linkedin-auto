import type { Mailbox, Settings } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { open } from "@/lib/secretBox";
import { composeMail, errMessage, fromName, imapClient, parseRaw, smtpTransport, type EmailInput, type IncomingEmail, type PasswordConfig, type SentEmail } from "@/lib/email";
import { chooseMailbox, parseBounce, startOfDaySP, totalRemainingToday } from "@/lib/mailboxPolicy";
import { effectiveLimits, emailsSentToday, type LimitSettings } from "@/lib/limits";

// Caixas de envio da prospecção: várias, em rodízio, cada uma com limite próprio por dia.
// Quando não há nenhuma ativa, o e-mail segue pela caixa única de antes (Google ou senha de app).

export function mailboxConfig(mb: Mailbox): PasswordConfig {
  return {
    address: mb.address,
    password: open(mb.passwordEnc),
    smtp: { host: mb.smtpHost, port: mb.smtpPort, secure: mb.smtpSecure },
    imap: { host: mb.imapHost, port: mb.imapPort, secure: mb.imapSecure },
  };
}

export async function hasActiveMailboxes(): Promise<boolean> {
  return (await prisma.mailbox.count({ where: { status: "ACTIVE" } })) > 0;
}

// E-mails que cada caixa mandou hoje (dia de Brasília).
export async function sentTodayByMailbox(now = new Date()): Promise<Map<string, number>> {
  const rows = await prisma.message.groupBy({
    by: ["mailboxId"],
    where: { channel: "EMAIL", sender: { not: "LEAD" }, mailboxId: { not: null }, createdAt: { gte: startOfDaySP(now) } },
    _count: { _all: true },
  });
  return new Map(rows.map((r) => [r.mailboxId as string, r._count._all]));
}

// Quantos e-mails novos ainda cabem hoje. Sem caixas de envio, vale o limite da caixa única (Conta).
export async function emailLeftToday(settings: LimitSettings, now = new Date()): Promise<number> {
  const active = await prisma.mailbox.findMany({ where: { status: "ACTIVE" } });
  if (active.length === 0) return Math.max(0, effectiveLimits(settings).email - (await emailsSentToday()));
  const used = await sentTodayByMailbox(now);
  return totalRemainingToday(active, (id) => used.get(id) ?? 0, now);
}

// Escolhe a caixa que manda para esta pessoa. configured = existem caixas ativas; mailbox null com
// configured = todas lotadas hoje.
export async function pickMailboxFor(leadId: string, now = new Date()): Promise<{ mailbox: Mailbox | null; configured: boolean }> {
  const active = await prisma.mailbox.findMany({ where: { status: "ACTIVE" } });
  if (active.length === 0) return { mailbox: null, configured: false };
  const [last, replied, used] = await Promise.all([
    prisma.message.findFirst({ where: { leadId, channel: "EMAIL", mailboxId: { not: null } }, orderBy: { deliveredAt: "desc" }, select: { mailboxId: true } }),
    prisma.message.findFirst({ where: { leadId, channel: "EMAIL", sender: "LEAD" }, select: { id: true } }),
    sentTodayByMailbox(now),
  ]);
  const mailbox = chooseMailbox(active, (id) => used.get(id) ?? 0, { preferredId: last?.mailboxId, replied: Boolean(replied), now });
  return { mailbox, configured: true };
}

export async function sendViaMailbox(mb: Mailbox, input: EmailInput): Promise<SentEmail> {
  const cfg = mailboxConfig(mb);
  const mail = composeMail(input, mb.address, mb.displayName?.trim() || (await fromName()));
  const info = await smtpTransport(cfg).sendMail(mail);
  return { messageId: info.messageId, threadId: null, date: new Date() };
}

// Marca onde a caixa de entrada está agora. Feito ao cadastrar a caixa: tudo que chegar depois disso é lido,
// sem depender de quando a rotina automática passa pela primeira vez.
export async function imapBaseline(cfg: PasswordConfig): Promise<{ imapLastUid: number; imapUidValidity: string } | null> {
  const client = imapClient(cfg);
  try {
    await client.connect();
    const lock = await client.getMailboxLock("INBOX");
    try {
      const box = client.mailbox;
      if (!box) return null;
      return { imapLastUid: Math.max(0, Number(box.uidNext) - 1), imapUidValidity: String(box.uidValidity) };
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => {});
  }
}

export type MailboxEmail = IncomingEmail & { mailbox: { id: string; address: string } };

// Lê só o que chegou desde a última leitura. Na primeira vez, apenas marca onde a caixa está.
// O marcador de leitura só avança em commit(), depois de gravar os e-mails.
async function fetchMailbox(mb: Mailbox): Promise<{ emails: MailboxEmail[]; commit: () => Promise<void> }> {
  const client = imapClient(mailboxConfig(mb));
  await client.connect();
  const lock = await client.getMailboxLock("INBOX");
  const out: MailboxEmail[] = [];
  let maxUid = 0;
  try {
    const box = client.mailbox;
    if (!box) return { emails: [], commit: async () => {} };
    const validity = String(box.uidValidity);
    const next = Number(box.uidNext);
    const firstRun = mb.imapLastUid == null || mb.imapUidValidity !== validity;
    if (!firstRun && next - 1 > mb.imapLastUid!) {
      for await (const msg of client.fetch(`${mb.imapLastUid! + 1}:*`, { uid: true, source: true }, { uid: true })) {
        if (!msg.source || msg.uid <= mb.imapLastUid!) continue;
        maxUid = Math.max(maxUid, msg.uid);
        const e = await parseRaw(msg.source, null);
        if (e) out.push({ ...e, mailbox: { id: mb.id, address: mb.address } });
      }
    }
    const commit = async () => void (await prisma.mailbox.update({ where: { id: mb.id }, data: { imapLastUid: Math.max(0, next - 1, maxUid), imapUidValidity: validity } }));
    return { emails: out, commit };
  } finally {
    lock.release();
    await client.logout().catch(() => {});
  }
}

// Lê as caixas de entrada de todas as caixas de envio (menos as aposentadas). Uma caixa com problema
// não atrapalha as outras: o erro fica guardado nela e aparece na tela.
export async function fetchAllMailboxEmails(): Promise<{ emails: MailboxEmail[]; commit: () => Promise<void> }> {
  const boxes = await prisma.mailbox.findMany({ where: { status: { not: "RETIRED" } } });
  const out: MailboxEmail[] = [];
  const commits: (() => Promise<void>)[] = [];
  for (const mb of boxes) {
    try {
      const r = await fetchMailbox(mb);
      out.push(...r.emails);
      commits.push(r.commit);
      await prisma.mailbox.update({ where: { id: mb.id }, data: { lastCheckedAt: new Date(), lastError: null } });
    } catch (err) {
      await prisma.mailbox.update({ where: { id: mb.id }, data: { lastCheckedAt: new Date(), lastError: errMessage(err).slice(0, 300), lastErrorAt: new Date() } });
    }
  }
  return { emails: out, commit: async () => { for (const c of commits) await c(); } };
}

// Aviso de e-mail devolvido que chegou numa caixa de envio: se for definitivo, a pessoa não recebe mais
// e-mail (insistir em endereço que não existe prejudica a reputação do domínio). Devolve true se tratou.
export async function handleBounceEmail(e: MailboxEmail): Promise<boolean> {
  const b = parseBounce(e, e.mailbox.address);
  if (!b) return false;
  if (b.permanent && b.recipients.length > 0) {
    const r = await prisma.lead.updateMany({
      where: { email: { in: b.recipients, mode: "insensitive" }, emailBouncedAt: null },
      data: { emailBouncedAt: new Date() },
    });
    if (r.count > 0) await prisma.mailbox.update({ where: { id: e.mailbox.id }, data: { bounces: { increment: r.count } } });
  }
  return true;
}
