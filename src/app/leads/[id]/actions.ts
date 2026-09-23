"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { sendMessage } from "@/lib/edges";

export async function sendReply(leadId: string, _prevState: { error?: string } | undefined, formData: FormData) {
  const content = String(formData.get("content") ?? "").trim();
  if (!content) return { error: "Escreva uma mensagem." };

  const lead = await prisma.lead.findUniqueOrThrow({ where: { id: leadId } });

  try {
    const result = await sendMessage(lead.linkedinProfileUrl, content);
    await prisma.message.create({
      data: {
        leadId: lead.id,
        sender: "HUMAN",
        content,
        linkedinMessageId: result.linkedin_message_id,
        deliveredAt: new Date(result.delivered_at),
      },
    });
    await prisma.lead.update({
      where: { id: lead.id },
      data: { status: "CONVERSATION_OPEN", needsHumanReason: null },
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Falha ao enviar mensagem." };
  }

  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/");
  return { error: undefined };
}
