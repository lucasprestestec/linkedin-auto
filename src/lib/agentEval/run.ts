import OpenAI from "openai";
import { completeWithTool, decideResponse, nousClient, type Completer, type Usage } from "@/lib/agent";
import { EVAL_BUSY, EVAL_INSTRUCTIONS, EVAL_NOW, EVAL_RULES, SCENARIOS, type Scenario } from "./scenarios";
import { calendarContextFrom } from "@/lib/scheduling";
import { slotIso } from "@/lib/slots";

export interface EvalResult {
  scenarioId: string;
  model: string;
  ok: boolean;
  error?: string;
  action?: "reply" | "handoff" | "book";
  message?: string;
  reason?: string;
  analysis?: string;
  qualified?: boolean;
  declined?: boolean;
  // Horarios oferecidos (reply) ou horario marcado (book), em ISO.
  slots?: string[];
  attempts?: number;
  checkIssues?: string[];
  // Acertou a decisão esperada (responder / passar pro corretor / recusa)?
  decisionOk?: boolean;
  decisionNote?: string;
  judge?: { naturalness: number; competence: number; invented: boolean; brokeRule: boolean; comment: string };
  usage?: Usage;
  ms?: number;
}

function decisionCheck(s: Scenario, action: "reply" | "handoff" | "book", declined: boolean, qualified: boolean, slots: string[]): { ok: boolean; note: string } {
  const notes: string[] = [];
  let ok = true;
  if (s.expect !== "either" && s.expect !== action) {
    ok = false;
    notes.push(s.expect === "handoff" ? "deveria passar pro corretor" : s.expect === "book" ? "deveria marcar a reuniao" : "deveria responder");
  }
  if (action === "reply" && s.declined !== undefined && s.declined !== declined) {
    ok = false;
    notes.push(s.declined ? "deveria encerrar (recusa)" : "marcou recusa sem ser recusa");
  }
  if (action === "reply" && s.proposes !== undefined && s.proposes !== slots.length > 0) {
    ok = false;
    notes.push(s.proposes ? "deveria oferecer horarios livres" : "ofereceu horarios cedo demais");
  }
  if (action === "book" && s.bookAt && new Date(slots[0]).getTime() !== new Date(s.bookAt).getTime()) {
    ok = false;
    notes.push(`marcou ${slots[0]}, esperado ${s.bookAt}`);
  }
  if (action === "reply" && s.qualified === true && !qualified) notes.push("não marcou como qualificado");
  return { ok, note: notes.join("; ") };
}

const JUDGE_TOOL: OpenAI.Chat.Completions.ChatCompletionTool = {
  type: "function",
  function: {
    name: "grade",
    description: "Avalia a decisão/mensagem do agente.",
    parameters: {
      type: "object",
      properties: {
        naturalness: { type: "integer", minimum: 1, maximum: 5, description: "Parece mensagem de uma pessoa real no LinkedIn, pt-BR fluente, tom certo, tamanho certo. 5 = indistinguível de um bom vendedor humano." },
        competence: { type: "integer", minimum: 1, maximum: 5, description: "Respondeu ao que o lead disse, decisão correta, avança a conversa, segue a rubrica. 5 = o que um ótimo corretor faria." },
        invented: { type: "boolean", description: "Afirmou algum fato/número/promessa que não está no material do corretor." },
        brokeRule: { type: "boolean", description: "Quebrou alguma regra (ex.: devia passar pro corretor e respondeu; mentiu ser humano; insistiu após recusa)." },
        comment: { type: "string", description: "Comentário em português, até 25 palavras, dizendo o principal acerto ou erro." },
      },
      required: ["naturalness", "competence", "invented", "brokeRule", "comment"],
    },
  },
};

