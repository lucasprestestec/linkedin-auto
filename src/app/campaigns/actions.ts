"use server";

import { requireSession } from "@/lib/session";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { validFollowUp } from "@/lib/settings-ranges";
import { parsePastedProfiles, inviteProspects, type ProspectResult } from "@/lib/prospect";
import { findWarmSuggestions, type WarmResult, type WarmSuggestion } from "@/lib/warm";
import { findLeadByProfileUrl } from "@/lib/leads";
import { linkedinProfileSlug, normalizeLinkedinUrl, type PeopleSearchFilters } from "@/lib/linkedin";
import { searchPeopleOnGoogle, type FoundPerson } from "@/lib/websearch";
import { isExcluded, loadExclusionRules } from "@/lib/exclusion";
import { scoreProfiles } from "@/lib/agent";
import { newCaptureSlug } from "@/lib/capture";

// ---------------------------------------------------------------------------
// Busca de pessoas pelo Google (lib/websearch.ts): a lista aparece no próprio
// sistema, o usuário marca quem quer e convida.
// ---------------------------------------------------------------------------

export interface FoundResult extends FoundPerson {
  alreadyLead: boolean;
  excluded: boolean;
  icpScore: number | null;
  icpReason: string | null;
}

export type SearchState = { ok: true; people: FoundResult[]; hasMore: boolean; left: number } | { ok: false; error: string };

export async function searchPeople(filters: PeopleSearchFilters, page: number): Promise<SearchState> {
  await requireSession();
  try {
    const { people, hasMore, left } = await searchPeopleOnGoogle(filters, Math.max(0, Math.min(9, Math.floor(page))));

    const existing = await prisma.lead.findMany({ select: { linkedinProfileUrl: true } });
    const known = new Set(existing.map((l) => linkedinProfileSlug(l.linkedinProfileUrl)));
    const rules = await loadExclusionRules();
    const results: FoundResult[] = people.map((p) => ({
      ...p,
      alreadyLead: known.has(linkedinProfileSlug(p.linkedinProfileUrl)),
      excluded: isExcluded({ ...p, headline: p.headline }, rules),
      icpScore: null,
      icpReason: null,
    }));

    // Nota de encaixe com o cliente ideal (Nous), se ele estiver preenchido.
    const settings = await prisma.settings.findUnique({ where: { id: "singleton" }, select: { targetAudience: true } });
    const toScore = results.filter((r) => !r.alreadyLead && !r.excluded);
    if (settings?.targetAudience?.trim() && toScore.length > 0) {
      try {
        const scores = await scoreProfiles(
          settings.targetAudience,
          toScore.map((r, i) => ({ id: String(i), name: `${r.firstName} ${r.lastName}`.trim(), headline: r.headline })),
        );
        for (const sc of scores) {
          const r = toScore[Number(sc.id)];
          if (r) {
            r.icpScore = sc.score;
            r.icpReason = sc.reason;
          }
        }
      } catch (err) {
        console.error("Falha ao dar nota aos resultados da busca", err);
      }
    }
    return { ok: true, people: results, hasMore, left };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Falha na busca." };
  }
}

export async function inviteFound(people: FoundResult[], campaignId?: string): Promise<InviteState> {
  await requireSession();
  try {
    const valid = [];
    for (const p of people) {
      const url = normalizeLinkedinUrl(p.linkedinProfileUrl);
      if (!url || (await findLeadByProfileUrl(url))) continue;
      valid.push({
        linkedinProfileUrl: url,
        fullName: `${p.firstName} ${p.lastName}`.trim() || undefined,
        jobTitle: p.headline ?? undefined,
        icpScore: p.icpScore ?? undefined,
        campaignId,
      });
    }
    const result = await inviteProspects(valid);
    revalidatePath("/", "layout");
    return result;
  } catch (err) {
    return { scheduled: 0, skippedForLimit: 0, error: err instanceof Error ? err.message : "Falha ao convidar." };
  }
}

export type ParseState = { results: ProspectResult[]; parseId: number; error?: string } | undefined;

