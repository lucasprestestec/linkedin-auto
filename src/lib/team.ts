import { randomBytes } from "crypto";
import type { LeadKind, TeamMember } from "@prisma/client";
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

type LeadRouting = { kind: LeadKind | null; assigneeId: string | null };

// Quem recebe o aviso: quem marcou esse tipo de aviso, o responsável pelo contato e, se ele
// não tem responsável, quem cuida desse tipo de contato (reunião e "precisa de você"; urgência só
// vai pra quem marcou urgência e pro responsável, pra não avisar o time inteiro à toa).
export function recipients(members: TeamMember[], kind: TeamNoticeKind, lead: LeadRouting | null): TeamMember[] {
  return members.filter((m) => {
    if (wants(m, kind)) return true;
    if (!lead) return false;
    if (m.id === lead.assigneeId) return true;
    return kind !== "urgent" && !lead.assigneeId && lead.kind !== null && m.handles.includes(lead.kind);
  });
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

  if (member.email && member.viaEmail && (await emailEnabled())) {
    try {
      await sendEmail({ to: member.email, subject: notice.title, text });
      done.push("e-mail");
    } catch (err) {
      console.error(`[equipe] e-mail pra ${member.name} não saiu:`, err instanceof Error ? err.message : err);
    }
  }
  if (member.phone && member.viaWhatsapp && (await deskcommConfig())) {
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
    const lead = notice.leadId ? await prisma.lead.findUnique({ where: { id: notice.leadId }, select: { kind: true, assigneeId: true } }) : null;
    for (const m of recipients(await prisma.teamMember.findMany(), kind, lead)) await noticeToMember(m, notice);
  } catch (err) {
    console.error("[equipe] falha ao avisar a equipe", err);
  }
}
