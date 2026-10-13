import type OpenAI from "openai";
import type { KnowledgeMode, KnowledgeSection, MessageChannel, MessageSender } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { completeWithTool, fastModel, nousClient } from "@/lib/agent";

// ---------------------------------------------------------------------------
// Base de conhecimento: um markdown grande (manual da corretora, fichas de
// produto, textos aprovados) dividido em seções pelos títulos. Mandar tudo em
// toda mensagem sai caro e piora a resposta, então cada seção tem um modo:
// ALWAYS (núcleo: identidade, proibições, encaminhamentos), ON_DEMAND (entra
// quando o assunto aparece) ou OFF (guardada, nunca usada).
// ---------------------------------------------------------------------------

export interface ParsedSection {
  title: string;
  content: string;
  mode: KnowledgeMode;
}

// Seção grande com subtítulos (## ) vira uma seção por subtítulo.
const SPLIT_ABOVE = 8000;
// Seção que cabe no núcleo por padrão (o resto entra sob demanda).
const ALWAYS_UP_TO = 6500;
const OFF_TITLES = /índice|sumário|fontes|referências|pendências|mensagens de teste|changelog|histórico de vers/i;
const ON_DEMAND_TITLES = /glossário|anexo|apêndice/i;

function cleanTitle(t: string) {
  return t.replace(/[*_`]/g, "").replace(/\s+/g, " ").trim();
}

function splitByHeading(text: string, level: 1 | 2): { title: string | null; content: string }[] {
  const re = level === 1 ? /^#\s+(.+)$/ : /^##\s+(.+)$/;
  const out: { title: string | null; lines: string[] }[] = [];
  let cur: { title: string | null; lines: string[] } = { title: null, lines: [] };
  let fence = false;
  for (const line of text.split("\n")) {
    if (/^\s*```/.test(line)) fence = !fence;
    const m = fence ? null : line.match(re);
    if (m) {
      out.push(cur);
      cur = { title: cleanTitle(m[1]), lines: [line] };
    } else {
      cur.lines.push(line);
    }
  }
  out.push(cur);
  return out.map((s) => ({ title: s.title, content: s.lines.join("\n").trim() })).filter((s) => s.content);
}

export function parseKnowledgeMarkdown(markdown: string): ParsedSection[] {
  const text = markdown.replace(/\r\n?/g, "\n");
  const top = splitByHeading(text, 1);
  // Sem nenhum "# ": tenta dividir pelos "## "; sem nenhum, vira uma seção só.
  if (!top.some((s) => s.title)) {
    const kids = splitByHeading(text, 2);
    return kids.map((k) => ({ title: k.title ?? "Introdução", content: k.content, mode: defaultMode(k.title ?? "", k.content, false) }));
  }

  const sections: ParsedSection[] = [];
  top.forEach((s, i) => {
    const title = s.title ?? "Introdução";
    const kids = splitByHeading(s.content, 2);
    const hasKids = kids.some((k) => k.title);
    // O primeiro título costuma ser o nome do documento, com o preâmbulo (como
    // ler, índice) em subtítulos: divide pra poder desligar o índice.
    const preamble = i === 0 && hasKids;
    if (hasKids && (s.content.length > SPLIT_ABOVE || preamble)) {
      for (const k of kids) {
        const childTitle = k.title ? `${title} › ${k.title}` : title;
        // Introdução da seção e preâmbulo do documento: núcleo; subtítulos: sob demanda.
        sections.push({ title: childTitle, content: k.content, mode: defaultMode(childTitle, k.content, Boolean(k.title) && !preamble) });
      }
    } else {
      sections.push({ title, content: s.content, mode: defaultMode(title, s.content, false) });
    }
  });
  return sections;
}

function defaultMode(title: string, content: string, isChild: boolean): KnowledgeMode {
  if (OFF_TITLES.test(title)) return "OFF";
  if (isChild || ON_DEMAND_TITLES.test(title)) return "ON_DEMAND";
  return content.length <= ALWAYS_UP_TO ? "ALWAYS" : "ON_DEMAND";
}

// ~4 caracteres por token em português: só pra dar noção de custo na tela.
export function approxTokens(chars: number) {
  return Math.round(chars / 4);
}

export async function replaceKnowledge(sections: ParsedSection[]) {
  await prisma.$transaction([
    prisma.knowledgeSection.deleteMany({}),
    prisma.knowledgeSection.createMany({ data: sections.map((s, position) => ({ ...s, position })) }),
  ]);
}

// ---------------------------------------------------------------------------
// Escolha das seções sob demanda: um modelo rápido lê o índice e a conversa e
// diz quais seções a assistente precisa consultar agora.
// ---------------------------------------------------------------------------

export interface KnowledgeFocus {
  // O que a assistente vai fazer (responder, abrir conversa, retomar...).
  task: string;
  history?: { sender: MessageSender; content: string; channel?: MessageChannel }[];
  lead?: { firstName?: string | null; lastName?: string | null; jobTitle?: string | null; personal?: string | null; tags?: string[] };
  campaignName?: string | null;
  campaignInstructions?: string | null;
}

