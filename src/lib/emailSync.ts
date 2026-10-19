import type { Lead } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { IncomingEmail } from "@/lib/email";
import { fetchAllMailboxEmails, handleBounceEmail, type MailboxEmail } from "@/lib/mailboxes";
import { markNeedsHuman } from "@/lib/handoff";
import { captureContactsSafely } from "@/lib/contactCapture";

// Lê as caixas de envio (nunca a conta Google do corretor) e grava, na conversa certa, os e-mails
// de pessoas que já estão no sistema (casando pelo e-mail da ficha). E-mail de quem não é lead é ignorado.
// Devolve os leads que escreveram, pra secretária responder.
export async function syncEmailInbox(): Promise<{ read: number; saved: number; leads: Lead[] }> {
  const noMailbox = { emails: [] as MailboxEmail[], commit: async () => {} };
  const mailboxes = await fetchAllMailboxEmails().catch((err) => {
    console.error("Falha ao ler as caixas de envio", err);
    return noMailbox;
  });
  const all: (IncomingEmail & { mailbox?: MailboxEmail["mailbox"] })[] = [...mailboxes.emails];
  // O marcador de leitura só avança depois de gravar tudo: falha no meio = lê de novo (a gravação ignora o que já existe).
  const result = await saveEmails(all);
  await mailboxes.commit();
  return result;
}

async function saveEmails(all: (IncomingEmail & { mailbox?: MailboxEmail["mailbox"] })[]): Promise<{ read: number; saved: number; leads: Lead[] }> {
  // E-mail devolvido: trata e tira da fila (não é conversa).
  const emails: typeof all = [];
  for (const e of all) {
    if (e.mailbox && (await handleBounceEmail(e as MailboxEmail))) continue;
    emails.push(e);
  }
  if (emails.length === 0) return { read: 0, saved: 0, leads: [] };

  const addresses = [...new Set(emails.map((e) => e.from))];
  const known = await prisma.lead.findMany({ where: { email: { in: addresses, mode: "insensitive" } } });
  const byEmail = new Map(known.map((l) => [l.email!.toLowerCase(), l]));

  const touched = new Map<string, Lead>();
  let saved = 0;
  for (const e of emails) {
    const lead = byEmail.get(e.from);
    if (!lead) continue;
    const exists = await prisma.message.findUnique({ where: { emailMessageId: e.messageId }, select: { id: true } });
    if (exists) continue;
    if (!e.text) {
      // Só anexo/imagem, sem texto: a IA não tem o que ler.
      await markNeedsHuman(lead.id, "Respondeu por e-mail só com anexo — veja na sua caixa");
      continue;
    }
    await prisma.message.create({
      data: { leadId: lead.id, sender: "LEAD", channel: "EMAIL", content: e.text, subject: e.subject || null, emailMessageId: e.messageId, emailThreadId: e.threadId, deliveredAt: e.date, mailboxId: e.mailbox?.id ?? null },
    });
    saved++;
    await captureContactsSafely(lead.id, e.text);
    // Respondeu: conversa aberta e sem follow-up pendente.
    const updated = await prisma.lead.update({
      where: { id: lead.id },
      data: { status: lead.status === "NEEDS_HUMAN" || lead.status === "QUALIFIED" || lead.status === "MEETING_SCHEDULED" ? lead.status : "CONVERSATION_OPEN", followUpsSent: 0, nextStep: null, nextStepAt: null },
    });
    touched.set(lead.id, updated);
  }
  return { read: emails.length, saved, leads: [...touched.values()] };
}
