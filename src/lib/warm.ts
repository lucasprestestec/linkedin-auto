import { prisma } from "@/lib/prisma";
import { extractConnections, extractFollowers, extractProfileViewers } from "@/lib/edges";
import { getActiveIdentityId } from "@/lib/identity";
import { scoreProfiles } from "@/lib/agent";
import { linkedinProfileSlug, normalizeLinkedinUrl } from "@/lib/linkedin";
import { isExcluded, loadExclusionRules } from "@/lib/exclusion";

// Prospecção quente: gente que já demonstrou interesse no corretor (visitou o
// perfil ou segue a conta). Só ações Engagement da edges.run, e só quando o
// corretor pede — nada disso roda no cron.

export type WarmSource = "viewer" | "follower";

export interface WarmSuggestion {
  linkedinProfileUrl: string;
  firstName: string | null;
  lastName: string | null;
  headline: string | null;
  sources: WarmSource[];
  // Encaixe com o cliente ideal (0-100), quando ele está descrito em Ajustes.
  icpScore: number | null;
  icpReason: string | null;
  // ISO; só para quem visitou o perfil.
  viewedAt: string | null;
}

export interface WarmResult {
  suggestions: WarmSuggestion[];
  // Quantos foram descartados e por quê — a tela explica pro corretor.
  excluded: { anonymous: number; connections: number; leads: number; blocked: number };
  // Fonte que falhou (a outra ainda aparece).
  failed: WarmSource[];
  // "off": cliente ideal não descrito; "error": a IA falhou (lista segue sem nota).
  scoring: "ok" | "off" | "error";
}

function slugFrom(url?: string, handle?: string): string | null {
  return (url && linkedinProfileSlug(url)) || handle?.trim().toLowerCase() || null;
}

// connection_degree não tem formato documentado; cobre "1st", "1", "DISTANCE_1"...
function isFirstDegree(degree?: string): boolean {
  return degree != null && /^(1|1st|first|distance_1)$/i.test(degree.trim());
}

export async function findWarmSuggestions(): Promise<WarmResult> {
  const identityId = await getActiveIdentityId();
  const [viewers, followers, connections, leads] = await Promise.allSettled([
    extractProfileViewers(identityId),
    extractFollowers(identityId),
    extractConnections(identityId),
    prisma.lead.findMany({ select: { linkedinProfileUrl: true } }),
  ]);

  const failed: WarmSource[] = [];
  if (viewers.status === "rejected") {
    failed.push("viewer");
    console.error("Falha ao buscar visitantes do perfil", viewers.reason);
  }
  if (followers.status === "rejected") {
    failed.push("follower");
    console.error("Falha ao buscar seguidores", followers.reason);
  }
  if (connections.status === "rejected") console.error("Falha ao buscar conexões", connections.reason);
  if (leads.status === "rejected") throw leads.reason;

  const leadSlugs = new Set(leads.value.map((l) => linkedinProfileSlug(l.linkedinProfileUrl)));
  const connectionSlugs = new Set(
    connections.status === "fulfilled"
      ? connections.value.map((c) => slugFrom(c.linkedin_profile_url, c.linkedin_profile_handle)).filter(Boolean)
      : [],
  );

  const excluded = { anonymous: 0, connections: 0, leads: 0, blocked: 0 };
  const rules = await loadExclusionRules();
  const bySlug = new Map<string, WarmSuggestion>();

  // Retorna o slug se a pessoa pode receber convite; senão conta o motivo.
  const accept = (slug: string | null, firstDegree = false): slug is string => {
    if (!slug) {
      excluded.anonymous++;
      return false;
    }
    if (leadSlugs.has(slug)) {
      excluded.leads++;
      return false;
    }
    if (firstDegree || connectionSlugs.has(slug)) {
      excluded.connections++;
      return false;
    }
    return true;
  };

  for (const v of viewers.status === "fulfilled" ? viewers.value : []) {
    const slug = slugFrom(v.linkedin_profile_url, v.linkedin_profile_handle);
    if (!accept(slug, isFirstDegree(v.connection_degree))) continue;
    const viewedAt = v.view_date ?? (v.view_timestamp ? new Date(v.view_timestamp).toISOString() : null);
    const existing = bySlug.get(slug);
    if (existing) {
      if (!existing.sources.includes("viewer")) existing.sources.push("viewer");
      if (viewedAt && (!existing.viewedAt || viewedAt > existing.viewedAt)) existing.viewedAt = viewedAt;
      continue;
    }
    bySlug.set(slug, {
      linkedinProfileUrl: normalizeLinkedinUrl(v.linkedin_profile_url ?? "") ?? `https://www.linkedin.com/in/${encodeURIComponent(slug)}`,
      firstName: v.first_name ?? null,
      lastName: v.last_name ?? null,
      headline: v.headline ?? null,
      sources: ["viewer"],
      viewedAt,
      icpScore: null,
      icpReason: null,
    });
  }

  for (const f of followers.status === "fulfilled" ? followers.value : []) {
    const slug = slugFrom(f.linkedin_profile_url, f.linkedin_profile_handle);
    const existing = slug ? bySlug.get(slug) : undefined;
    if (existing) {
      if (!existing.sources.includes("follower")) existing.sources.push("follower");
      existing.headline ??= f.job_title ?? null;
      continue;
    }
    if (!accept(slug)) continue;
    bySlug.set(slug, {
      linkedinProfileUrl: normalizeLinkedinUrl(f.linkedin_profile_url ?? "") ?? `https://www.linkedin.com/in/${encodeURIComponent(slug)}`,
      firstName: f.first_name ?? null,
      lastName: f.last_name ?? null,
      headline: f.job_title ?? null,
      sources: ["follower"],
      viewedAt: null,
      icpScore: null,
      icpReason: null,
    });
  }

  // Mais quente primeiro: visitou E segue > visitou (mais recente antes) > segue.
  const score = (s: WarmSuggestion) => (s.sources.includes("viewer") ? 2 : 0) + (s.sources.includes("follower") ? 1 : 0);
  const allowed = [...bySlug.values()].filter((sug) => {
    const blocked = isExcluded(sug, rules);
    if (blocked) excluded.blocked++;
    return !blocked;
  });
  const suggestions = allowed.sort(
    (a, b) => score(b) - score(a) || (b.viewedAt ?? "").localeCompare(a.viewedAt ?? ""),
  );

  // Nota de encaixe com o cliente ideal; com nota, os melhores sobem.
  let scoring: WarmResult["scoring"] = "off";
  const settings = await prisma.settings.findUnique({ where: { id: "singleton" }, select: { targetAudience: true } });
  if (settings?.targetAudience?.trim() && suggestions.length > 0) {
    try {
      const scores = await scoreProfiles(
        settings.targetAudience,
        suggestions.map((s, i) => ({ id: String(i), name: [s.firstName, s.lastName].filter(Boolean).join(" "), headline: s.headline })),
      );
      for (const sc of scores) {
        const sug = suggestions[Number(sc.id)];
        if (sug) {
          sug.icpScore = sc.score;
          sug.icpReason = sc.reason;
        }
      }
      suggestions.sort((a, b) => (b.icpScore ?? -1) - (a.icpScore ?? -1) || score(b) - score(a));
      scoring = "ok";
    } catch (err) {
      console.error("Falha ao qualificar sugestões", err);
      scoring = "error";
    }
  }

  return { suggestions, excluded, failed, scoring };
}
