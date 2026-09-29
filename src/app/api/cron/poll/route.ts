import { NextResponse } from "next/server";
import { extractConversations } from "@/lib/edges";
import { activeIdentityIdOrNull } from "@/lib/identity";
import { handleIncomingMessage } from "@/lib/respond";
import { isValidBearer } from "@/lib/auth";
import { syncConversation } from "@/lib/sync";
import { runProactive } from "@/lib/followup";
import { isWithinWorkHours } from "@/lib/schedule";
import { prisma } from "@/lib/prisma";
import { syncEmailInbox } from "@/lib/emailSync";
import { maybeSendDailySummary } from "@/lib/dailySummary";

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

  const settings = await prisma.settings.findUniqueOrThrow({ where: { id: "singleton" } });
  const canReplyNow = settings.automationPaused || isWithinWorkHours(settings);
  const identityId = await activeIdentityIdOrNull();

  // E-mail primeiro (independe do LinkedIn): grava o que chegou e responde pelo
  // mesmo canal. Fora do horário a resposta espera, como no LinkedIn.
  let email: { read: number; saved: number; error?: string } = { read: 0, saved: 0 };
  try {
    const r = await syncEmailInbox();
    email = { read: r.read, saved: r.saved };
    if (canReplyNow) for (const lead of r.leads) await handleIncomingMessage(lead, identityId);
  } catch (err) {
    console.error("Falha ao ler a caixa de e-mail", err);
    email.error = err instanceof Error ? err.message : "erro desconhecido";
  }

  // Canais independentes: sem LinkedIn conectado, o e-mail segue sozinho.
  const conversations = identityId ? await extractConversations(identityId) : [];
  let updatedLeads = 0;
  let newIncomingMessages = 0;
  let fallbacks = 0;
  let failed = 0;

  // Uma conversa com problema não pode derrubar a sincronização das outras.
  for (const conv of conversations) {
    try {
      const result = await syncConversation(conv, identityId!);
      updatedLeads++;
      newIncomingMessages += result.saved.filter((m) => m.fromLead).length;
      if (result.usedFallback) fallbacks++;

      // Uma resposta por conversa, depois de gravar tudo que chegou — o agente
      // lê o histórico completo, então vê todas as mensagens novas de uma vez.
      // Fora do horário de trabalho a resposta espera: runProactive responde
      // quando a janela abrir. Pausado responde na hora (marca pra você).
      if (result.shouldRespond && canReplyNow) {
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

  // Fim do expediente: resumo do dia (uma vez por dia).
  let summary;
  try {
    summary = await maybeSendDailySummary(settings);
  } catch (err) {
    console.error("Falha no resumo do dia", err);
    summary = { error: err instanceof Error ? err.message : "erro desconhecido" };
  }

  return NextResponse.json({ summary, email, linkedin: identityId ? "conectado" : "não conectado", updatedLeads, newIncomingMessages, fallbacks, failed, proactive });
}
