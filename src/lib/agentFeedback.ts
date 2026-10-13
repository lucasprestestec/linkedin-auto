import { prisma } from "@/lib/prisma";
import { REASON_KEYS } from "@/lib/writingStyle";

// Registra um "não é meu jeito". Guarda também o trecho da conversa (sem o nome da pessoa,
// na medida do possível) pra depois virar cenário do banco de testes.

const CONTEXT_MESSAGES = 8;
const MAX_TEXT = 2000;

export interface FeedbackInput {
  draftId?: string | null;
  leadId?: string | null;
  reasons: string[];
  note?: string | null;
  corrected?: string | null;
}

const escapeRx = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Troca o nome da pessoa por "[nome]". Melhor esforço: apelidos e menções indiretas passam.
export function anonymize(text: string, names: (string | null | undefined)[]): string {
  let out = text;
  for (const n of names) {
    const t = n?.trim();
    if (t && t.length >= 2) out = out.replace(new RegExp(`(?<![\\p{L}\\p{N}])${escapeRx(t)}(?![\\p{L}\\p{N}])`, "giu"), "[nome]");
  }
  return out;
}

const clip = (v: string | null | undefined) => (v?.trim() ? v.trim().slice(0, MAX_TEXT) : null);

export async function recordFeedback(input: FeedbackInput): Promise<{ error?: string }> {
  const reasons = [...new Set(input.reasons.filter((r) => REASON_KEYS.has(r)))];
  const note = clip(input.note);
  if (reasons.length === 0 && !note) return { error: "Escolha um motivo ou escreva o que não ficou bom." };

  const draft = input.draftId ? await prisma.draft.findUnique({ where: { id: input.draftId }, select: { leadId: true, content: true, originalContent: true } }) : null;
  const leadId = draft?.leadId ?? input.leadId ?? null;

  let context: { sender: string; channel: string; content: string }[] | undefined;
  if (leadId) {
    const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { firstName: true, lastName: true } });
    const messages = await prisma.message.findMany({
      where: { leadId },
      orderBy: { deliveredAt: "desc" },
      take: CONTEXT_MESSAGES,
      select: { sender: true, channel: true, content: true },
    });
    const names = [lead?.firstName, lead?.lastName];
    context = messages.reverse().map((m) => ({ sender: m.sender, channel: m.channel, content: anonymize(m.content, names).slice(0, MAX_TEXT) }));
  }

  await prisma.agentFeedback.create({
    data: {
      leadId,
      draftId: input.draftId ?? null,
      // O que o assistente escreveu: o original, se o corretor já editou.
      agentText: draft ? clip(draft.originalContent ?? draft.content) : null,
      reasons,
      note,
      corrected: clip(input.corrected),
      context,
    },
  });
  return {};
}
