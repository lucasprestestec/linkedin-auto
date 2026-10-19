import { prisma } from "@/lib/prisma";
import { sendPush } from "@/lib/push";
import { readableReason } from "@/lib/format";
import { notifyTeam } from "@/lib/team";

// Passa o lead pro corretor ("Precisa de você") e avisa por push. Um único
// lugar pra isso: resposta da IA, follow-up, abertura e anexo usam daqui.
// silent: não manda push (mensagem automática do outro lado; fica na lista "Precisa de você" com o motivo).
// urgent: sinistro, reclamação, jurídico, cancelamento — a equipe marcada pra urgências também é avisada.
// Motivo gravado quando o corretor assume a conversa: enquanto ele não devolver, nada o sobrescreve.
export const TAKEOVER_REASON = "Você assumiu a conversa";

export async function markNeedsHuman(leadId: string, rawReason: string, opts: { silent?: boolean; urgent?: boolean } = {}) {
  const current = await prisma.lead.findUnique({ where: { id: leadId }, select: { status: true, needsHumanReason: true } });
  if (current?.status === "NEEDS_HUMAN" && current.needsHumanReason === TAKEOVER_REASON) return;
  const reason = readableReason(rawReason);
  if (reason !== rawReason.trim()) console.error(`[handoff] lead=${leadId} motivo longo encurtado (${rawReason.length} caracteres)`);
  const lead = await prisma.lead.update({
    where: { id: leadId },
    data: { status: "NEEDS_HUMAN", needsHumanReason: reason },
    select: { id: true, firstName: true, lastName: true },
  });
  if (opts.silent) return;
  const name = [lead.firstName, lead.lastName].filter(Boolean).join(" ") || "Um lead";
  // Notificação é acessória: falha nela não pode desfazer o handoff.
  await sendPush({ title: `${opts.urgent ? "Urgente: " : ""}${name} precisa de você`, body: reason, url: `/leads/${lead.id}`, tag: `lead-${lead.id}` }).catch((err) =>
    console.error("Falha ao notificar handoff", err),
  );
  await notifyTeam(opts.urgent ? "urgent" : "handoff", { title: `${opts.urgent ? "Urgente: " : ""}${name} precisa de atendimento`, body: reason, leadId: lead.id });
}
