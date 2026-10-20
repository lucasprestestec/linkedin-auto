import type { MessageChannel } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { FEEDBACK_REASONS } from "@/lib/writingStyle";
import type { Scenario } from "./scenarios";

// Cada "não é meu jeito" guardado vira um caso de teste: a conversa (sem o nome da pessoa) até a última mensagem
// do lead, e uma rubrica dizendo o que o corretor reprovou. Assim a próxima mudança tem que continuar acertando.

export const FEEDBACK_PREFIX = "fb-";

export interface FeedbackRow {
  id: string;
  agentText: string | null;
  reasons: string[];
  note: string | null;
  corrected: string | null;
  context: unknown;
}

type Turn = { sender: "LEAD" | "AGENT" | "HUMAN"; channel: MessageChannel; content: string };

function turnsOf(context: unknown): Turn[] {
  if (!Array.isArray(context)) return [];
  return context.filter((m): m is Turn => Boolean(m) && typeof m.content === "string" && (m.sender === "LEAD" || m.sender === "AGENT" || m.sender === "HUMAN"));
}

export function buildFeedbackScenario(row: FeedbackRow): Scenario | null {
  const turns = turnsOf(row.context);
  // O assistente responde à última mensagem da pessoa: o que veio depois dela (a resposta criticada) sai do histórico.
  const lastLead = turns.findLastIndex((t) => t.sender === "LEAD");
  if (lastLead < 0) return null;
  const history = turns.slice(0, lastLead + 1);
  const labels = row.reasons.map((r) => FEEDBACK_REASONS.find((x) => x.key === r)?.label).filter((l): l is string => Boolean(l));
  const rubric = [
    "CASO REAL corrigido pelo corretor.",
    row.agentText ? `O assistente tinha escrito: "${row.agentText}".` : null,
    `O corretor reprovou${labels.length ? ` (${labels.join("; ")})` : ""}${row.note ? `: ${row.note}` : "."}`,
    row.corrected ? `O corretor teria dito: "${row.corrected}".` : null,
    "A nova resposta não pode repetir esse erro e tem que ficar pelo menos tão boa quanto a correção do corretor.",
  ]
    .filter(Boolean)
    .join(" ");
  return {
    id: `${FEEDBACK_PREFIX}${row.id}`,
    title: `Correção: ${(row.note || labels.join(", ") || "sem nota").slice(0, 60)}`,
    category: "correções",
    lead: { firstName: "Contato", lastName: "", jobTitle: "", status: "CONVERSATION_OPEN" },
    history: history.map((t) => ({ sender: t.sender, content: t.content })),
    channel: history[lastLead].channel,
    expect: "either",
    helena: true,
    rubric,
  };
}

const SELECT = { id: true, agentText: true, reasons: true, note: true, corrected: true, context: true } as const;

export async function loadFeedbackScenarios(limit = 50): Promise<Scenario[]> {
  const rows = await prisma.agentFeedback.findMany({ orderBy: { createdAt: "desc" }, take: limit, select: SELECT });
  return rows.map(buildFeedbackScenario).filter((s): s is Scenario => Boolean(s));
}

export async function loadFeedbackScenario(scenarioId: string): Promise<Scenario | null> {
  const row = await prisma.agentFeedback.findUnique({ where: { id: scenarioId.slice(FEEDBACK_PREFIX.length) }, select: SELECT });
  return row ? buildFeedbackScenario(row) : null;
}

// Passou: o avaliador deu nota alta de competência e não achou invenção nem regra quebrada.
export function passed(r: { ok: boolean; judge?: { competence: number; invented: boolean; brokeRule: boolean } }): boolean {
  return r.ok && Boolean(r.judge) && r.judge!.competence >= 4 && !r.judge!.invented && !r.judge!.brokeRule;
}
