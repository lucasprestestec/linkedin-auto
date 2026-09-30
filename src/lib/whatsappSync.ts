import type { Lead } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { fetchWhatsappUpdates } from "@/lib/deskcomm";
import { markNeedsHuman } from "@/lib/handoff";
import { captureContactsSafely } from "@/lib/contactCapture";

// Traz do Deskcomm as mensagens novas das conversas de WhatsApp que a
// secretária abriu (só as conhecidas — o resto da caixa do CRM não é dela).
// O que o corretor respondeu direto no Deskcomm entra como "você".
// Devolve os leads que escreveram, pra secretária responder.
export async function syncWhatsapp(): Promise<{ checked: number; saved: number; leads: Lead[] }> {
  const tracked = await prisma.lead.findMany({ where: { whatsappConversationId: { not: null } } });
  if (!tracked.length) return { checked: 0, saved: 0, leads: [] };
  const byConversation = new Map(tracked.map((l) => [l.whatsappConversationId!, l]));
  const updates = await fetchWhatsappUpdates(new Map(tracked.map((l) => [l.whatsappConversationId!, l.whatsappLastAt])));

  let saved = 0;
  const wrote = new Map<string, Lead>();
  for (const u of updates) {
    const lead = byConversation.get(u.conversationId)!;
    let leadWrote = false;
    let mediaOnly = false;
    for (const m of u.messages) {
      const exists = await prisma.message.findUnique({ where: { whatsappMessageId: m.id }, select: { id: true } });
      if (exists) continue;
      const at = m.sent_at ? new Date(m.sent_at) : new Date();
      // Mensagens antigas (antes da última leitura) já foram vistas.
      if (lead.whatsappLastAt && at <= lead.whatsappLastAt) continue;
      const inbound = m.direction === "inbound";
      const text = m.body?.trim();
      if (!text) {
        if (inbound) mediaOnly = true;
        continue;
      }
      await prisma.message.create({
        data: { leadId: lead.id, sender: inbound ? "LEAD" : "HUMAN", channel: "WHATSAPP", content: text, whatsappMessageId: m.id, deliveredAt: at },
      });
      saved++;
      if (inbound) {
        leadWrote = true;
        await captureContactsSafely(lead.id, text);
      }
    }
    await prisma.lead.update({ where: { id: lead.id }, data: { whatsappLastAt: u.lastAt } });
    if (mediaOnly && !leadWrote) {
      // Áudio, foto ou arquivo: a IA não ouve nem vê — passa pro corretor.
      await markNeedsHuman(lead.id, "Mandou áudio ou arquivo no WhatsApp; veja pelo aplicativo");
      continue;
    }
    // O corretor já respondeu direto no Deskcomm depois do lead: a conversa
    // está com ele, a secretária não entra por cima.
    const last = await prisma.message.findFirst({ where: { leadId: lead.id }, orderBy: { deliveredAt: "desc" }, select: { sender: true } });
    if (leadWrote && last?.sender !== "LEAD") {
      await prisma.lead.update({ where: { id: lead.id }, data: { followUpsSent: 0, nextStep: "Você respondeu pelo WhatsApp; a secretária não interfere.", nextStepAt: null } });
      continue;
    }
    if (leadWrote) {
      const updated = await prisma.lead.update({
        where: { id: lead.id },
        data: {
          status: lead.status === "NEEDS_HUMAN" || lead.status === "QUALIFIED" || lead.status === "MEETING_SCHEDULED" ? lead.status : "CONVERSATION_OPEN",
          followUpsSent: 0,
          nextStep: null,
          nextStepAt: null,
        },
      });
      wrote.set(lead.id, updated);
    }
  }
  return { checked: updates.length, saved, leads: [...wrote.values()] };
}
