import OpenAI from "openai";
import type { LeadStatus, Message as DbMessage } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { checkMessage } from "@/lib/agentCheck";

const DEFAULT_INSTRUCTIONS = `Você responde pelo corretor de seguros dono desta conta do LinkedIn.
Nenhum material de vendas foi configurado ainda — fale de forma genérica e cordial, e SEMPRE prefira
passar a conversa pro corretor a inventar qualquer informação sobre produtos, preços ou condições.`;

export const DEFAULT_MODEL = "deepseek/deepseek-v4-flash";

// ---------------------------------------------------------------------------
// Modelos: o das conversas pode ser trocado no admin (depois do banco de
// testes); tarefas simples (nota de perfil, resumo) usam um modelo rápido.
// ---------------------------------------------------------------------------

export async function conversationModel(): Promise<string> {
  const settings = await prisma.settings.findUnique({ where: { id: "singleton" }, select: { agentModel: true } });
  return settings?.agentModel?.trim() || process.env.NOUS_MODEL || DEFAULT_MODEL;
}

function fastModel(): string {
  return process.env.NOUS_MODEL_FAST || process.env.NOUS_MODEL || DEFAULT_MODEL;
}

export function nousClient() {
  const apiKey = process.env.NOUS_API_KEY;
  if (!apiKey) throw new Error("NOUS_API_KEY não configurado.");
  return new OpenAI({
    apiKey,
    baseURL: process.env.NOUS_BASE_URL || "https://inference-api.nousresearch.com/v1",
  });
}

export interface Usage {
  inputTokens: number;
  outputTokens: number;
  // Alguns provedores devolvem o custo da chamada (em US$).
  cost: number | null;
}

function usageOf(response: OpenAI.Chat.Completions.ChatCompletion): Usage {
  const u = response.usage as (OpenAI.Completions.CompletionUsage & { cost?: number }) | undefined;
  return { inputTokens: u?.prompt_tokens ?? 0, outputTokens: u?.completion_tokens ?? 0, cost: typeof u?.cost === "number" ? u.cost : null };
}

function addUsage(a: Usage, b: Usage): Usage {
  return { inputTokens: a.inputTokens + b.inputTokens, outputTokens: a.outputTokens + b.outputTokens, cost: a.cost === null && b.cost === null ? null : (a.cost ?? 0) + (b.cost ?? 0) };
}

// ---------------------------------------------------------------------------
// Contexto e estilo — iguais pra toda mensagem que o agente escreve
// ---------------------------------------------------------------------------

export interface LeadContext {
  firstName: string | null;
  lastName: string | null;
  jobTitle: string | null;
  // Opcionais: quanto mais contexto, melhor a conversa.
  status?: LeadStatus;
  icpScore?: number | null;
  notes?: string | null;
  tags?: string[];
  followUpsSent?: number;
  campaignName?: string | null;
}

type HistoryItem = Pick<DbMessage, "sender" | "content"> & { deliveredAt?: Date };

const TIME_ZONE = "America/Sao_Paulo";

function nowLabel(now = new Date()) {
  return now.toLocaleString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: TIME_ZONE });
}

const STAGE: Record<LeadStatus, string> = {
  INVITE_SENT: "convite enviado, ainda sem conexão",
  WAITING_REPLY: "conectados; mandamos mensagem e ainda não houve resposta",
  CONVERSATION_OPEN: "conversa em andamento (o lead já respondeu antes)",
  NEEDS_HUMAN: "o corretor tinha assumido esta conversa",
  QUALIFIED: "lead já demonstrou interesse forte",
  LOST: "conversa tinha sido encerrada sem avanço",
};

function leadBlock(lead: LeadContext): string {
  const name = [lead.firstName, lead.lastName].filter(Boolean).join(" ") || "(nome não disponível)";
  const lines = [`Nome: ${name}`, `Cargo/headline: ${lead.jobTitle || "(não informado)"}`];
  if (lead.campaignName) lines.push(`Campanha: ${lead.campaignName}`);
  if (lead.status) lines.push(`Etapa: ${STAGE[lead.status]}`);
  if (lead.followUpsSent) lines.push(`Follow-ups já enviados sem resposta: ${lead.followUpsSent}`);
  if (lead.icpScore != null) lines.push(`Encaixe com o cliente ideal: ${lead.icpScore}/100`);
  if (lead.tags?.length) lines.push(`Etiquetas do corretor: ${lead.tags.join(", ")}`);
  if (lead.notes?.trim()) lines.push(`Anotações do corretor (use como contexto, não cite): ${lead.notes.trim().slice(0, 600)}`);
  return lines.join("\n");
}

