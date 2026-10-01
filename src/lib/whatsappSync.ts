import type { Lead } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { fetchWhatsappUpdates, type WhatsappHistoryMessage } from "@/lib/deskcomm";
import { markNeedsHuman } from "@/lib/handoff";
import { captureContactsSafely } from "@/lib/contactCapture";
import { formatMediaMessage, understandMedia } from "@/lib/mediaUnderstanding";
import { planInbound, type InboundPlan } from "@/lib/whatsappMedia";

// Traz do Deskcomm as mensagens novas das conversas de WhatsApp que a
// secretária abriu (só as conhecidas — o resto da caixa do CRM não é dela).
// O que o corretor respondeu direto no Deskcomm entra como "você".
// Áudio, foto e vídeo do lead viram texto (transcrição/descrição) pra secretária entender.
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

    // Só o que ainda não vimos: nem gravado antes, nem anterior à última leitura.
    const fresh: { m: WhatsappHistoryMessage; at: Date; inbound: boolean }[] = [];
    for (const m of u.messages) {
      const exists = await prisma.message.findUnique({ where: { whatsappMessageId: m.id }, select: { id: true } });
      if (exists) continue;
      const at = m.sent_at ? new Date(m.sent_at) : new Date();
      // Mensagens antigas (antes da última leitura) já foram vistas.
      if (lead.whatsappLastAt && at <= lead.whatsappLastAt) continue;
      fresh.push({ m, at, inbound: m.direction === "inbound" });
    }

    const plans = new Map<string, InboundPlan>();
    for (const f of fresh) if (f.inbound) plans.set(f.m.id, planInbound(f.m));

    // Mídia do lead que o Deskcomm ainda está guardando: não mexe nesta conversa agora e NÃO avança a
    // leitura (na próxima rodada ela já estará pronta e tudo é tratado junto, na ordem).
    if ([...plans.values()].some((p) => p.action === "wait")) continue;

    let leadWrote = false;
    let unsupported: string | null = null;
    for (const { m, at, inbound } of fresh) {
      if (!inbound) {
        // Corretor digitando direto no Deskcomm: só o que tem texto.
        const text = m.body?.trim();
        if (text) {
          await prisma.message.create({ data: { leadId: lead.id, sender: "HUMAN", channel: "WHATSAPP", content: text, whatsappMessageId: m.id, deliveredAt: at } });
          saved++;
        }
        continue;
      }
      const plan = plans.get(m.id)!;
      if (plan.action === "text") {
        await prisma.message.create({ data: { leadId: lead.id, sender: "LEAD", channel: "WHATSAPP", content: plan.text, whatsappMessageId: m.id, deliveredAt: at } });
        saved++;
        leadWrote = true;
        await captureContactsSafely(lead.id, plan.text);
      } else if (plan.action === "media") {
        const r = await understandMedia({ url: plan.url, kind: plan.kind, mime: plan.mime });
        if (r.ok) {
          // Nada de capturar telefone/e-mail daqui: número ouvido ou lido numa imagem pode vir errado.
          await prisma.message.create({
            data: {
              leadId: lead.id,
              sender: "LEAD",
              channel: "WHATSAPP",
              content: formatMediaMessage(plan.kind, r.text, plan.caption),
              mediaKind: plan.kind,
              whatsappMessageId: m.id,
              deliveredAt: at,
            },
          });
          saved++;
          leadWrote = true;
        } else {
          unsupported = `${plan.kind === "audio" ? "um áudio" : plan.kind === "image" ? "uma foto" : "um vídeo"} que não consegui entender (${r.reason})`;
        }
      } else if (plan.action === "unsupported") {
        unsupported = plan.label;
      }
    }
    await prisma.lead.update({ where: { id: lead.id }, data: { whatsappLastAt: u.lastAt } });

    if (unsupported) {
      // Não entendi tudo que o lead mandou: responder só ao resto seria ignorar parte da conversa.
      await markNeedsHuman(lead.id, `Mandou ${unsupported} no WhatsApp; veja pelo aplicativo`);
      continue;
    }
    // O corretor já respondeu direto no Deskcomm depois do lead: a conversa
    // está com ele, a secretária não entra por cima.
    const last = await prisma.message.findFirst({ where: { leadId: lead.id }, orderBy: { deliveredAt: "desc" }, select: { sender: true } });
    if (leadWrote && last?.sender !== "LEAD") {
      await prisma.lead.update({ where: { id: lead.id }, data: { followUpsSent: 0, nextStep: "Você respondeu pelo WhatsApp; o assistente não interfere.", nextStepAt: null } });
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
