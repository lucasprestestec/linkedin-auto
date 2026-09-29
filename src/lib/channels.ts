import { randomBytes } from "crypto";
import type { Lead, MessageChannel } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sendMessage } from "@/lib/edges";
import { sendEmail } from "@/lib/email";

// Um lugar só pra "mandar uma mensagem pra essa pessoa por este canal" e
// gravar no histórico. A secretária decide O QUE e ONDE; aqui é só o COMO.

export const CHANNEL_LABEL: Record<MessageChannel, string> = { LINKEDIN: "LinkedIn", EMAIL: "E-mail", WHATSAPP: "WhatsApp" };

// Assunto e thread da resposta: "Re: <assunto do último e-mail da conversa>".
async function replyThread(leadId: string) {
  const thread = await prisma.message.findMany({
    where: { leadId, channel: "EMAIL" },
    orderBy: { deliveredAt: "asc" },
    select: { subject: true, emailMessageId: true, emailThreadId: true },
  });
  const last = thread.at(-1);
  const base = (last?.subject ?? "").replace(/^((re|res|fw|fwd|enc):\s*)+/i, "").trim();
  return {
    subject: base ? `Re: ${base}` : "Nossa conversa",
    inReplyTo: last?.emailMessageId ?? null,
    references: thread.map((m) => m.emailMessageId).filter((x): x is string => Boolean(x)),
    threadId: thread.findLast((m) => m.emailThreadId)?.emailThreadId ?? null,
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
    // Código único da imagem invisível: quando ela carrega, o e-mail foi aberto.
    const openToken = randomBytes(18).toString("base64url");
    const r = await sendEmail({ to: lead.email, subject, text: content, inReplyTo: thread.inReplyTo, references: thread.references, threadId: thread.threadId, openToken });
    return prisma.message.create({
      data: { leadId: lead.id, sender, channel, content, subject, emailMessageId: r.messageId, emailThreadId: r.threadId, openToken, deliveredAt: r.date },
    });
  }
  throw new Error("WhatsApp ainda não está conectado.");
}
