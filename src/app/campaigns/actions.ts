"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { parsePastedProfiles, inviteProspects, type ProspectResult } from "@/lib/prospect";
import { findWarmSuggestions, type WarmResult, type WarmSuggestion } from "@/lib/warm";
import { findLeadByProfileUrl } from "@/lib/leads";
import { normalizeLinkedinUrl } from "@/lib/linkedin";

export type ParseState = { results: ProspectResult[]; parseId: number; error?: string } | undefined;

export async function parseProfiles(_prevState: ParseState, formData: FormData): Promise<ParseState> {
  const raw = String(formData.get("urls") ?? "");
  const parseId = Date.now();

  const results = await parsePastedProfiles(raw);
  if (results.length === 0) {
    return {
      results: [],
      parseId,
      error: "Nenhum link do LinkedIn válido encontrado. Cole um por linha, ex: https://www.linkedin.com/in/nome-da-pessoa",
    };
  }
  return { results, parseId };
}

export type InviteState = { scheduled: number; skippedForLimit: number; error?: string } | undefined;

export async function invite(candidates: ProspectResult[], campaignId?: string): Promise<InviteState> {
  try {
    const result = await inviteProspects(
      candidates.filter((c) => !c.alreadyLead && !c.excluded).map((c) => ({ linkedinProfileUrl: c.linkedinProfileUrl, campaignId })),
    );
    revalidatePath("/campaigns", "layout");
    return result;
  } catch (err) {
    return { scheduled: 0, skippedForLimit: 0, error: err instanceof Error ? err.message : "Falha ao convidar." };
  }
}

export type WarmState = (WarmResult & { ok: true }) | { ok: false; error: string };

export async function loadWarmSuggestions(): Promise<WarmState> {
  try {
    return { ok: true, ...(await findWarmSuggestions()) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Falha ao buscar sugestões." };
  }
}

export async function inviteWarm(candidates: WarmSuggestion[], campaignId?: string): Promise<InviteState> {
  try {
    // A lista vem do navegador: normaliza de novo e descarta quem virou lead
    // entre a busca e o clique.
    const valid = [];
    for (const c of candidates) {
      const url = normalizeLinkedinUrl(c.linkedinProfileUrl);
      if (!url || (await findLeadByProfileUrl(url))) continue;
      const fullName = [c.firstName, c.lastName].filter(Boolean).join(" ") || undefined;
      valid.push({ linkedinProfileUrl: url, fullName, jobTitle: c.headline ?? undefined, icpScore: c.icpScore ?? undefined, campaignId });
    }
    const result = await inviteProspects(valid);
    revalidatePath("/campaigns", "layout");
    return result;
  } catch (err) {
    return { scheduled: 0, skippedForLimit: 0, error: err instanceof Error ? err.message : "Falha ao convidar." };
  }
}

// ---------------------------------------------------------------------------
// Campanhas: nome + o que oferecer (texto que a IA soma às instruções gerais).
// ---------------------------------------------------------------------------

export type CampaignFormState = { error?: string } | undefined;

function readCampaign(formData: FormData) {
  let audience: string[] = [];
  try {
    const parsed = JSON.parse(String(formData.get("audience") ?? "[]"));
    if (Array.isArray(parsed)) audience = parsed.map((v) => String(v).trim().slice(0, 60)).filter(Boolean).slice(0, 20);
  } catch {}
  const max = Number(formData.get("maxLeads"));
  return {
    name: String(formData.get("name") ?? "").trim().slice(0, 60),
    description: String(formData.get("description") ?? "").trim().slice(0, 200) || null,
    audience,
    instructions: String(formData.get("instructions") ?? "").trim().slice(0, 4000) || null,
    maxLeads: Number.isInteger(max) && max > 0 ? Math.min(max, 5000) : null,
  };
}

export async function createCampaign(_prev: CampaignFormState, formData: FormData): Promise<CampaignFormState> {
  const data = readCampaign(formData);
  if (!data.name) return { error: "Dê um nome à campanha." };
  const campaign = await prisma.campaign.create({ data });
  revalidatePath("/", "layout");
  redirect(`/campaigns/${campaign.id}?novo=1`);
}

export async function updateCampaign(id: string, _prev: CampaignFormState, formData: FormData): Promise<CampaignFormState> {
  const data = readCampaign(formData);
  if (!data.name) return { error: "Dê um nome à campanha." };
  await prisma.campaign.update({ where: { id }, data });
  revalidatePath("/", "layout");
  redirect(`/campaigns/${id}`);
}

export async function setCampaignStatus(id: string, status: "ACTIVE" | "PAUSED" | "FINISHED") {
  if (!["ACTIVE", "PAUSED", "FINISHED"].includes(status)) throw new Error("Status inválido.");
  await prisma.campaign.update({ where: { id }, data: { status } });
  revalidatePath("/", "layout");
}

// As pessoas da campanha continuam em Conversas, só ficam sem campanha.
export async function deleteCampaign(id: string) {
  await prisma.campaign.delete({ where: { id } });
  revalidatePath("/", "layout");
  redirect("/campaigns");
}
