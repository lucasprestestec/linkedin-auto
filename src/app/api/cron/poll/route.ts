import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { extractConversations } from "@/lib/edges";
import { getActiveIdentityId } from "@/lib/identity";
import { handleIncomingMessage } from "@/lib/respond";

// Agendador externo chama este endpoint periodicamente (ver vercel.json).
// Sincroniza as conversas e, para cada mensagem nova do lead, aciona o
// agente de IA (que decide responder ou pedir handoff humano).
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const identityId = await getActiveIdentityId();
  const conversations = await extractConversations(identityId);
  let updatedLeads = 0;
  let newIncomingMessages = 0;

  for (const conv of conversations) {
    const lead = await prisma.lead.upsert({
      where: { linkedinThreadId: conv.linkedin_thread_id },
      update: {
        firstName: conv.first_name,
        lastName: conv.last_name,
        jobTitle: conv.job_title,
      },
      create: {
        linkedinProfileUrl: conv.linkedin_profile_url,
        linkedinThreadId: conv.linkedin_thread_id,
        firstName: conv.first_name,
        lastName: conv.last_name,
        jobTitle: conv.job_title,
        status: "CONVERSATION_OPEN",
      },
    });
    updatedLeads++;

    const existingMessage = await prisma.message.findUnique({
      where: { linkedinMessageId: conv.last_message.message_id },
    });

    if (!existingMessage) {
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
    }
  }

  return NextResponse.json({ updatedLeads, newIncomingMessages });
}
