"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { MAX_RULES, parseWritingStyle, type RuleWarning, type WritingStyle } from "@/lib/writingStyle";
import { interpretChangeRequest } from "@/lib/changeRequests";
import { loadSuggestions } from "@/lib/styleSuggestions";

async function currentStyle(): Promise<WritingStyle> {
  const s = await prisma.settings.findUniqueOrThrow({ where: { id: "singleton" }, select: { writingStyle: true } });
  return parseWritingStyle(s.writingStyle);
}

async function saveStyle(style: WritingStyle) {
  await prisma.settings.update({ where: { id: "singleton" }, data: { writingStyle: style as unknown as Prisma.InputJsonValue } });
  revalidatePath("/settings");
  revalidatePath("/calibrar");
}

// ---------------------------------------------------------------------------
// Calibragem (página /calibrar) e ajustes rápidos
// ---------------------------------------------------------------------------

export type CalibrationPatch = Partial<
  Pick<WritingStyle, "treatment" | "emoji" | "formality" | "length" | "greeting" | "closing" | "approach" | "never" | "always" | "answers" | "choices">
>;

// Junta o que a pessoa acabou de responder ao que já estava salvo. Resposta vazia apaga a anterior.
export async function saveCalibration(patch: CalibrationPatch): Promise<{ style?: WritingStyle; error?: string }> {
  await requireSession();
  const current = await currentStyle();
  const answers = { ...current.answers };
  for (const [k, v] of Object.entries(patch.answers ?? {})) {
    if (typeof v === "string" && v.trim()) answers[k] = v;
    else delete answers[k];
  }
  const merged = parseWritingStyle({
    ...current,
    ...(patch.treatment !== undefined && { treatment: patch.treatment }),
    ...(patch.emoji !== undefined && { emoji: patch.emoji }),
    ...(patch.formality !== undefined && { formality: patch.formality }),
    ...(patch.length !== undefined && { length: patch.length }),
    ...(patch.greeting !== undefined && { greeting: patch.greeting }),
    ...(patch.closing !== undefined && { closing: patch.closing }),
    ...(patch.approach !== undefined && { approach: patch.approach }),
    ...(patch.never !== undefined && { never: patch.never }),
    ...(patch.always !== undefined && { always: patch.always }),
    answers,
    choices: { ...current.choices, ...(patch.choices ?? {}) },
  });
  await saveStyle(merged);
  return { style: merged };
}

export async function finishCalibration(): Promise<{ style: WritingStyle }> {
  await requireSession();
  const style = { ...(await currentStyle()), calibratedAt: new Date().toISOString() };
  await saveStyle(style);
  return { style };
}

// ---------------------------------------------------------------------------
// "Sugerir mudanças": o corretor escreve do jeito dele e nós mostramos o que entendemos.
// ---------------------------------------------------------------------------

export interface ChangeOutcome {
  added: string[];
  already: string[];
  blocked: RuleWarning[];
  notes: RuleWarning[];
  verbatim: boolean;
  rules: string[];
  error?: string;
}

export async function requestStyleChange(text: string): Promise<ChangeOutcome> {
  await requireSession();
  const style = await currentStyle();
  const empty = { added: [], already: [], blocked: [], notes: [], verbatim: false, rules: style.rules };
  const clipped = String(text ?? "").slice(0, 600);
  if (!clipped.trim()) return { ...empty, error: "Escreva o que você quer mudar." };
  const room = MAX_RULES - style.rules.length;
  if (room <= 0) return { ...empty, error: `Você já tem ${MAX_RULES} ajustes. Remova algum para adicionar outro.` };

  const r = interpretChangeRequest(clipped, style.rules, room);
  if (r.added.length > 0) {
    const next = { ...style, rules: [...style.rules, ...r.added] };
    await saveStyle(next);
    return { ...r, rules: next.rules };
  }
  return { ...r, rules: style.rules };
}

export async function removeStyleRule(rule: string): Promise<{ rules: string[] }> {
  await requireSession();
  const style = await currentStyle();
  const rules = style.rules.filter((r) => r !== rule);
  if (rules.length !== style.rules.length) await saveStyle({ ...style, rules });
  return { rules };
}

// ---------------------------------------------------------------------------
// Edição à mão (avançado): só regras e exemplos colados. O resto do perfil não é tocado.
// ---------------------------------------------------------------------------

export async function updateWritingStyle(_prevState: unknown, formData: FormData) {
  await requireSession();
  let incoming: Record<string, unknown> = {};
  try {
    const parsed: unknown = JSON.parse(String(formData.get("writingStyle") ?? "{}"));
    if (parsed && typeof parsed === "object") incoming = parsed as Record<string, unknown>;
  } catch {
    // formulário adulterado: não muda nada
  }
  const current = await currentStyle();
  await saveStyle(parseWritingStyle({ ...current, rules: incoming.rules ?? current.rules, samples: incoming.samples ?? current.samples }));
  return { saved: true };
}

// ---------------------------------------------------------------------------
// Sugestões do assistente (a partir de "Não é meu jeito" e das edições de rascunho)
// ---------------------------------------------------------------------------

const SUGGESTION_KEY = /^(reason|edit|note):[\w-]{1,60}$/;

// O texto da regra vem sempre do servidor (recalculado), nunca do navegador.
export async function acceptStyleSuggestion(key: string): Promise<{ error?: string }> {
  await requireSession();
  if (!SUGGESTION_KEY.test(key)) return { error: "Sugestão inválida." };
  const style = await currentStyle();
  if (style.rules.length >= MAX_RULES) return { error: `Você já tem ${MAX_RULES} ajustes. Remova algum para adicionar outro.` };
  const suggestion = (await loadSuggestions(style)).find((s) => s.key === key);
  if (!suggestion) return { error: "Essa sugestão já não vale mais." };
  await saveStyle({ ...style, rules: [...style.rules, suggestion.text] });
  return {};
}

export async function dismissStyleSuggestion(key: string): Promise<{ error?: string }> {
  await requireSession();
  if (!SUGGESTION_KEY.test(key)) return { error: "Sugestão inválida." };
  const style = await currentStyle();
  await saveStyle(parseWritingStyle({ ...style, dismissed: [...style.dismissed, key] }));
  return {};
}