function transcriptOf(history: HistoryItem[]): string {
  return history
    .map((m) => {
      const who = m.sender === "LEAD" ? "LEAD" : m.sender === "AGENT" ? "VOCÊ (automático)" : "VOCÊ (corretor digitou)";
      const when = m.deliveredAt ? ` [${m.deliveredAt.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: TIME_ZONE })}]` : "";
      return `${who}${when}: ${m.content}`;
    })
    .join("\n");
}

const STYLE = `COMO ESCREVER
- Você escreve em primeira pessoa, como o corretor, numa conversa de LinkedIn entre profissionais.
- Português do Brasil natural, de gente: frases curtas, 1 a 3 frases (no máximo uns 350 caracteres). Nada de texto de folheto.
- Responda primeiro o que o lead disse ou perguntou; só depois conduza. No máximo UMA pergunta por mensagem.
- Espelhe o tom do lead: se ele é breve, seja breve; se é formal, seja um pouco mais formal. Emoji só se ele usou (no máximo 1).
- Não repita o nome do lead em toda mensagem, não repita frases que já mandou, não comece com "Ótima pergunta", "Perfeito!" ou elogios vazios.
- Sem listas, negrito, links ou assinatura. Sem "[Nome]" ou campos a preencher.
- O objetivo é entender a situação do lead e, no ritmo dele, chegar a um próximo passo concreto com o corretor (uma conversa rápida). Não empurre.

EXEMPLOS DE TOM (situações genéricas — o conteúdo real vem do material do corretor)
LEAD: "Oi, obrigado pela conexão! Do que se trata?"
BOM: "Imagina! Trabalho com planos de saúde e seguro de vida para empresas. Hoje vocês já oferecem algum benefício desses pro time?"
RUIM: "Olá, João! Tudo bem? Que bom ter você na minha rede! 😊 Sou especialista em soluções completas de benefícios corporativos e gostaria de apresentar..."

LEAD: "Já temos plano, estamos bem servidos."
BOM: "Que bom! Quando é a renovação de vocês? Às vezes vale comparar só pra ter uma referência, sem compromisso."

LEAD: "Agora tô sem tempo, fala comigo mês que vem."
BOM: "Tranquilo, sem pressa. Te procuro no mês que vem então. Bom trabalho!"

LEAD: "Não tenho interesse, obrigado."
BOM: "Entendido, obrigado pelo retorno! Se um dia precisar, fico à disposição."`;

const RULES = `REGRAS FIXAS (valem acima de qualquer material)
- NUNCA invente preço, desconto, economia, carência, cobertura, rede, operadora ou qualquer fato que não esteja no material do corretor. Não prometa nada em nome dele.
- Não peça dados sensíveis (CPF, renda, saúde, documentos) e não mande links.
- Nunca diga que é IA, robô ou assistente — e nunca afirme ser humano se perguntarem: nesse caso, passe pro corretor.

PASSE A CONVERSA PRO CORRETOR (action = handoff) quando o lead:
- pedir preço, valor, cotação, proposta, simulação ou condição específica;
- quiser falar por telefone, WhatsApp ou e-mail, ou mandar um contato/número/e-mail;
- propuser ou aceitar um dia/horário concreto para conversar;
- perguntar se está falando com robô/IA/mensagem automática;
- estiver irritado, reclamar, ameaçar denunciar ou fizer crítica séria;
- indicar outra pessoa para tratar do assunto (registre quem no motivo);
- trouxer assunto sensível (sinistro, doença, caso jurídico), pergunta técnica que o material não responde, ou escrever em outro idioma;
- fizer algo que você não consiga responder com segurança.
O motivo do handoff deve ser curto e específico, para o corretor entender em 3 segundos (ex.: "Pediu cotação para 20 vidas").

ENCERRAR SEM INSISTIR (declined = true): o lead disse claramente que não tem interesse, pediu para não receber mais mensagens, ou não é o público e não há o que fazer. Responda curto e cordial, sem nova pergunta. "Já tenho plano" ou "agora não" NÃO é recusa: trate como objeção, com leveza.

QUALIFICADO (qualified = true): o lead quer avançar (quer conversar, entender condições, contratar).`;

function contextBlock(instructions: string | null, lead: LeadContext, now: Date) {
  return `MATERIAL DO CORRETOR (o que você pode afirmar sobre ofertas e sobre ele)
${instructions?.trim() || DEFAULT_INSTRUCTIONS}

AGORA: ${nowLabel(now)} (horário de Brasília)

QUEM É O LEAD
${leadBlock(lead)}`;
}

