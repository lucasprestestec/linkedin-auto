import type { Lead, Settings } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// Instruções que o agente usa pra um lead: as gerais (definidas no admin) e,
// se o lead estiver numa campanha, o texto que o usuário escreveu pra ela —
// somados, pra campanha não apagar as regras gerais.
// Quem o assistente é perante o lead: o nome cadastrado em Conta. É obrigatório (sem ele o assistente não responde).
export function identityBlock(ownerName: string | null | undefined): string | null {
  const name = ownerName?.trim();
  if (!name) return null;
  return (
    `NOME DO CORRETOR (é assim que você se apresenta): ${name}. Se perguntarem seu nome ou quem você é, responda com esse nome, em primeira pessoa. ` +
    "Não invente sobrenome, empresa, cargo, tempo de experiência nem qualquer outro dado sobre você que não esteja neste material."
  );
}

export async function instructionsFor(lead: Pick<Lead, "campaignId">, settings: Pick<Settings, "agentInstructions" | "ownerName">): Promise<string | null> {
  const identity = identityBlock(settings.ownerName);
  const general = [identity, settings.agentInstructions?.trim() || null].filter(Boolean).join("\n\n") || null;
  if (!lead.campaignId) return general;
  const campaign = await prisma.campaign.findUnique({ where: { id: lead.campaignId }, select: { name: true, instructions: true } });
  if (!campaign?.instructions?.trim()) return general;
  const block = `Campanha "${campaign.name}" — o que o corretor quer oferecer e como abordar:\n${campaign.instructions.trim()}`;
  return general ? `${general}\n\n${block}` : block;
}
