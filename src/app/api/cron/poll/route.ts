import { NextResponse } from "next/server";
import { extractConversations } from "@/lib/edges";
import { getActiveIdentityId } from "@/lib/identity";
import { handleIncomingMessage } from "@/lib/respond";
import { isValidBearer } from "@/lib/auth";
import { syncConversation } from "@/lib/sync";

// Agendador externo (cron-job.org) chama este endpoint periodicamente, a cada poucos minutos.
// Sincroniza as conversas (com o histórico completo das que tiveram novidade) e,
// quando a última mensagem é do lead, aciona o agente de IA (que decide
// responder ou pedir handoff humano).
export async function GET(request: Request) {
  if (!isValidBearer(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const identityId = await getActiveIdentityId();
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
      if (result.shouldRespond) {
        await handleIncomingMessage(result.lead, identityId);
      }
    } catch (err) {
      failed++;
      console.error("Falha ao sincronizar conversa", conv.linkedin_thread_id, err);
    }
  }

  return NextResponse.json({ updatedLeads, newIncomingMessages, fallbacks, failed });
}
