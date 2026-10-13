import type { Lead, Settings } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { knowledgeFor, type KnowledgeFocus } from "@/lib/knowledge";

type LeadForMaterial = Pick<Lead, "campaignId" | "firstName" | "lastName" | "jobTitle" | "personal" | "tags">;

// Material que o agente usa pra um lead: as instruções gerais (admin), o texto
// da campanha do lead (somado, pra campanha não apagar as regras gerais) e a
// base de conhecimento — o núcleo sempre e as seções que o assunto pede.
export async function instructionsFor(
  lead: LeadForMaterial,
  settings: Pick<Settings, "agentInstructions">,
  focus: Pick<KnowledgeFocus, "task" | "history"> = { task: "conversar com o lead" },
): Promise<string | null> {
  const general = settings.agentInstructions?.trim() || null;
  const campaign = lead.campaignId ? await prisma.campaign.findUnique({ where: { id: lead.campaignId }, select: { name: true, instructions: true } }) : null;
  const campaignText = campaign?.instructions?.trim() || null;
  const knowledge = await knowledgeFor({
    ...focus,
    lead,
    campaignName: campaign?.name ?? null,
    campaignInstructions: campaignText,
  });

  const parts = [
    general,
    knowledge ? `BASE DE CONHECIMENTO (trechos do manual; se algo não está aqui nem nas instruções, não afirme):\n${knowledge}` : null,
    campaignText ? `Campanha "${campaign!.name}" — o que o corretor quer oferecer e como abordar:\n${campaignText}` : null,
  ].filter(Boolean);
  return parts.length ? parts.join("\n\n") : null;
}
