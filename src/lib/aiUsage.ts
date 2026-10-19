import { AsyncLocalStorage } from "node:async_hooks";
import type OpenAI from "openai";
import { prisma } from "@/lib/prisma";
import { startOfDaySP } from "@/lib/mailboxPolicy";

// Registro de cada chamada à IA. Uma "interação com IA" (o que os planos limitam) é toda chamada que
// decide ou escreve algo; a escolha de trechos do manual e as avaliações do banco de testes (custo do dono, não do cliente) não contam.
export const NON_COUNTED_PURPOSES = ["trechos", "avaliacao"];

// Quem é a pessoa da conversa em andamento: quem chama a IA não precisa repassar isso a cada chamada.
const leadScope = new AsyncLocalStorage<{ leadId: string | null }>();

// Faz toda chamada de IA feita por fn ser gravada com a pessoa da conversa.
export function withLeadScope<A extends unknown[], R>(fn: (...args: A) => Promise<R>, leadIdOf: (args: NoInfer<A>) => string | null | undefined): (...args: A) => Promise<R> {
  return (...args) => leadScope.run({ leadId: leadIdOf(args) ?? null }, () => fn(...args));
}

// Versão para um trecho avulso (ex.: entender o áudio que a pessoa mandou).
export function runInLeadScope<R>(leadId: string, fn: () => Promise<R>): Promise<R> {
  return leadScope.run({ leadId }, fn);
}

// Teto de interações com IA por pessoa no mês ("uso justo"): passou disso, a conversa vai para o corretor.
export const MAX_AI_PER_CONVERSATION = 30;

export async function aiInteractionsForLeadThisMonth(leadId: string, now = new Date()): Promise<number> {
  return prisma.aiUsage.count({ where: { leadId, createdAt: { gte: startOfMonthSP(now) }, purpose: { notIn: NON_COUNTED_PURPOSES } } });
}

// Conversas do mês: pessoas diferentes com quem a Helena trocou mensagem (uma ou muitas mensagens contam uma vez).
export async function conversationsThisMonth(now = new Date()): Promise<number> {
  const rows = await prisma.message.groupBy({ by: ["leadId"], where: { sender: "AGENT", createdAt: { gte: startOfMonthSP(now) } } });
  return rows.length;
}

type ApiUsage = OpenAI.Completions.CompletionUsage & { cost?: number };

// Nunca derruba quem chamou: falha ao registrar só vai para o log.
export async function recordAiUsage(purpose: string, model: string, response: { usage?: unknown }): Promise<void> {
  try {
    const u = response.usage as ApiUsage | undefined;
    await prisma.aiUsage.create({
      data: { purpose, model, leadId: leadScope.getStore()?.leadId ?? null, inputTokens: u?.prompt_tokens ?? 0, outputTokens: u?.completion_tokens ?? 0, costUsd: typeof u?.cost === "number" ? u.cost : null },
    });
  } catch (err) {
    console.error("Falha ao registrar uso de IA", err instanceof Error ? err.message : err);
  }
}

// Primeiro instante do mês corrente em Brasília.
export function startOfMonthSP(now = new Date()): Date {
  const day = startOfDaySP(now);
  const sp = new Date(day.getTime() - 3 * 3600 * 1000); // relógio de Brasília como se fosse UTC
  return new Date(Date.UTC(sp.getUTCFullYear(), sp.getUTCMonth(), 1, 3, 0, 0));
}

// Interações com IA neste mês (o que o limite do plano vai medir).
export async function aiInteractionsThisMonth(now = new Date()): Promise<number> {
  return prisma.aiUsage.count({ where: { createdAt: { gte: startOfMonthSP(now) }, purpose: { notIn: NON_COUNTED_PURPOSES } } });
}

// Resumo do mês: interações, tokens e custo (o informado pelo provedor; sem ele, estimativa pelos tokens do Haiku 5.5).
export async function aiUsageSummary(now = new Date()): Promise<{ conversations: number; interactions: number; inputTokens: number; outputTokens: number; costUsd: number; byPurpose: Record<string, number> }> {
  const rows = await prisma.aiUsage.findMany({ where: { createdAt: { gte: startOfMonthSP(now) } }, select: { purpose: true, inputTokens: true, outputTokens: true, costUsd: true } });
  let inputTokens = 0, outputTokens = 0, costUsd = 0, interactions = 0;
  const byPurpose: Record<string, number> = {};
  for (const r of rows) {
    inputTokens += r.inputTokens;
    outputTokens += r.outputTokens;
    // ponytail: preço fixo do Haiku 5.5 (US$ 0,10 / 0,50 por milhão); trocar por tabela de preços se o modelo mudar.
    costUsd += r.costUsd ?? (r.inputTokens * 0.1 + r.outputTokens * 0.5) / 1e6;
    byPurpose[r.purpose] = (byPurpose[r.purpose] ?? 0) + 1;
    if (!NON_COUNTED_PURPOSES.includes(r.purpose)) interactions++;
  }
  return { conversations: await conversationsThisMonth(now), interactions, inputTokens, outputTokens, costUsd, byPurpose };
}
