"use server";

import { revalidatePath } from "next/cache";
import type { KnowledgeMode } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { parseKnowledgeMarkdown, pickSections, replaceKnowledge } from "@/lib/knowledge";

const MODES: KnowledgeMode[] = ["ALWAYS", "ON_DEMAND", "OFF"];
const MAX_IMPORT_CHARS = 600_000;

export type ImportState = { error?: string; imported?: number } | undefined;

// Importa um markdown (arquivo ou texto colado) e SUBSTITUI a base inteira.
export async function importKnowledge(_prev: ImportState, formData: FormData): Promise<ImportState> {
  await requireSession();
  const file = formData.get("file");
  let markdown = String(formData.get("markdown") ?? "");
  if (file instanceof File && file.size > 0) markdown = await file.text();
  markdown = markdown.trim();
  if (!markdown) return { error: "Escolha um arquivo .md ou cole o texto." };
  if (markdown.length > MAX_IMPORT_CHARS) return { error: "Arquivo grande demais (máximo de 600 mil caracteres)." };

  const sections = parseKnowledgeMarkdown(markdown);
  if (sections.length === 0) return { error: "Não encontrei conteúdo no arquivo." };
  await replaceKnowledge(sections);
  revalidatePath("/assistente/conhecimento");
  return { imported: sections.length };
}

export async function setSectionMode(id: string, mode: KnowledgeMode) {
  await requireSession();
  if (!MODES.includes(mode)) return;
  await prisma.knowledgeSection.update({ where: { id }, data: { mode } });
  revalidatePath("/assistente/conhecimento");
}

export async function updateSection(id: string, title: string, content: string): Promise<{ error?: string }> {
  await requireSession();
  if (!title.trim() || !content.trim()) return { error: "Título e texto não podem ficar vazios." };
  await prisma.knowledgeSection.update({ where: { id }, data: { title: title.trim().slice(0, 300), content: content.trim() } });
  revalidatePath("/assistente/conhecimento");
  return {};
}

export async function deleteSection(id: string) {
  await requireSession();
  await prisma.knowledgeSection.delete({ where: { id } });
  revalidatePath("/assistente/conhecimento");
}

export async function clearKnowledge() {
  await requireSession();
  await prisma.knowledgeSection.deleteMany({});
  revalidatePath("/assistente/conhecimento");
}

// Simula a escolha: dada uma mensagem de lead, quais seções entrariam.
export async function testPick(leadMessage: string): Promise<{ titles?: string[]; error?: string }> {
  await requireSession();
  const text = leadMessage.trim();
  if (!text) return { error: "Escreva uma mensagem de exemplo." };
  const candidates = await prisma.knowledgeSection.findMany({ where: { mode: "ON_DEMAND" }, orderBy: { position: "asc" } });
  if (candidates.length === 0) return { titles: [] };
  try {
    const ids = await pickSections(candidates, {
      task: "responder à última mensagem do lead",
      history: [{ sender: "LEAD", content: text }],
    });
    return { titles: ids.map((id) => candidates.find((c) => c.id === id)?.title ?? id) };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Falha ao consultar o modelo." };
  }
}