// ---------------------------------------------------------------------------
// Resposta a uma mensagem do lead
// ---------------------------------------------------------------------------

export type AgentDecision = (
  | { action: "reply"; message: string; qualified: boolean; declined: boolean }
  | { action: "handoff"; reason: string }
) & { analysis: string; model: string; usage: Usage; attempts: number; checkIssues: string[] };

const RESPOND_TOOL: OpenAI.Chat.Completions.ChatCompletionTool = {
  type: "function",
  function: {
    name: "respond_to_lead",
    description: "Registra sua análise da conversa e decide: responder ao lead ou passar a conversa pro corretor.",
    parameters: {
      type: "object",
      properties: {
        analysis: {
          type: "string",
          description:
            "Análise interna, NÃO é enviada: o que o lead disse/quer, em que ponto a conversa está, o que já foi dito (pra não repetir), " +
            "se alguma regra de handoff/encerramento se aplica e qual o melhor próximo passo. 2 a 5 frases.",
        },
        action: { type: "string", enum: ["reply", "handoff"] },
        message: { type: "string", description: "Mensagem a enviar (obrigatória se action = reply). Segue o COMO ESCREVER." },
        qualified: { type: "boolean", description: "true se o lead quer avançar. Só com action = reply." },
        declined: { type: "boolean", description: "true se o lead recusou claramente — encerra os follow-ups. Só com action = reply." },
        handoff_reason: { type: "string", description: "Motivo curto e específico (obrigatório se action = handoff)." },
      },
      required: ["analysis", "action"],
    },
  },
};

export interface ConversationInput {
  instructions: string | null;
  lead: LeadContext;
  history: HistoryItem[];
  now?: Date;
}

export async function decideResponse(input: ConversationInput, opts: { model?: string } = {}): Promise<AgentDecision> {
  const client = nousClient();
  const model = opts.model || (await conversationModel());
  const now = input.now ?? new Date();

  const system = `Você conduz, pelo corretor, as conversas do LinkedIn com possíveis clientes.

${contextBlock(input.instructions, input.lead, now)}

${STYLE}

${RULES}

Use SEMPRE a ferramenta respond_to_lead: primeiro a análise, depois a decisão. Nunca responda em texto livre.`;

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: system },
    {
      role: "user",
      content: `Conversa até agora (mais antiga primeiro):\n${transcriptOf(input.history) || "(vazia)"}\n\nDecida o que fazer com a última mensagem do LEAD.`,
    },
  ];
  const previousOutgoing = input.history.filter((m) => m.sender !== "LEAD").map((m) => m.content);

  let usage: Usage = { inputTokens: 0, outputTokens: 0, cost: null };
  let lastIssues: string[] = [];
  let lastAnalysis = "";

  // Até 2 tentativas: se a mensagem não passar na conferência, pede pra reescrever.
  for (let attempt = 1; attempt <= 2; attempt++) {
    const response = await client.chat.completions.create({
      model,
      messages,
      tools: [RESPOND_TOOL],
      tool_choice: { type: "function", function: { name: "respond_to_lead" } },
    });
    usage = addUsage(usage, usageOf(response));

    const toolCall = response.choices[0]?.message?.tool_calls?.[0];
    if (!toolCall || toolCall.type !== "function") throw new Error("O agente não retornou uma decisão válida.");
    const out = JSON.parse(toolCall.function.arguments) as {
      analysis?: string;
      action?: "reply" | "handoff";
      message?: string;
      qualified?: boolean;
      declined?: boolean;
      handoff_reason?: string;
    };
    lastAnalysis = out.analysis?.trim() ?? "";
    const base = { analysis: lastAnalysis, model, usage, attempts: attempt };

    if (out.action !== "reply" || !out.message?.trim()) {
      return { action: "handoff", reason: out.handoff_reason?.trim() || "O agente não soube responder.", ...base, checkIssues: lastIssues };
    }

    const message = out.message.trim();
    lastIssues = checkMessage({ message, previousOutgoing, instructions: input.instructions });
    if (lastIssues.length === 0) {
      return { action: "reply", message, qualified: Boolean(out.qualified), declined: Boolean(out.declined), ...base, checkIssues: [] };
    }

    messages.push(
      { role: "assistant", content: null, tool_calls: [toolCall] },
      {
        role: "tool",
        tool_call_id: toolCall.id,
        content: `A mensagem foi REJEITADA pela conferência automática: ${lastIssues.join("; ")}. Reescreva corrigindo isso (ou passe pro corretor se não der).`,
      },
    );
  }

  return {
    action: "handoff",
    reason: `A resposta da IA não passou na conferência (${lastIssues.join("; ")})`,
    analysis: lastAnalysis,
    model,
    usage,
    attempts: 2,
    checkIssues: lastIssues,
  };
}

