import { prisma } from "@/lib/prisma";
import { FEEDBACK_REASONS, MAX_RULES, MAX_RULE_CHARS, parseWritingStyle, type WritingStyle } from "@/lib/writingStyle";

// Sugestões de regra a partir do que o corretor já fez: marcou "não é meu jeito" ou editou o
// texto do assistente antes de aprovar. Regra de contagem simples, sem IA: só sugere depois de
// repetir; quem decide é ele (aceitar ou dispensar).

export interface Suggestion {
  // "reason:long", "edit:emoji_off", "note:<id>"
  key: string;
  text: string;
  // Por que estamos sugerindo, em uma frase.
  evidence: string;
}

export interface EditSample {
  original: string;
  final: string;
}

export interface FeedbackSample {
  id: string;
  reasons: string[];
  note: string | null;
}

export const MIN_EVIDENCE = 3;
const MAX_SUGGESTIONS = 3;
const MAX_NOTES = 4;
// Edição só conta como "encurtou"/"alongou" em mensagens que tinham um tamanho razoável.
const MIN_LENGTH_FOR_EDIT_SIGNAL = 80;

const EMOJI = /\p{Extended_Pictographic}/u;
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

export function buildSuggestions(input: { style: WritingStyle; edits: EditSample[]; feedbacks: FeedbackSample[] }): Suggestion[] {
  const { style } = input;
  if (style.rules.length >= MAX_RULES) return [];
  const existing = new Set(style.rules.map(norm));
  const dismissed = new Set(style.dismissed);
  const out: (Suggestion & { count: number })[] = [];

  const add = (key: string, text: string, count: number, evidence: string) => {
    if (count < MIN_EVIDENCE || dismissed.has(key) || existing.has(norm(text))) return;
    out.push({ key, text: text.slice(0, MAX_RULE_CHARS), evidence, count });
  };

  // 1) Motivos marcados por ele.
  for (const r of FEEDBACK_REASONS) {
    if (!r.rule) continue;
    const n = input.feedbacks.filter((f) => f.reasons.includes(r.key)).length;
    add(`reason:${r.key}`, r.rule, n, `Você marcou "${r.label}" ${plural(n, "vez", "vezes")}.`);
  }

  // 2) O que ele mudou sozinho ao editar.
  const edits = input.edits.filter((e) => e.original.trim() && e.final.trim());
  const shorter = edits.filter((e) => e.original.length >= MIN_LENGTH_FOR_EDIT_SIGNAL && e.final.length <= e.original.length * 0.7).length;
  const longer = edits.filter((e) => e.original.length >= MIN_LENGTH_FOR_EDIT_SIGNAL && e.final.length >= e.original.length * 1.4).length;
  const noEmoji = edits.filter((e) => EMOJI.test(e.original) && !EMOJI.test(e.final)).length;
  const fewerQuestions = edits.filter((e) => (e.original.match(/\?/g) ?? []).length > (e.final.match(/\?/g) ?? []).length).length;
  // Encurtar e alongar ao mesmo tempo não dá sinal claro: só o que aparece mais vezes.
  if (shorter >= longer) add("edit:shorter", "Escreva mensagens mais curtas: no máximo 2 frases.", shorter, `Você encurtou ${plural(shorter, "mensagem", "mensagens")} antes de enviar.`);
  else add("edit:longer", "Escreva mensagens um pouco mais completas, com duas ou três frases.", longer, `Você alongou ${plural(longer, "mensagem", "mensagens")} antes de enviar.`);
  add("edit:emoji_off", "Não use emojis.", noEmoji, `Você tirou o emoji de ${plural(noEmoji, "mensagem", "mensagens")}.`);
  add("edit:one_question", "Faça uma pergunta só por mensagem.", fewerQuestions, `Você tirou perguntas de ${plural(fewerQuestions, "mensagem", "mensagens")}.`);

  // Mesma ideia vinda de dois caminhos (marcou "muito longa" e também encurtou): fica a de maior contagem.
  const byText = new Map<string, Suggestion & { count: number }>();
  for (const s of out) {
    const k = norm(s.text);
    const prev = byText.get(k);
    if (!prev || s.count > prev.count) byText.set(k, s);
  }

  const suggestions = [...byText.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, MAX_SUGGESTIONS)
    .map(({ key, text, evidence }) => ({ key, text, evidence }));

  // 3) Observações escritas por ele: entram como "virar regra" com o texto dele.
  const notes = input.feedbacks
    .filter((f) => f.note?.trim() && !dismissed.has(`note:${f.id}`))
    .slice(0, MAX_NOTES)
    .map((f) => ({ key: `note:${f.id}`, text: f.note!.trim().replace(/\s+/g, " ").slice(0, MAX_RULE_CHARS), evidence: "Observação sua." }))
    .filter((n) => !existing.has(norm(n.text)));

  return [...suggestions, ...notes];
}

const WINDOW_MS = 60 * 24 * 60 * 60 * 1000;

export async function loadSuggestions(style?: WritingStyle): Promise<Suggestion[]> {
  const since = new Date(Date.now() - WINDOW_MS);
  const [settings, drafts, feedbacks] = await Promise.all([
    style ? null : prisma.settings.findUnique({ where: { id: "singleton" }, select: { writingStyle: true } }),
    prisma.draft.findMany({
      where: { originalContent: { not: null }, decidedAt: { gte: since }, status: { in: ["APPROVED", "SENT"] } },
      select: { originalContent: true, content: true },
      orderBy: { decidedAt: "desc" },
      take: 200,
    }),
    prisma.agentFeedback.findMany({ where: { createdAt: { gte: since } }, select: { id: true, reasons: true, note: true }, orderBy: { createdAt: "desc" }, take: 200 }),
  ]);
  return buildSuggestions({
    style: style ?? parseWritingStyle(settings?.writingStyle),
    edits: drafts.map((d) => ({ original: d.originalContent ?? "", final: d.content })),
    feedbacks,
  });
}
