import { prisma } from "@/lib/prisma";
import { sendPush } from "@/lib/push";
import { readableReason } from "@/lib/format";

// Passa o lead pro corretor ("Precisa de você") e avisa por push. Um único
// lugar pra isso: resposta da IA, follow-up, abertura e anexo usam daqui.
// silent: nÃ£o manda push (mensagem automÃ¡tica do outro lado; fica na lista "Precisa de vocÃª" com o motivo).
export async function markNeedsHuman(leadId: string, rawReason: string, opts: { silent?: boolean } = {}) {
  const reason = readableReason(rawReason);
  if (reason !== rawReason.trim()) console.error(`[handoff] lead=${leadId} motivo completo:`, rawReason);
  const lead = await prisma.lead.update({
    where: { id: leadId },
    data: { status: "NEEDS_HUMAN", needsHumanReason: reason },
    select: { id: true, firstName: true, lastName: true },
  });
  if (opts.silent) return;
  const name = [lead.firstName, lead.lastName].filter(Boolean).join(" ") || "Um lead";
  // Notificação é acessória: falha nela não pode desfazer o handoff.
  await sendPush({ title: `${name} precisa de você`, body: reason, url: `/leads/${lead.id}`, tag: `lead-${lead.id}` }).catch((err) =>
    console.error("Falha ao notificar handoff", err),
  );
}
