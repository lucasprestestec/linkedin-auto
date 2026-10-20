import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type SyncChannel = "email" | "whatsapp" | "linkedin";
export interface ChannelSync {
  okAt: string | null; // última vez que o canal sincronizou sem erro
  error: string | null; // erro da última tentativa (null = deu certo)
  at: string; // quando essa tentativa terminou
}
export interface SyncReport {
  finishedAt: string; // quando a última rodada chegou ao fim (lastRobotRunAt só marca o começo)
  channels: Partial<Record<SyncChannel, ChannelSync>>;
}

// Fora do ar por mais que isto o canal vira aviso na tela Hoje (a rodada é de poucos minutos).
export const SYNC_STALE_MIN = 45;

export function readSyncReport(raw: unknown): SyncReport | null {
  const r = raw as SyncReport | null;
  return r && typeof r === "object" && typeof r.finishedAt === "string" && r.channels ? r : null;
}

// results: undefined = canal não usado nesta rodada (não mexe no registro); null = deu certo; texto = erro.
export async function recordSyncRound(previous: unknown, results: Partial<Record<SyncChannel, string | null>>, now = new Date()): Promise<void> {
  const prev = readSyncReport(previous)?.channels ?? {};
  const channels: SyncReport["channels"] = { ...prev };
  for (const ch of Object.keys(results) as SyncChannel[]) {
    const error = results[ch];
    if (error === undefined) continue;
    channels[ch] = { okAt: error === null ? now.toISOString() : (prev[ch]?.okAt ?? null), error: error === null ? null : error.slice(0, 200), at: now.toISOString() };
  }
  const report: SyncReport = { finishedAt: now.toISOString(), channels };
  await prisma.settings.update({ where: { id: "singleton" }, data: { syncReport: report as unknown as Prisma.InputJsonValue } });
}

const LABEL: Record<SyncChannel, string> = { email: "E-mail", whatsapp: "WhatsApp", linkedin: "LinkedIn" };

// Avisos para a tela Hoje: canal que falhou na última rodada ou que não sincroniza há tempo.
export function syncAlerts(raw: unknown, now: Date, lastRunAt: Date | null): { key: string; title: string; sub: string }[] {
  const rep = readSyncReport(raw);
  const out: { key: string; title: string; sub: string }[] = [];
  const staleMs = SYNC_STALE_MIN * 60_000;
  if (!rep) return out;
  for (const ch of Object.keys(rep.channels) as SyncChannel[]) {
    const c = rep.channels[ch]!;
    if (c.error) out.push({ key: `sync-${ch}`, title: `${LABEL[ch]} não está sincronizando`, sub: c.error });
  }
  // O robô chamou, mas a rodada não chegou ao fim: está ligado, só não está conseguindo trabalhar.
  const finished = new Date(rep.finishedAt).getTime();
  if (lastRunAt && now.getTime() - lastRunAt.getTime() < staleMs && now.getTime() - finished > staleMs && lastRunAt.getTime() - finished > staleMs) {
    out.push({ key: "sync-round", title: "O assistente está ligado, mas as rodadas não terminam", sub: "Mensagens novas podem demorar a ser lidas. Avise o suporte se continuar." });
  }
  return out;
}
