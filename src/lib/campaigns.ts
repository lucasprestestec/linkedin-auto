import type { Lead, Settings } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// Instruções que o agente usa pra um lead: as da campanha dele, se houver e
// estiverem preenchidas; senão, as instruções gerais (Ajustes → Agente de IA).
export async function instructionsFor(lead: Pick<Lead, "campaignId">, settings: Pick<Settings, "agentInstructions">): Promise<string | null> {
  if (lead.campaignId) {
    const campaign = await prisma.campaign.findUnique({ where: { id: lead.campaignId }, select: { instructions: true } });
    if (campaign?.instructions?.trim()) return campaign.instructions;
  }
  return settings.agentInstructions;
}
