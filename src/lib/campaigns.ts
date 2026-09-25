import type { Lead, Settings } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// Instruções que o agente usa pra um lead: as gerais (definidas no admin) e,
// se o lead estiver numa campanha, o texto que o usuário escreveu pra ela —
// somados, pra campanha não apagar as regras gerais.
export async function instructionsFor(lead: Pick<Lead, "campaignId">, settings: Pick<Settings, "agentInstructions">): Promise<string | null> {
  const general = settings.agentInstructions?.trim() || null;
  if (!lead.campaignId) return general;
  const campaign = await prisma.campaign.findUnique({ where: { id: lead.campaignId }, select: { name: true, instructions: true } });
  if (!campaign?.instructions?.trim()) return general;
  const block = `Campanha "${campaign.name}" — o que o corretor quer oferecer e como abordar:\n${campaign.instructions.trim()}`;
  return general ? `${general}\n\n${block}` : block;
}
