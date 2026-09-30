"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { MAX_RULES, parseWritingStyle, type WritingStyle } from "@/lib/writingStyle";
import { loadSuggestions } from "@/lib/styleSuggestions";

async function currentStyle(): Promise<WritingStyle> {
  const s = await prisma.settings.findUniqueOrThrow({ where: { id: "singleton" }, select: { writingStyle: true } });
  return parseWritingStyle(s.writingStyle);
}

async function saveStyle(style: WritingStyle) {
  await prisma.settings.update({ where: { id: "singleton" }, data: { writingStyle: style as unknown as Prisma.InputJsonValue } });
  revalidatePath("/settings");
}

// Salva o "Meu jeito de escrever". As sugestões recusadas não vêm do formulário: ficam como estavam.
export async function updateWritingStyle(_prevState: unknown, formData: FormData) {
  await requireSession();
  let incoming: unknown = {};
  try {
    incoming = JSON.parse(String(formData.get("writingStyle") ?? "{}"));
  } catch {
    // formulário adulterado: cai no estilo vazio
  }
  const current = await currentStyle();
  const next = parseWritingStyle({ ...(incoming as Record<string, unknown>), dismissed: current.dismissed });
  await saveStyle(next);
  return { saved: true };
}

const SUGGESTION_KEY = /^(reason|edit|note):[\w-]{1,60}$/;

// O texto da regra vem sempre do servidor (recalculado), nunca do navegador.
export async function acceptStyleSuggestion(key: string): Promise<{ error?: string }> {
  await requireSession();
  if (!SUGGESTION_KEY.test(key)) return { error: "Sugestão inválida." };
  const style = await currentStyle();
  if (style.rules.length >= MAX_RULES) return { error: `Você já tem ${MAX_RULES} regras. Apague alguma para adicionar outra.` };
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
