import type { Lead, MessageSender } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { extractThreadMessages, threadUrl, type EdgesConversation, type EdgesThreadMessage } from "@/lib/edges";
import { syncLeadFromConversation } from "@/lib/leads";

// Mensagem já normalizada, pronta pra comparar com o banco.
export interface SyncedMessage {
  messageId: string;
  content: string;
  deliveredAt: Date;
  fromLead: boolean;
}

export interface ConversationSyncResult {
  lead: Lead;
  // Mensagens gravadas nesta rodada, em ordem.
  saved: SyncedMessage[];
  // A mensagem mais recente da conversa é nova e é do lead: o agente deve responder.
  shouldRespond: boolean;
  // Histórico completo indisponível; só a última mensagem foi considerada.
  usedFallback: boolean;
}

// Mensagem que nós mesmos enviamos (agente ou corretor pelo painel) já está no
// banco, mas o ID que a edges.run devolve no envio pode não ser igual ao do
// histórico. Mesmo conteúdo, perto do mesmo horário = é a mesma mensagem.
const SAME_MESSAGE_WINDOW_MS = 10 * 60 * 1000;

function sameName(a: string | null | undefined, b: string | null | undefined): boolean {
  return (a ?? "").trim().toLowerCase() === (b ?? "").trim().toLowerCase();
}

// Descobre quem é o lead entre os remetentes da conversa. O ID de perfil do
// remetente é o critério confiável; o nome serve só pra aprender esse ID na
// primeira vez (e como último recurso, se o ID não vier).
export function classifySenders(
  messages: EdgesThreadMessage[],
  conv: Pick<EdgesConversation, "first_name" | "last_name">,
  knownLeadProfileId: string | null,
): { isFromLead: (m: EdgesThreadMessage) => boolean; leadProfileId: string | null } {
  const byName = (m: EdgesThreadMessage) => sameName(m.first_name, conv.first_name) && sameName(m.last_name, conv.last_name);

  let leadProfileId = knownLeadProfileId;
  if (!leadProfileId) {
    const ids = new Set(messages.filter(byName).map((m) => m.linkedin_profile_id).filter((id) => id != null));
    // Só aprende se não houver ambiguidade (ex.: corretor e lead com o mesmo nome).
    if (ids.size === 1) leadProfileId = String([...ids][0]);
  }

  const isFromLead = (m: EdgesThreadMessage) =>
    leadProfileId && m.linkedin_profile_id != null ? String(m.linkedin_profile_id) === leadProfileId : byName(m);

  return { isFromLead, leadProfileId };
}

export function toSyncedMessages(messages: EdgesThreadMessage[], isFromLead: (m: EdgesThreadMessage) => boolean): SyncedMessage[] {
  return [...messages]
    .sort((a, b) => new Date(a.delivered_at).getTime() - new Date(b.delivered_at).getTime() || a.position - b.position)
    .map((m) => ({
      messageId: m.message_id,
      content: m.content ?? "",
      deliveredAt: new Date(m.delivered_at),
      fromLead: isFromLead(m),
    }));
}

// Grava o que ainda não está no banco e devolve só o que foi gravado.
export async function saveNewMessages(lead: Lead, messages: SyncedMessage[]): Promise<SyncedMessage[]> {
  const existing = await prisma.message.findMany({
    where: { leadId: lead.id },
    select: { linkedinMessageId: true, content: true, sender: true, deliveredAt: true },
  });
  const knownIds = new Set(existing.map((m) => m.linkedinMessageId).filter(Boolean));
  const ours = existing.filter((m) => m.sender !== "LEAD");

  const saved: SyncedMessage[] = [];
  for (const m of messages) {
    if (knownIds.has(m.messageId)) continue;

    if (!m.fromLead) {
      const alreadyRecorded = ours.some(
        (o) =>
          o.content.trim() === m.content.trim() &&
          Math.abs(o.deliveredAt.getTime() - m.deliveredAt.getTime()) <= SAME_MESSAGE_WINDOW_MS,
      );
      if (alreadyRecorded) continue;
    }

    // Saída que não passou pelo painel foi o corretor escrevendo direto no LinkedIn.
    const sender: MessageSender = m.fromLead ? "LEAD" : "HUMAN";
    await prisma.message.create({
      data: {
        leadId: lead.id,
        sender,
        content: m.content,
        linkedinMessageId: m.messageId,
        deliveredAt: m.deliveredAt,
      },
    });
    knownIds.add(m.messageId);
    saved.push(m);
  }
  return saved;
}

// Sincroniza uma conversa: lead, histórico de mensagens e se o agente deve agir.
// O histórico completo só é buscado quando a última mensagem é nova — sem
// novidade, nenhuma chamada extra (e nenhum crédito extra) na edges.run.
export async function syncConversation(conv: EdgesConversation, identityId: string): Promise<ConversationSyncResult> {
  let lead = await syncLeadFromConversation(conv);

  const lastKnown = await prisma.message.findUnique({ where: { linkedinMessageId: conv.last_message.message_id } });
  if (lastKnown) return { lead, saved: [], shouldRespond: false, usedFallback: false };

  let messages: SyncedMessage[];
  let usedFallback = false;
  try {
    const history = await extractThreadMessages(identityId, threadUrl(conv));
    const { isFromLead, leadProfileId } = classifySenders(history, conv, lead.linkedinProfileId);
    if (leadProfileId && leadProfileId !== lead.linkedinProfileId) {
      lead = await prisma.lead.update({ where: { id: lead.id }, data: { linkedinProfileId: leadProfileId } });
    }
    messages = toSyncedMessages(history, isFromLead);
  } catch (err) {
    // Sem o histórico, cai no comportamento antigo (só a última mensagem) em vez
    // de deixar a conversa sem sincronizar.
    console.error("Histórico indisponível, usando só a última mensagem", conv.linkedin_thread_id, err);
    usedFallback = true;
    messages = [
      {
        messageId: conv.last_message.message_id,
        content: conv.last_message.content,
        deliveredAt: new Date(conv.last_message.delivered_at),
        fromLead: sameName(conv.last_message.first_name, conv.first_name),
      },
    ];
  }

  // A listagem pode ser mais recente que o histórico (mensagem chegou entre as
  // duas chamadas): garante que a última mensagem conhecida esteja incluída.
  if (!messages.some((m) => m.messageId === conv.last_message.message_id)) {
    messages.push({
      messageId: conv.last_message.message_id,
      content: conv.last_message.content,
      deliveredAt: new Date(conv.last_message.delivered_at),
      fromLead: sameName(conv.last_message.first_name, conv.first_name),
    });
  }

  const saved = await saveNewMessages(lead, messages);

  // O lead escreveu: a conversa é de verdade (inclusive se estava dado como
  // perdido e voltou) e a sequência de follow-up recomeça do zero.
  if (saved.some((m) => m.fromLead)) {
    const revived = lead.status === "INVITE_SENT" || lead.status === "WAITING_REPLY" || lead.status === "LOST";
    lead = await prisma.lead.update({
      where: { id: lead.id },
      data: { followUpsSent: 0, ...(revived ? { status: "CONVERSATION_OPEN" as const } : {}) },
    });
  }
  const latest = messages[messages.length - 1];
  const shouldRespond = latest.fromLead && saved.some((m) => m.messageId === latest.messageId);

  return { lead, saved, shouldRespond, usedFallback };
}
