import OpenAI from "openai";
import type { Message as DbMessage } from "@prisma/client";

const DEFAULT_INSTRUCTIONS = `Você é um assistente comercial respondendo por um corretor de seguros no LinkedIn.
Nenhum material de vendas real foi configurado ainda — responda de forma genérica, cordial,
e SEMPRE prefira pedir handoff a inventar informação sobre produtos, preços ou condições.`;

export type AgentDecision =
  | { action: "reply"; message: string; qualified: boolean }
  | { action: "handoff"; reason: string };

const RESPOND_TOOL: OpenAI.Chat.Completions.ChatCompletionTool = {
  type: "function",
  function: {
    name: "respond_to_lead",
    description: "Decide como agir na conversa com o lead: responder diretamente ou pedir para um humano assumir.",
    parameters: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["reply", "handoff"] },
        message: {
          type: "string",
          description: "Mensagem a enviar ao lead. Obrigatório quando action = reply. Tom natural de LinkedIn, direto, sem parecer robótico.",
        },
        qualified: {
          type: "boolean",
          description: "true se o lead parece pronto para fechar / muito interessado. Só use com action = reply.",
        },
        handoff_reason: {
          type: "string",
          description: "Motivo curto e específico do handoff (ex: 'Pediu valor exato do plano'). Obrigatório quando action = handoff.",
        },
      },
      required: ["action"],
    },
  },
};

function systemPrompt(instructions: string | null): string {
  return `${instructions?.trim() || DEFAULT_INSTRUCTIONS}

Regras fixas, sempre válidas, independente do material acima:
- Responda em português do Brasil, tom natural de mensagem de LinkedIn (curto, direto, sem parecer robô ou script de vendas).
- NUNCA invente preço, condição, cobertura ou fato sobre produto que não esteja no material acima. Se não souber, peça handoff.
- Peça handoff (não responda sozinho) quando o lead: pedir valor/proposta específica; pedir para falar com uma pessoa; demonstrar insatisfação ou tom hostil; fizer pergunta fora do que você sabe responder com segurança.
- Marque qualified=true quando o lead demonstrar interesse forte e estiver pronto para avançar (ex: pediu para agendar, disse que quer contratar) — mesmo assim ainda responda normalmente, apenas sinalize.
- Use a ferramenta respond_to_lead para toda resposta. Nunca responda em texto livre fora da ferramenta.`;
}

function getClient() {
  const apiKey = process.env.NOUS_API_KEY;
  if (!apiKey) throw new Error("NOUS_API_KEY não configurado.");
  return new OpenAI({
    apiKey,
    baseURL: process.env.NOUS_BASE_URL || "https://inference-api.nousresearch.com/v1",
  });
}

export async function decideResponse(
  history: Pick<DbMessage, "sender" | "content">[],
  instructions: string | null,
): Promise<AgentDecision> {
  const client = getClient();
  const model = process.env.NOUS_MODEL || "deepseek/deepseek-v4-flash";

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt(instructions) },
    ...history.map((m): OpenAI.Chat.Completions.ChatCompletionMessageParam => ({
      role: m.sender === "LEAD" ? "user" : "assistant",
      content: m.content,
    })),
  ];

  const response = await client.chat.completions.create({
    model,
    messages,
    tools: [RESPOND_TOOL],
    tool_choice: { type: "function", function: { name: "respond_to_lead" } },
  });

  const toolCall = response.choices[0]?.message?.tool_calls?.[0];
  if (!toolCall || toolCall.type !== "function") {
    throw new Error("O agente não retornou uma decisão válida.");
  }

  const input = JSON.parse(toolCall.function.arguments) as {
    action: "reply" | "handoff";
    message?: string;
    qualified?: boolean;
    handoff_reason?: string;
  };

  if (input.action === "reply" && input.message) {
    return { action: "reply", message: input.message, qualified: Boolean(input.qualified) };
  }
  return { action: "handoff", reason: input.handoff_reason ?? "O agente não soube responder." };
}

// ---------------------------------------------------------------------------
// Mensagens proativas: o agente fala primeiro (abertura) ou retoma uma conversa
// parada (follow-up). Não há mensagem do lead pra reagir — é iniciativa nossa,
// então o formato é outro: uma única mensagem, sem opção de handoff.
// ---------------------------------------------------------------------------

export interface LeadContext {
  firstName: string | null;
  lastName: string | null;
  jobTitle: string | null;
}

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

