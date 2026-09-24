"use server";

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

export async function invite(candidates: ProspectResult[]): Promise<InviteState> {
  try {
    return await inviteProspects(candidates.filter((c) => !c.alreadyLead));
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

export async function inviteWarm(candidates: WarmSuggestion[]): Promise<InviteState> {
  try {
    // A lista vem do navegador: normaliza de novo e descarta quem virou lead
    // entre a busca e o clique.
    const valid = [];
    for (const c of candidates) {
      const url = normalizeLinkedinUrl(c.linkedinProfileUrl);
      if (!url || (await findLeadByProfileUrl(url))) continue;
      const fullName = [c.firstName, c.lastName].filter(Boolean).join(" ") || undefined;
      valid.push({ linkedinProfileUrl: url, fullName, jobTitle: c.headline ?? undefined });
    }
    return await inviteProspects(valid);
  } catch (err) {
    return { scheduled: 0, skippedForLimit: 0, error: err instanceof Error ? err.message : "Falha ao convidar." };
  }
}