// ---------------------------------------------------------------------------
// Mensagens proativas: abertura e follow-up. Uma mensagem só, sem handoff.
// ---------------------------------------------------------------------------

const WRITE_TOOL: OpenAI.Chat.Completions.ChatCompletionTool = {
  type: "function",
  function: {
    name: "write_message",
    description: "Escreve a mensagem que será enviada ao lead no LinkedIn.",
    parameters: {
      type: "object",
      properties: {
        message: { type: "string", description: "Texto final da mensagem, pronto para enviar." },
      },
      required: ["message"],
    },
  },
};

function proactiveSystemPrompt(instructions: string | null, lead: LeadContext, task: string): string {
  return `Você escreve, pelo corretor, mensagens do LinkedIn para possíveis clientes.

${contextBlock(instructions, lead, new Date())}

${STYLE}

${RULES}

Nesta tarefa não existe handoff: escreva uma única mensagem, terminando com uma pergunta aberta e fácil de responder.
Use a ferramenta write_message. Nunca responda em texto livre.

TAREFA: ${task}`;
}

async function writeMessage(system: string, user: string, opts: { model?: string; check?: { previousOutgoing: string[]; instructions: string | null } } = {}) {
  const client = nousClient();
  const model = opts.model || (await conversationModel());
  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: system },
    { role: "user", content: user },
  ];

  let issues: string[] = [];
  for (let attempt = 1; attempt <= 2; attempt++) {
    const response = await client.chat.completions.create({
      model,
      messages,
      tools: [WRITE_TOOL],
      tool_choice: { type: "function", function: { name: "write_message" } },
    });
    const toolCall = response.choices[0]?.message?.tool_calls?.[0];
    if (!toolCall || toolCall.type !== "function") throw new Error("O agente não retornou uma mensagem.");
    const message = (JSON.parse(toolCall.function.arguments) as { message?: string }).message?.trim();
    if (!message) throw new Error("O agente retornou uma mensagem vazia.");
    if (!opts.check) return message;

    issues = checkMessage({ message, ...opts.check });
    if (issues.length === 0) return message;
    messages.push(
      { role: "assistant", content: null, tool_calls: [toolCall] },
      { role: "tool", tool_call_id: toolCall.id, content: `REJEITADA pela conferência: ${issues.join("; ")}. Reescreva corrigindo.` },
    );
  }
  throw new Error(`a mensagem não passou na conferência (${issues.join("; ")})`);
}

// Primeira mensagem depois que o convite é aceito.
export async function generateOpeningMessage(instructions: string | null, lead: LeadContext, opts: { model?: string } = {}): Promise<string> {
  return writeMessage(
    proactiveSystemPrompt(
      instructions,
      lead,
      "O lead acabou de aceitar o convite de conexão. Escreva a PRIMEIRA mensagem: agradeça a conexão em poucas palavras, faça uma ponte " +
        "com o cargo/área dele quando houver e abra espaço pra conversa. Use só o primeiro nome. Nada de pitch longo.",
    ),
    "Escreva a mensagem de abertura.",
    { model: opts.model, check: { previousOutgoing: [], instructions } },
  );
}

// Follow-up número `attempt` (1..maxCount) numa conversa sem resposta.
export async function generateFollowUp(
  instructions: string | null,
  lead: LeadContext,
  history: HistoryItem[],
  attempt: number,
  maxCount: number,
): Promise<string> {
  const isLast = attempt >= maxCount;
  const angle = isLast
    ? "É a ÚLTIMA tentativa: seja leve, diga que não vai mais insistir e deixe a porta aberta."
    : attempt === 1
      ? "Retome com leveza, sem cobrar resposta; traga um motivo concreto (e verdadeiro) pra conversarem."
      : "Traga um ângulo NOVO em relação às mensagens anteriores (outra dor, outro benefício, outra pergunta).";

  return writeMessage(
    proactiveSystemPrompt(
      instructions,
      { ...lead, followUpsSent: attempt - 1 },
      `O lead não respondeu à última mensagem. Escreva o follow-up ${attempt} de ${maxCount}. ${angle} ` +
        "Não repita frases, aberturas ou perguntas do histórico. Não mencione que é um follow-up nem conte tentativas.",
    ),
    `Conversa até agora (mais antiga primeiro):\n${transcriptOf(history) || "(vazia)"}`,
    { check: { previousOutgoing: history.filter((m) => m.sender !== "LEAD").map((m) => m.content), instructions } },
  );
}

