"use server";

import { parsePastedProfiles, inviteProspects, type ProspectResult } from "@/lib/prospect";

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