async function judge(s: Scenario, out: { action: string; message?: string; reason?: string }, judgeModel: string, slot = "", complete?: Completer) {
  const client = complete ? null : nousClient();
  const transcript = s.history.map((m) => `${m.sender === "LEAD" ? "LEAD" : "CORRETOR"}: ${m.content}`).join("\n");
  const judgeParams: { model: string; messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[]; tool: OpenAI.Chat.Completions.ChatCompletionTool } = {
    model: judgeModel,
    messages: [
      {
        role: "system",
        content:
          "Você é um avaliador exigente de agentes de vendas consultivas no LinkedIn (corretor de seguros, Brasil). " +
          "Avalie com rigor e consistência; notas 5 só para o que um excelente profissional humano faria. " +
          "Em cenários em que o 'lead' é na verdade um robô/resposta automática, o agente acerta ao NÃO conversar com ele (passar pro corretor). " +
          "Passar a conversa pro corretor (handoff) é correto quando a rubrica pede; nesse caso avalie o motivo (claro e específico). Use a ferramenta grade.",
      },
      {
        role: "user",
        content: `MATERIAL DO CORRETOR:\n${EVAL_INSTRUCTIONS}\n\nCANAL: ${s.channel ?? "LINKEDIN"}\n\nLEAD: ${[s.lead.firstName, s.lead.lastName].join(" ")} — ${s.lead.jobTitle}\n\nCONVERSA:\n${transcript}\n\n` +
          `ESPERADO: ${s.expect === "either" ? "responder ou passar pro corretor (ambos aceitáveis)" : s.expect === "reply" ? "responder" : "passar pro corretor"}\n` +
          `RUBRICA: ${s.rubric}\n\nO QUE O AGENTE FEZ: ${
            out.action === "reply" ? `respondeu:\n"${out.message}"` : `passou pro corretor. Motivo: "${out.reason}"`
          }`,
      },
    ],
    tool: JUDGE_TOOL,
  };
  const response = complete ? await complete({ messages: judgeParams.messages, tool: judgeParams.tool }) : await completeWithTool(client!, judgeParams);
  const call = response.choices[0]?.message?.tool_calls?.[0];
  if (!call || call.type !== "function") throw new Error("avaliador não respondeu");
  const g = JSON.parse(call.function.arguments);
  const clamp = (n: unknown) => Math.max(1, Math.min(5, Math.round(Number(n) || 1)));
  return { naturalness: clamp(g.naturalness), competence: clamp(g.competence), invented: Boolean(g.invented), brokeRule: Boolean(g.brokeRule), comment: String(g.comment ?? "") };
}

export async function runScenario(scenarioId: string, model: string, judgeModel: string | null, io: { complete?: Completer; judgeComplete?: Completer } = {}): Promise<EvalResult> {
  const s = SCENARIOS.find((x) => x.id === scenarioId);
  if (!s) return { scenarioId, model, ok: false, error: "cenário não existe" };
  const started = Date.now();
  try {
    const d = await decideResponse(
      {
        instructions: EVAL_INSTRUCTIONS,
        lead: s.lead,
        history: s.history,
        channel: s.channel,
        ...(s.calendar ? { now: EVAL_NOW, calendar: calendarContextFrom(EVAL_BUSY, EVAL_NOW, EVAL_RULES) } : {}),
      },
      { model, complete: io.complete, skipAutoFilter: process.env.EVAL_NO_FILTER === "1" },
    );
    const ms = Date.now() - started;
    const declined = d.action === "reply" && d.declined;
    const qualified = d.action === "reply" && d.qualified;
    const slots = d.action === "reply" ? d.proposedSlots.map(slotIso) : d.action === "book" ? [slotIso(d.slotStart)] : [];
    const dc = decisionCheck(s, d.action, declined, qualified, slots);
    const out = d.action === "handoff" ? { action: d.action, reason: d.reason } : { action: d.action, message: d.message };
    let judgeResult: EvalResult["judge"];
    let judgeError: string | undefined;
    if (judgeModel) {
      try {
        judgeResult = await judge(s, out, judgeModel, slots[0] ?? "", io.judgeComplete);
      } catch (err) {
        judgeError = `avaliador: ${err instanceof Error ? err.message : "falhou"}`;
      }
    }
    return {
      scenarioId,
      model,
      ok: true,
      error: judgeError,
      ...out,
      analysis: d.analysis,
      qualified,
      declined,
      slots,
      attempts: d.attempts,
      checkIssues: d.checkIssues,
      decisionOk: dc.ok,
      decisionNote: dc.note,
      judge: judgeResult,
      usage: d.usage,
      ms,
    };
  } catch (err) {
    return { scenarioId, model, ok: false, error: err instanceof Error ? err.message : "falhou", ms: Date.now() - started };
  }
}

// Lista de modelos do Nous (endpoint /models, compatível com OpenAI). Se vier
// preço por token (formato OpenRouter), usamos pra estimar custo.
export interface ModelInfo {
  id: string;
  inputPerM: number | null;
  outputPerM: number | null;
}

export async function listNousModels(): Promise<ModelInfo[]> {
  const client = nousClient();
  const page = await client.models.list();
  const out: ModelInfo[] = [];
  for await (const m of page) {
    const p = (m as unknown as { pricing?: { prompt?: string | number; completion?: string | number } }).pricing;
    const toM = (v: string | number | undefined) => (v === undefined || v === null || v === "" || Number.isNaN(Number(v)) ? null : Number(v) * 1_000_000);
    out.push({ id: m.id, inputPerM: toM(p?.prompt), outputPerM: toM(p?.completion) });
  }
  return out.sort((a, b) => a.id.localeCompare(b.id));
}