// ---------------------------------------------------------------------------
// Qualificação por perfil de cliente ideal (ICP): nota 0-100 por pessoa.
// ---------------------------------------------------------------------------

export interface ProfileToScore {
  id: string;
  name: string;
  headline: string | null;
}

export interface ProfileScore {
  id: string;
  score: number;
  reason: string;
}

const SCORE_TOOL: OpenAI.Chat.Completions.ChatCompletionTool = {
  type: "function",
  function: {
    name: "score_profiles",
    description: "Dá uma nota de 0 a 100 para cada perfil conforme o encaixe com o cliente ideal.",
    parameters: {
      type: "object",
      properties: {
        scores: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              score: { type: "integer", minimum: 0, maximum: 100 },
              reason: { type: "string", description: "Motivo curto (até 10 palavras), em português." },
            },
            required: ["id", "score", "reason"],
          },
        },
      },
      required: ["scores"],
    },
  },
};

const SCORE_BATCH = 30;

export async function scoreProfiles(idealCustomer: string, profiles: ProfileToScore[]): Promise<ProfileScore[]> {
  const client = nousClient();
  const model = fastModel();
  const results: ProfileScore[] = [];

  for (let i = 0; i < profiles.length; i += SCORE_BATCH) {
    const batch = profiles.slice(i, i + SCORE_BATCH);
    const response = await client.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content:
            "Você avalia perfis do LinkedIn para um corretor de seguros. Compare cada perfil com a descrição do cliente ideal e dê uma nota de 0 a 100 " +
            "(80+ encaixe forte, 50-79 possível, abaixo de 50 fraco). Use só o nome e o cargo/headline informados; se faltar informação, seja conservador (até 40). " +
            "Não invente fatos. Use a ferramenta score_profiles com todos os ids recebidos.",
        },
        {
          role: "user",
          content:
            `Cliente ideal:\n${idealCustomer.trim()}\n\nPerfis:\n` +
            batch.map((p) => `- id=${p.id} | ${p.name || "(sem nome)"} | ${p.headline || "(sem cargo)"}`).join("\n"),
        },
      ],
      tools: [SCORE_TOOL],
      tool_choice: { type: "function", function: { name: "score_profiles" } },
    });
    const toolCall = response.choices[0]?.message?.tool_calls?.[0];
    if (!toolCall || toolCall.type !== "function") throw new Error("O agente não retornou as notas.");
    const { scores } = JSON.parse(toolCall.function.arguments) as { scores?: ProfileScore[] };
    const ids = new Set(batch.map((p) => p.id));
    for (const s of scores ?? []) {
      if (ids.has(s.id)) results.push({ id: s.id, score: Math.max(0, Math.min(100, Math.round(s.score))), reason: s.reason ?? "" });
    }
  }
  return results;
}

// ---------------------------------------------------------------------------
// Ajudas sob demanda na tela da conversa (só quando o corretor clica).
// ---------------------------------------------------------------------------

export async function summarizeConversation(lead: LeadContext, history: HistoryItem[]): Promise<string> {
  return writeMessage(
    `Você ajuda um corretor de seguros a retomar conversas do LinkedIn. Resuma a conversa abaixo em português do Brasil,
em até 5 tópicos curtos começando com "• ": quem é o lead, o que ele quer ou perguntou, objeções ou dúvidas,
em que pé a conversa está e o próximo passo sugerido. Não invente nada que não esteja no histórico.
Use a ferramenta write_message (o campo message recebe o resumo).`,
    `${leadBlock(lead)}\n\nConversa (mais antiga primeiro):\n${transcriptOf(history) || "(sem mensagens)"}`,
    { model: fastModel() },
  );
}

export async function suggestReply(instructions: string | null, lead: LeadContext, history: HistoryItem[]): Promise<string> {
  return writeMessage(
    proactiveSystemPrompt(
      instructions,
      lead,
      "Escreva a PRÓXIMA mensagem do corretor nesta conversa, respondendo ao que o lead disse por último. " +
        "O corretor vai revisar antes de enviar, então aqui você pode sugerir mesmo quando seria caso de handoff. Não repita frases do histórico.",
    ),
    `Conversa até agora (mais antiga primeiro):\n${transcriptOf(history) || "(sem mensagens)"}`,
  );
}
