import { NextResponse } from "next/server";
import { extractConversations } from "@/lib/edges";
import { getActiveIdentityId } from "@/lib/identity";
import { handleIncomingMessage } from "@/lib/respond";
import { isValidBearer } from "@/lib/auth";
import { syncConversation } from "@/lib/sync";
import { runProactive } from "@/lib/followup";
import { isWithinWorkHours } from "@/lib/schedule";
import { prisma } from "@/lib/prisma";

// Geração de texto + envio por lead somam alguns segundos; a parte proativa é
// limitada por rodada (ver lib/followup.ts), mas o padrão da função é curto.
export const maxDuration = 120;

// Agendador externo (cron-job.org) chama este endpoint periodicamente, a cada poucos minutos.
// 1. Reativo: sincroniza as conversas (com o histórico completo das que tiveram
//    novidade) e, quando a última mensagem é do lead, aciona o agente de IA.
// 2. Proativo: detecta convites aceitos, manda a mensagem de abertura e os
//    follow-ups de quem parou de responder.
export async function GET(request: Request) {
  if (!isValidBearer(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const identityId = await getActiveIdentityId();
  const settings = await prisma.settings.findUniqueOrThrow({ where: { id: "singleton" } });
  const conversations = await extractConversations(identityId);
  let updatedLeads = 0;
  let newIncomingMessages = 0;
  let fallbacks = 0;
  let failed = 0;

  // Uma conversa com problema não pode derrubar a sincronização das outras.
  for (const conv of conversations) {
    try {
      const result = await syncConversation(conv, identityId);
      updatedLeads++;
      newIncomingMessages += result.saved.filter((m) => m.fromLead).length;
      if (result.usedFallback) fallbacks++;

      // Uma resposta por conversa, depois de gravar tudo que chegou — o agente
      // lê o histórico completo, então vê todas as mensagens novas de uma vez.
      // Fora do horário de trabalho a resposta espera: runProactive responde
      // quando a janela abrir. Pausado responde na hora (marca pra você).
      if (result.shouldRespond && (settings.automationPaused || isWithinWorkHours(settings))) {
        await handleIncomingMessage(result.lead, identityId);
      }
    } catch (err) {
      failed++;
      console.error("Falha ao sincronizar conversa", conv.linkedin_thread_id, err);
    }
  }

  // Depois do reativo: responder quem escreveu tem prioridade no limite diário.
  let proactive;
  try {
    proactive = await runProactive(identityId);
  } catch (err) {
    console.error("Falha na etapa proativa", err);
    proactive = { error: err instanceof Error ? err.message : "erro desconhecido" };
  }

  return NextResponse.json({ updatedLeads, newIncomingMessages, fallbacks, failed, proactive });
}
