import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { extractConversations } from "@/lib/edges";
import { getActiveIdentityId } from "@/lib/identity";
import { handleIncomingMessage } from "@/lib/respond";
import { isValidBearer } from "@/lib/auth";
import { syncLeadFromConversation } from "@/lib/leads";

// Agendador externo (cron-job.org) chama este endpoint periodicamente, a cada poucos minutos.
// Sincroniza as conversas e, para cada mensagem nova do lead, aciona o
// agente de IA (que decide responder ou pedir handoff humano).
export async function GET(request: Request) {
  if (!isValidBearer(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const identityId = await getActiveIdentityId();
  const conversations = await extractConversations(identityId);
  let updatedLeads = 0;
  let newIncomingMessages = 0;
  let failed = 0;

  // Uma conversa com problema não pode derrubar a sincronização das outras.
  for (const conv of conversations) {
    try {
      const lead = await syncLeadFromConversation(conv);
      updatedLeads++;

      const existingMessage = await prisma.message.findUnique({
        where: { linkedinMessageId: conv.last_message.message_id },
      });
      if (existingMessage) continue;

      const isFromLead = conv.last_message.first_name === conv.first_name;
      await prisma.message.create({
        data: {
          leadId: lead.id,
          sender: isFromLead ? "LEAD" : "AGENT",
          content: conv.last_message.content,
          linkedinMessageId: conv.last_message.message_id,
          deliveredAt: new Date(conv.last_message.delivered_at),
        },
      });

      if (isFromLead) {
        newIncomingMessages++;
        await handleIncomingMessage(lead, identityId);
      }
    } catch (err) {
      failed++;
      console.error("Falha ao sincronizar conversa", conv.linkedin_thread_id, err);
    }
  }

  return NextResponse.json({ updatedLeads, newIncomingMessages, failed });
}