export async function parseProfiles(_prevState: ParseState, formData: FormData): Promise<ParseState> {
  await requireSession();
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
  await requireSession();
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
  await requireSession();
  try {
    return { ok: true, ...(await findWarmSuggestions()) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Falha ao buscar sugestões." };
  }
}

export async function inviteWarm(candidates: WarmSuggestion[], campaignId?: string): Promise<InviteState> {
  await requireSession();
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
  // Follow-up próprio (opcional); fora da faixa permitida, volta pro padrão.
  const fuCount = Number(formData.get("followUpCount"));
  const fuHours = Number(formData.get("followUpDays")) * 24;
  const customFollowUp = formData.get("followUpCustom") === "1" && validFollowUp(fuCount, fuHours);
  return {
    name: String(formData.get("name") ?? "").trim().slice(0, 60),
    description: String(formData.get("description") ?? "").trim().slice(0, 200) || null,
    audience,
    instructions: String(formData.get("instructions") ?? "").trim().slice(0, 4000) || null,
    maxLeads: Number.isInteger(max) && max > 0 ? Math.min(max, 5000) : null,
    followUpMaxCount: customFollowUp ? fuCount : null,
    followUpDelayHours: customFollowUp ? fuHours : null,
  };
}

export async function createCampaign(_prev: CampaignFormState, formData: FormData): Promise<CampaignFormState> {
  await requireSession();
  const data = readCampaign(formData);
  if (!data.name) return { error: "Dê um nome à campanha." };
  const campaign = await prisma.campaign.create({ data });
  revalidatePath("/", "layout");
  redirect(`/campaigns/${campaign.id}?novo=1`);
}

export async function updateCampaign(id: string, _prev: CampaignFormState, formData: FormData): Promise<CampaignFormState> {
  await requireSession();
  const data = readCampaign(formData);
  if (!data.name) return { error: "Dê um nome à campanha." };
  await prisma.campaign.update({ where: { id }, data });
  revalidatePath("/", "layout");
  redirect(`/campaigns/${id}`);
}

export async function setCampaignStatus(id: string, status: "ACTIVE" | "PAUSED" | "FINISHED") {
  await requireSession();
  if (!["ACTIVE", "PAUSED", "FINISHED"].includes(status)) throw new Error("Status inválido.");
  await prisma.campaign.update({ where: { id }, data: { status } });
  revalidatePath("/", "layout");
}

// As pessoas da campanha continuam em Conversas, só ficam sem campanha.
export async function deleteCampaign(id: string) {
  await requireSession();
  await prisma.campaign.delete({ where: { id } });
  revalidatePath("/", "layout");
  redirect("/campaigns");
}

// ---------------------------------------------------------------------------
// Formulário público de captação (link e QR Code) da campanha.
// ---------------------------------------------------------------------------

export async function saveCapture(campaignId: string, input: { on: boolean; title: string; text: string; channel: string }) {
  await requireSession();
  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId }, select: { captureSlug: true } });
  if (!campaign) return { error: "Campanha não encontrada." };
  const channel = input.channel === "EMAIL" || input.channel === "WHATSAPP" ? input.channel : null;
  // O endereço nasce na primeira vez que liga e nunca muda: o QR Code já impresso continua valendo.
  let slug = campaign.captureSlug;
  for (let i = 0; input.on && !slug && i < 5; i++) {
    const candidate = newCaptureSlug();
    if (!(await prisma.campaign.findUnique({ where: { captureSlug: candidate }, select: { id: true } }))) slug = candidate;
  }
  if (input.on && !slug) return { error: "Não consegui criar o endereço agora. Tente de novo." };
  await prisma.campaign.update({
    where: { id: campaignId },
    data: { captureOn: Boolean(input.on), captureSlug: slug, captureTitle: input.title.trim().slice(0, 80) || null, captureText: input.text.trim().slice(0, 400) || null, captureChannel: channel },
  });
  revalidatePath(`/campaigns/${campaignId}`);
  return { ok: true };
}
