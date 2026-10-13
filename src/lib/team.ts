import { randomBytes } from "crypto";
import type { TeamMember } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { emailEnabled, sendEmail } from "@/lib/email";
import { deskcommConfig, sendWhatsapp } from "@/lib/deskcomm";

// Avisos pra equipe (além do push no celular do corretor), pelos canais que já
// estão conectados: o e-mail da conta e o WhatsApp do Deskcomm. Cada pessoa
// escolhe o que recebe:
// - urgent: sinistro, reclamação, jurídico, cancelamento (a IA marca);
// - meeting: reunião marcada e aviso de ligação (hora de ligar);
// - handoff: toda conversa que passa pra uma pessoa ("precisa de você").
export type TeamNoticeKind = "urgent" | "meeting" | "handoff";

function wants(member: Pick<TeamMember, "notifyUrgent" | "notifyMeetings" | "notifyHandoffs">, kind: TeamNoticeKind): boolean {
  if (kind === "meeting") return member.notifyMeetings;
  if (kind === "urgent") return member.notifyUrgent || member.notifyHandoffs;
  return member.notifyHandoffs;
}

function leadLink(leadId: string | undefined): string | null {
  const base = process.env.APP_URL?.replace(/\/$/, "");
  return base && leadId ? `${base}/leads/${leadId}` : null;
}

// Manda um aviso pra uma pessoa. Devolve os canais que funcionaram.
export async function noticeToMember(member: TeamMember, notice: { title: string; body: string; leadId?: string }): Promise<string[]> {
  const link = leadLink(notice.leadId);
  const text = [notice.body, link].filter(Boolean).join("\n\n");
  const done: string[] = [];

  if (member.email && (await emailEnabled())) {
    try {
      await sendEmail({ to: member.email, subject: notice.title, text });
      done.push("e-mail");
    } catch (err) {
      console.error(`[equipe] e-mail pra ${member.name} não saiu:`, err instanceof Error ? err.message : err);
    }
  }
  if (member.phone && (await deskcommConfig())) {
    try {
      const sent = await sendWhatsapp({
        conversationId: member.whatsappConversationId,
        phone: member.phone,
        name: member.name,
        body: `*${notice.title}*\n${text}`,
        idempotencyKey: `team-${member.id}-${randomBytes(8).toString("hex")}`,
      });
      if (sent.conversationId !== member.whatsappConversationId) {
        await prisma.teamMember.update({ where: { id: member.id }, data: { whatsappConversationId: sent.conversationId } });
      }
      done.push("WhatsApp");
    } catch (err) {
      console.error(`[equipe] WhatsApp pra ${member.name} não saiu:`, err instanceof Error ? err.message : err);
    }
  }
  return done;
}

// Avisa todo mundo da equipe que quer esse tipo de aviso. Nunca derruba quem chamou.
export async function notifyTeam(kind: TeamNoticeKind, notice: { title: string; body: string; leadId?: string }): Promise<void> {
  try {
    const members = (await prisma.teamMember.findMany()).filter((m) => wants(m, kind));
    for (const m of members) await noticeToMember(m, notice);
  } catch (err) {
    console.error("[equipe] falha ao avisar a equipe", err);
  }
}
