import type { CampaignStep, Lead, MessageChannel } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { adaptTemplate } from "@/lib/agent";

// Cadência com texto fixo: os passos de uma campanha (texto aprovado, dia e
// canal). Os campos simples são preenchidos aqui, sem IA, e o texto sai igual
// ao aprovado. Só quando falta um dado ou há concordância de gênero ("o(a)",
// "Dr(a).") a IA ajusta o mínimo.

export type StepDraft = Pick<CampaignStep, "position" | "day" | "channel" | "text" | "notify">;

const DAY_MS = 24 * 60 * 60 * 1000;
const TIME_ZONE = "America/Sao_Paulo";

function greeting(now: Date): string {
  const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone: TIME_ZONE, hour: "numeric", hourCycle: "h23" }).format(now));
  return hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
}

// "Diretora de RH · Grupo Vértice" ou "CEO at Vértice": a empresa depois do separador.
function companyOf(jobTitle: string | null): string | null {
  const m = jobTitle?.match(/(?:\s[·|@]\s|\sat\s|\sna\s|\sno\s)(.+)$/i);
  return m?.[1]?.trim() || null;
}

type LeadFields = Pick<Lead, "firstName" | "lastName" | "jobTitle" | "referredBy">;

// Preenche os campos conhecidos. "complete" = sobrou nada pra IA ajustar.
export function fillTemplate(template: string, lead: LeadFields, now = new Date()): { text: string; complete: boolean } {
  const values: [RegExp, string | null][] = [
    [/\[\s*(?:primeiro\s+)?nome\s*\]/gi, lead.firstName?.trim() || null],
    [/\[\s*sobrenome\s*\]/gi, lead.lastName?.trim() || null],
    [/\[\s*indicador\s*\]/gi, lead.referredBy?.trim() || null],
    [/\[\s*empresa\s*\]/gi, companyOf(lead.jobTitle)],
    [/\[\s*(?:bom dia|boa tarde|boa noite)[^\]]*\]/gi, greeting(now)],
  ];
  let text = template.trim();
  for (const [re, value] of values) if (value) text = text.replace(re, value);
  const leftovers = /\[[^\]]{1,60}\]/.test(text) || /\(a\)|\(o\)/i.test(text);
  return { text, complete: !leftovers };
}

// Texto final de um passo: preenchido direto ou ajustado pela IA quando precisa.
export async function renderStep(
  step: Pick<StepDraft, "text">,
  lead: Lead,
  channel: MessageChannel,
  instructions: string | null,
  previousOutgoing: string[],
): Promise<{ text: string; adapted: boolean }> {
  const filled = fillTemplate(step.text, lead);
  if (filled.complete) return { text: filled.text, adapted: false };
  return { text: await adaptTemplate(instructions, lead, filled.text, channel, previousOutgoing), adapted: true };
}

export function stepDueAt(step: Pick<StepDraft, "day">, firstMessageAt: Date): Date {
  return new Date(firstMessageAt.getTime() + step.day * DAY_MS);
}

export async function campaignSteps(campaignId: string | null): Promise<CampaignStep[]> {
  if (!campaignId) return [];
  return prisma.campaignStep.findMany({ where: { campaignId }, orderBy: { position: "asc" } });
}

// Mensagem inicial (D0) da cadência da campanha, se tiver.
export async function initialStep(campaignId: string | null): Promise<CampaignStep | null> {
  if (!campaignId) return null;
  return prisma.campaignStep.findUnique({ where: { campaignId_position: { campaignId, position: 0 } } });
}

// "D0, D+2, D+4" pra mostrar na tela.
export function describeCadence(steps: Pick<StepDraft, "position" | "day">[]): string {
  return steps.map((s) => (s.day === 0 ? "D0" : `D+${s.day}`)).join(", ");
}
