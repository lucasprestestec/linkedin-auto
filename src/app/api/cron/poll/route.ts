import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { extractConversations } from "@/lib/edges";

// Vercel Cron chama este endpoint periodicamente (ver vercel.json).
// Só sincroniza o estado das conversas no banco — nunca envia nada.
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const conversations = await extractConversations();
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
        // Fase 1: sem agente de IA ainda, toda mensagem nova do lead
        // precisa de humano até a Fase 3 estar pronta.
        await prisma.lead.update({
          where: { id: lead.id },
          data: { status: "NEEDS_HUMAN", needsHumanReason: "Nova mensagem recebida" },
        });
      }
    }
  }

  return NextResponse.json({ updatedLeads, newIncomingMessages });
}
