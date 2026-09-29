import type { Lead } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { fetchNewEmails } from "@/lib/email";
import { markNeedsHuman } from "@/lib/handoff";
import { captureContactsSafely } from "@/lib/contactCapture";

// Lê a caixa do corretor e grava, na conversa certa, os e-mails de pessoas que
// já estão no sistema (casando pelo e-mail da ficha). E-mail de quem não é
// lead é ignorado: a caixa é pessoal, não uma fila de atendimento.
// Devolve os leads que escreveram, pra secretária responder.
export async function syncEmailInbox(): Promise<{ read: number; saved: number; leads: Lead[] }> {
  const emails = await fetchNewEmails();
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
      data: { leadId: lead.id, sender: "LEAD", channel: "EMAIL", content: e.text, subject: e.subject || null, emailMessageId: e.messageId, emailThreadId: e.threadId, deliveredAt: e.date },
    });
    saved++;
    await captureContactsSafely(lead.id, e.text);
    // Respondeu: conversa aberta e sem follow-up pendente.
    const updated = await prisma.lead.update({
      where: { id: lead.id },
      data: { status: lead.status === "NEEDS_HUMAN" || lead.status === "QUALIFIED" ? lead.status : "CONVERSATION_OPEN", followUpsSent: 0, nextStep: null, nextStepAt: null },
    });
    touched.set(lead.id, updated);
  }
  return { read: emails.length, saved, leads: [...touched.values()] };
}
