"use server";

import { searchProspects, inviteProspects, type ProspectResult } from "@/lib/prospect";

export type SearchState = { results: ProspectResult[]; query: string; error?: string } | undefined;

export async function search(_prevState: SearchState, formData: FormData): Promise<SearchState> {
  const query = String(formData.get("query") ?? "").trim();
  if (!query) return { results: [], query: "", error: "Escreva o que você está procurando." };

  try {
    const results = await searchProspects(query);
    return { results, query };
  } catch (err) {
    return { results: [], query, error: err instanceof Error ? err.message : "Falha na busca." };
  }
}

export type InviteState = { scheduled: number; skippedForLimit: number; error?: string } | undefined;

export async function invite(candidates: ProspectResult[]): Promise<InviteState> {
  try {
    return await inviteProspects(candidates.filter((c) => !c.alreadyLead));
  } catch (err) {
    return { scheduled: 0, skippedForLimit: 0, error: err instanceof Error ? err.message : "Falha ao convidar." };
  }
}
