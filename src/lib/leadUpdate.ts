import type OpenAI from "openai";
import type { DealStage } from "@prisma/client";
import { completeWithTool, fastModel, nousClient, type Completer } from "@/lib/agent";
import { runInLeadScope } from "@/lib/aiUsage";
import { DEAL_LABEL, parseDealStage } from "@/lib/deal";

// Atualização da ficha por voz: o corretor fala ("conversei com a Ana, são 40 funcionários, quer proposta sexta"),
// a IA propõe o que mudar e ele confirma item por item. Nada é gravado sem a confirmação.

export interface UpdateProposal {
  summary: string;
  note: string | null; // texto para somar às anotações
  personal: string | null; // fatos da pessoa para "o que você sabe"
  tasks: { title: string; due: string | null }[]; // due = AAAA-MM-DD (dia em Brasília)
  deal: { stage: DealStage; valueCents: number | null; reason: string | null } | null;
}

export const EMPTY_PROPOSAL: UpdateProposal = { summary: "", note: null, personal: null, tasks: [], deal: null };

const MAX_TASKS = 5;
const text = (v: unknown, max: number): string | null => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);

// Dia de hoje em Brasília (AAAA-MM-DD).
export function todaySP(now = new Date()): string {
  return now.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

// Data válida, de hoje até 2 anos à frente; qualquer outra coisa vira "sem data".
export function validDue(value: unknown, today: string): string | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(`${value}T12:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value) return null;
  const limit = new Date(`${today}T12:00:00Z`);
  limit.setUTCFullYear(limit.getUTCFullYear() + 2);
  return value >= today && d <= limit ? value : null;
}

// Aceita só o que cabe nas regras (a resposta do modelo e o que volta do navegador passam por aqui).
export function sanitizeProposal(raw: unknown, today = todaySP()): UpdateProposal {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const tasks = (Array.isArray(r.tasks) ? r.tasks : [])
    .map((t) => {
      const o = (t && typeof t === "object" ? t : {}) as Record<string, unknown>;
      const title = text(o.title, 160);
      return title ? { title, due: validDue(o.due, today) } : null;
    })
    .filter((t): t is { title: string; due: string | null } => t !== null)
    .slice(0, MAX_TASKS);
  const d = r.deal && typeof r.deal === "object" ? (r.deal as Record<string, unknown>) : null;
  const stage = d ? parseDealStage(d.stage) : null;
  // A IA manda em reais; a proposta já limpa volta do navegador em centavos. Aceita os dois.
  const okNum = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n) && n >= 0 && n < 1e9;
  const value = d ? (okNum(d.valueReais) ? Math.round(d.valueReais * 100) : okNum(d.valueCents) ? Math.round(d.valueCents) : null) : null;
  return {
    summary: text(r.summary, 300) ?? "",
    note: text(r.note, 2000),
    personal: text(r.personal, 1000),
    tasks,
    deal: stage ? { stage, valueCents: value, reason: text(d?.reason, 300) } : null,
  };
}

export const isEmptyProposal = (p: UpdateProposal) => !p.note && !p.personal && p.tasks.length === 0 && !p.deal;

const TOOL: OpenAI.Chat.Completions.ChatCompletionTool = {
  type: "function",
  function: {
    name: "propor_atualizacao",
    description: "Propõe o que mudar na ficha da pessoa a partir do que o corretor falou. Só o que foi dito.",
    parameters: {
      type: "object",
      properties: {
        summary: { type: "string", description: "Uma frase dizendo o que você entendeu." },
        note: { type: "string", description: "Texto curto para somar às anotações da pessoa (o que aconteceu na conversa). Vazio se nada a anotar." },
        personal: { type: "string", description: "Fatos duradouros sobre a pessoa ou a empresa (nº de funcionários, família, preferências). Vazio se não houver." },
        tasks: {
          type: "array",
          description: "Compromissos e lembretes que o corretor assumiu. No máximo 5.",
          items: {
            type: "object",
            properties: {
              title: { type: "string", description: "Ação curta no imperativo, ex.: 'Enviar proposta'." },
              due: { type: "string", description: "Data AAAA-MM-DD, resolvida a partir de hoje. Vazio se o corretor não disse quando." },
            },
            required: ["title"],
          },
        },
        deal: {
          type: "object",
          description: "Só se o corretor disse claramente o resultado: reunião aconteceu, faltou, proposta enviada, ganhou ou perdeu.",
          properties: {
            stage: { type: "string", enum: ["HELD", "NO_SHOW", "PROPOSAL", "WON", "LOST"] },
            valueReais: { type: "number", description: "Valor em reais, se dito." },
            reason: { type: "string", description: "Motivo, se dito (perdeu/faltou)." },
          },
          required: ["stage"],
        },
      },
      required: ["summary"],
    },
  },
};

const WEEKDAY = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];

export interface LeadForUpdate {
  id: string;
  firstName: string | null;
  lastName: string | null;
  jobTitle: string | null;
  status: string;
  notes: string | null;
  personal: string | null;
}

export async function extractLeadUpdate(transcript: string, lead: LeadForUpdate, now = new Date(), complete?: Completer): Promise<UpdateProposal> {
  const today = todaySP(now);
  const weekday = WEEKDAY[new Date(`${today}T12:00:00Z`).getUTCDay()];
  const name = [lead.firstName, lead.lastName].filter(Boolean).join(" ") || "a pessoa";
  const system =
    "Você ajuda um corretor a atualizar a ficha de um contato depois de ele falar um áudio. " +
    "Proponha SÓ o que o corretor disse; não invente nada, não complete números nem datas que ele não disse. " +
    `Hoje é ${weekday}, ${today}. Resolva datas relativas ("sexta", "semana que vem", "dia 15") para AAAA-MM-DD a partir de hoje, sempre no futuro; ` +
    "sem data dita, deixe a data vazia. " +
    "Não repita o que já está na ficha. Título de lembrete curto, no imperativo. Use a ferramenta propor_atualizacao.";
  const user =
    `Contato: ${name}${lead.jobTitle ? ` (${lead.jobTitle})` : ""}. Etapa atual: ${lead.status}.\n` +
    `Anotações atuais: ${lead.notes?.slice(-800) || "(nenhuma)"}\n` +
    `O que já se sabe da pessoa: ${lead.personal?.slice(-600) || "(nada)"}\n\n` +
    `O que o corretor disse (transcrição automática, pode ter erro em nomes e números):\n"${transcript.slice(0, 3000)}"`;
  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [{ role: "system", content: system }, { role: "user", content: user }];
  const response = complete
    ? await complete({ messages, tool: TOOL })
    : await runInLeadScope(lead.id, () => completeWithTool(nousClient(), { model: fastModel(), purpose: "atualizacao_voz", tool: TOOL, messages }));
  const call = response.choices[0]?.message?.tool_calls?.[0];
  if (!call || call.type !== "function") return { ...EMPTY_PROPOSAL, summary: "Não consegui entender o que mudar." };
  try {
    return sanitizeProposal(JSON.parse(call.function.arguments), today);
  } catch {
    return { ...EMPTY_PROPOSAL, summary: "Não consegui entender o que mudar." };
  }
}

// Texto que entra nas anotações: data e o que foi dito, sem apagar o que já existia.
export function appendNote(existing: string | null, addition: string, now = new Date()): string {
  const day = now.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });
  const line = `[${day}] ${addition.trim()}`;
  return existing?.trim() ? `${existing.trim()}\n${line}` : line;
}

export function appendPersonal(existing: string | null, addition: string): string {
  return existing?.trim() ? `${existing.trim()}\n${addition.trim()}` : addition.trim();
}

// Início do dia do lembrete em Brasília.
export const dueDate = (due: string) => new Date(`${due}T00:00:00-03:00`);

export const dealLabel = (stage: DealStage) => DEAL_LABEL[stage];