const MAX_PICKS = 4;

const PICK_TOOL: OpenAI.Chat.Completions.ChatCompletionTool = {
  type: "function",
  function: {
    name: "pick_sections",
    description: "Escolhe as seções da base de conhecimento que a assistente precisa consultar para esta tarefa.",
    parameters: {
      type: "object",
      properties: {
        ids: { type: "array", items: { type: "string" }, description: `Ids das seções (no máximo ${MAX_PICKS}); vazio se nenhuma ajuda.` },
      },
      required: ["ids"],
    },
  },
};

function preview(content: string) {
  return content
    .split("\n")
    .filter((l) => l.trim() && !/^#/.test(l))
    .join(" ")
    .replace(/[*_>`|]/g, "")
    .replace(/\s+/g, " ")
    .slice(0, 140);
}

export async function pickSections(candidates: Pick<KnowledgeSection, "id" | "title" | "content">[], focus: KnowledgeFocus): Promise<string[]> {
  if (candidates.length === 0) return [];
  const byKey = new Map(candidates.map((c, i) => [`s${i + 1}`, c.id]));
  const catalog = candidates.map((c, i) => `s${i + 1} | ${c.title} | ${preview(c.content)}`).join("\n");
  const lead = focus.lead;
  const leadLine = lead
    ? [
        [lead.firstName, lead.lastName].filter(Boolean).join(" "),
        lead.jobTitle,
        lead.tags?.length ? `etiquetas: ${lead.tags.join(", ")}` : "",
        lead.personal ? `ficha: ${lead.personal.slice(0, 300)}` : "",
      ]
        .filter(Boolean)
        .join(" · ")
    : "";
  const recent = (focus.history ?? [])
    .slice(-8)
    .map((m) => `${m.sender === "LEAD" ? "LEAD" : "NÓS"}${m.channel && m.channel !== "LINKEDIN" ? ` [${m.channel}]` : ""}: ${m.content.slice(0, 300)}`)
    .join("\n");

  const response = await completeWithTool(nousClient(), {
    model: fastModel(),
    messages: [
      {
        role: "system",
        content:
          "Você organiza a consulta de uma assistente de vendas a uma base de conhecimento. Leia a tarefa, o lead e a conversa, e escolha no " +
          `máximo ${MAX_PICKS} seções do índice que ela PRECISA consultar agora: os textos aprovados da situação (abertura, cadência, objeção), ` +
          "a ficha do produto em discussão, o fluxo do público (ex.: candidatos, parceiros). Não escolha por precaução: só o que serve. " +
          "Use a ferramenta pick_sections.",
      },
      {
        role: "user",
        content:
          `TAREFA: ${focus.task}\n` +
          (leadLine ? `LEAD: ${leadLine}\n` : "") +
          (focus.campaignName ? `CAMPANHA: ${focus.campaignName}${focus.campaignInstructions ? ` — ${focus.campaignInstructions.slice(0, 400)}` : ""}\n` : "") +
          `\nCONVERSA (mais recente por último):\n${recent || "(nenhuma mensagem ainda)"}\n\nÍNDICE (id | título | começo do texto):\n${catalog}`,
      },
    ],
    tool: PICK_TOOL,
  });
  const call = response.choices[0]?.message?.tool_calls?.[0];
  if (!call || call.type !== "function") return [];
  const { ids } = JSON.parse(call.function.arguments) as { ids?: unknown };
  if (!Array.isArray(ids)) return [];
  const picked = ids.map((k) => byKey.get(String(k).trim())).filter((id): id is string => Boolean(id));
  return [...new Set(picked)].slice(0, MAX_PICKS);
}

// Texto da base que entra no "material" da assistente: o núcleo sempre e as
// seções escolhidas para esta tarefa. Falha na escolha não derruba a mensagem:
// segue só com o núcleo.
export async function knowledgeFor(focus: KnowledgeFocus): Promise<string | null> {
  const sections = await prisma.knowledgeSection.findMany({ where: { mode: { not: "OFF" } }, orderBy: { position: "asc" } });
  if (sections.length === 0) return null;
  const onDemand = sections.filter((s) => s.mode === "ON_DEMAND");
  let picked: string[] = [];
  try {
    picked = await pickSections(onDemand, focus);
  } catch (err) {
    console.error("Falha ao escolher seções da base de conhecimento", err);
  }
  const chosen = new Set(picked);
  const used = sections.filter((s) => s.mode === "ALWAYS" || chosen.has(s.id));
  if (onDemand.length) console.log(`[base] tarefa=${JSON.stringify(focus.task.slice(0, 60))} seções=${JSON.stringify(used.filter((s) => s.mode === "ON_DEMAND").map((s) => s.title))}`);
  if (used.length === 0) return null;
  return used.map((s) => s.content.trim()).join("\n\n");
}
