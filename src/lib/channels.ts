import type { Lead, MessageChannel } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sendMessage } from "@/lib/edges";
import { emailEnabled, sendEmail } from "@/lib/email";

// Um lugar só pra "mandar uma mensagem pra essa pessoa por este canal" e
// gravar no histórico. A secretária decide O QUE e ONDE; aqui é só o COMO.

export const CHANNEL_LABEL: Record<MessageChannel, string> = { LINKEDIN: "LinkedIn", EMAIL: "E-mail", WHATSAPP: "WhatsApp" };

// Canais que dá pra usar com essa pessoa agora.
export function availableChannels(lead: Pick<Lead, "linkedinProfileUrl" | "email" | "phone">, opts: { linkedinConnected: boolean }): MessageChannel[] {
  const list: MessageChannel[] = [];
  if (opts.linkedinConnected && lead.linkedinProfileUrl) list.push("LINKEDIN");
  if (emailEnabled() && lead.email) list.push("EMAIL");
  return list;
}

// Assunto da resposta: "Re: <assunto do último e-mail da conversa>".
async function replyThread(leadId: string): Promise<{ subject: string; inReplyTo: string | null; references: string[] }> {
  const thread = await prisma.message.findMany({
    where: { leadId, channel: "EMAIL" },
    orderBy: { deliveredAt: "asc" },
    select: { subject: true, emailMessageId: true },
  });
  const last = thread.at(-1);
  const base = (last?.subject ?? "").replace(/^((re|res|fw|fwd|enc):\s*)+/i, "").trim();
  return {
    subject: base ? `Re: ${base}` : "Nossa conversa",
    inReplyTo: last?.emailMessageId ?? null,
    references: thread.map((m) => m.emailMessageId).filter((x): x is string => Boolean(x)),
  };
}

export async function sendOnChannel(
  lead: Lead,
  channel: MessageChannel,
  content: string,
  opts: { identityId?: string | null; sender?: "AGENT" | "HUMAN"; subject?: string } = {},
) {
  const sender = opts.sender ?? "AGENT";
  if (channel === "LINKEDIN") {
    if (!opts.identityId) throw new Error("Nenhuma conta do LinkedIn conectada.");
    const r = await sendMessage(opts.identityId, lead.linkedinProfileUrl, content);
    return prisma.message.create({
      data: { leadId: lead.id, sender, channel, content, linkedinMessageId: r.linkedin_message_id, deliveredAt: new Date(r.delivered_at) },
    });
  }
  if (channel === "EMAIL") {
    if (!lead.email) throw new Error("Essa pessoa não tem e-mail na ficha.");
    const thread = await replyThread(lead.id);
    const subject = opts.subject?.trim() || thread.subject;
    const r = await sendEmail({ to: lead.email, subject, text: content, inReplyTo: thread.inReplyTo, references: thread.references });
    return prisma.message.create({
      data: { leadId: lead.id, sender, channel, content, subject, emailMessageId: r.messageId, deliveredAt: r.date },
    });
  }
  throw new Error("WhatsApp ainda não está conectado.");
}
