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
  const model = process.env.NOUS_MODEL || "Hermes-4-70B";

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
