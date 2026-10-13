import type { Lead, Settings } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { knowledgeFor, type KnowledgeFocus } from "@/lib/knowledge";

type LeadForMaterial = Pick<Lead, "campaignId" | "firstName" | "lastName" | "jobTitle" | "personal" | "tags"> & Partial<Pick<Lead, "kind" | "referredBy">>;

// Quem o assistente é perante o lead: o nome cadastrado em Conta. É obrigatório (sem ele o assistente não responde).
// Com uma assistente de nome próprio (admin, ex.: "Helena"), esse nome é o do
// corretor/especialista de quem ela fala — ela não se apresenta como ele.
export function identityBlock(ownerName: string | null | undefined, assistantName?: string | null): string | null {
  const name = ownerName?.trim();
  const assistant = assistantName?.trim();
  if (assistant) {
    return (
      `VOCÊ É ${assistant}, assistente${name ? ` de ${name} (o corretor/especialista dono da conta)` : " do corretor"}. Apresente-se como ${assistant}, ` +
      `do jeito que o material define; nunca diga que é ${name || "o corretor"} nem fale em nome dele em primeira pessoa. ` +
      "Não invente dados sobre você, sobre o corretor ou sobre a empresa que não estejam neste material."
    );
  }
  if (!name) return null;
  return (
    `NOME DO CORRETOR (é assim que você se apresenta): ${name}. Se perguntarem seu nome ou quem você é, responda com esse nome, em primeira pessoa. ` +
    "Não invente sobrenome, empresa, cargo, tempo de experiência nem qualquer outro dado sobre você que não esteja neste material."
  );
}

// Material que o agente usa pra um lead: a identidade, as instruções gerais
// (admin), a base de conhecimento (o núcleo sempre e as seções que o assunto
// pede) e o texto da campanha do lead — somados, pra campanha não apagar as
// regras gerais.
export async function instructionsFor(
  lead: LeadForMaterial,
  settings: Pick<Settings, "agentInstructions" | "ownerName" | "assistantName">,
  focus: Pick<KnowledgeFocus, "task" | "history"> = { task: "conversar com o lead" },
): Promise<string | null> {
  const identity = identityBlock(settings.ownerName, settings.assistantName);
  const campaign = lead.campaignId ? await prisma.campaign.findUnique({ where: { id: lead.campaignId }, select: { name: true, instructions: true } }) : null;
  const campaignText = campaign?.instructions?.trim() || null;
  const knowledge = await knowledgeFor({
    ...focus,
    lead,
    campaignName: campaign?.name ?? null,
    campaignInstructions: campaignText,
  });

  const parts = [
    identity,
    settings.agentInstructions?.trim() || null,
    knowledge ? `BASE DE CONHECIMENTO (trechos do manual; se algo não está aqui nem nas instruções, não afirme):\n${knowledge}` : null,
    campaignText ? `Campanha "${campaign!.name}" — o que o corretor quer oferecer e como abordar:\n${campaignText}` : null,
  ].filter(Boolean);
  return parts.length ? parts.join("\n\n") : null;
}