function proactiveSystemPrompt(instructions: string | null, task: string): string {
  return `${instructions?.trim() || DEFAULT_INSTRUCTIONS}

Regras fixas, sempre válidas, independente do material acima:
- Português do Brasil, tom natural de mensagem de LinkedIn: curta (2 a 4 frases), direta, humana — nada de script de vendas, emojis em excesso ou elogios genéricos ("vi seu perfil e fiquei impressionado").
- NUNCA invente preço, condição, cobertura ou fato sobre produto que não esteja no material acima. Na dúvida, não cite produto específico: fale do problema/interesse, não da oferta.
- Não inclua links, não peça dados pessoais e não prometa nada em nome do corretor.
- Termine com uma pergunta aberta e fácil de responder.
- Use a ferramenta write_message. Nunca responda em texto livre fora da ferramenta.

Tarefa: ${task}`;
}

function leadDescription(lead: LeadContext): string {
  const name = [lead.firstName, lead.lastName].filter(Boolean).join(" ") || "(nome não disponível)";
  return `Lead: ${name}${lead.jobTitle ? ` — ${lead.jobTitle}` : ""}`;
}

async function writeMessage(system: string, user: string): Promise<string> {
  const client = getClient();
  const model = process.env.NOUS_MODEL || "deepseek/deepseek-v4-flash";
  const response = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    tools: [WRITE_TOOL],
    tool_choice: { type: "function", function: { name: "write_message" } },
  });

  const toolCall = response.choices[0]?.message?.tool_calls?.[0];
  if (!toolCall || toolCall.type !== "function") throw new Error("O agente não retornou uma mensagem.");
  const { message } = JSON.parse(toolCall.function.arguments) as { message?: string };
  if (!message?.trim()) throw new Error("O agente retornou uma mensagem vazia.");
  return message.trim();
}

// Primeira mensagem depois que o convite é aceito. Sem histórico: o único
// contexto é quem é o lead (nome e cargo).
export async function generateOpeningMessage(instructions: string | null, lead: LeadContext): Promise<string> {
  return writeMessage(
    proactiveSystemPrompt(
      instructions,
      "O lead acabou de aceitar o convite de conexão. Escreva a PRIMEIRA mensagem da conversa: agradeça a conexão de forma breve, " +
        "faça uma ponte com o cargo/área dele quando houver, e abra espaço pra conversa. Use só o primeiro nome.",
    ),
    leadDescription(lead),
  );
}

// Follow-up número `attempt` (1..maxCount) numa conversa sem resposta. Cada
// tentativa tem um ângulo diferente, e as anteriores vão no histórico pra ele
// não repetir frase.
export async function generateFollowUp(
  instructions: string | null,
  lead: LeadContext,
  history: Pick<DbMessage, "sender" | "content">[],
  attempt: number,
  maxCount: number,
): Promise<string> {
  const isLast = attempt >= maxCount;
  const angle = isLast
    ? "É a ÚLTIMA tentativa: seja leve, diga que não vai mais insistir e deixe a porta aberta pra quando fizer sentido."
    : attempt === 1
      ? "Retome a conversa com leveza, sem cobrar resposta; traga um motivo concreto (e verdadeiro) pra conversarem."
      : "Traga um ângulo NOVO em relação às mensagens anteriores (outra dor, outro benefício, outra pergunta).";

  const transcript = history
    .map((m) => `${m.sender === "LEAD" ? "Lead" : m.sender === "AGENT" ? "Nós (agente)" : "Nós (corretor)"}: ${m.content}`)
    .join("\n");

  return writeMessage(
    proactiveSystemPrompt(
      instructions,
      `O lead não respondeu à última mensagem. Escreva o follow-up ${attempt} de ${maxCount}. ${angle} ` +
        "NÃO repita frases, aberturas ou perguntas que já aparecem no histórico. Não mencione que é um follow-up nem conte tentativas.",
    ),
    `${leadDescription(lead)}\n\nHistórico da conversa (mais antiga primeiro):\n${transcript || "(vazio)"}`,
  );
}

// ---------------------------------------------------------------------------
// Qualificação por perfil de cliente ideal (ICP): nota 0-100 por pessoa, só com
// o que já temos (nome, cargo/headline). Uma chamada pra lista toda.
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
  const client = getClient();
  const model = process.env.NOUS_MODEL || "deepseek/deepseek-v4-flash";
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
