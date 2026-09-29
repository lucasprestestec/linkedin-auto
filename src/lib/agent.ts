import OpenAI from "openai";
import type { LeadStatus, MessageChannel, Message as DbMessage } from "@prisma/client";
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

// Chamada com uma ferramenta só, forçando o uso dela. O formato mais preciso é
// dizer QUAL ferramenta (nome); alguns provedores só aceitam "required" ou
// "auto" (ex.: GLM, Muse Spark). Se o provedor recusar com 400, tenta o
// próximo formato e lembra qual funcionou para aquele modelo.
type ToolChoice = OpenAI.Chat.Completions.ChatCompletionToolChoiceOption;
const toolChoiceMode = new Map<string, "named" | "required" | "auto">();

export async function completeWithTool(
  client: OpenAI,
  params: { model: string; messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[]; tool: OpenAI.Chat.Completions.ChatCompletionTool },
): Promise<OpenAI.Chat.Completions.ChatCompletion> {
  const name = params.tool.type === "function" ? params.tool.function.name : "";
  const modes: ("named" | "required" | "auto")[] = ["named", "required", "auto"];
  const start = modes.indexOf(toolChoiceMode.get(params.model) ?? "named");
  let lastError: unknown;
  for (const mode of modes.slice(start)) {
    const tool_choice: ToolChoice = mode === "named" ? { type: "function", function: { name } } : mode;
    try {
      const response = await client.chat.completions.create({ model: params.model, messages: params.messages, tools: [params.tool], tool_choice });
      toolChoiceMode.set(params.model, mode);
      return response;
    } catch (err) {
      lastError = err;
      if (!(err instanceof OpenAI.APIError) || err.status !== 400) throw err;
    }
  }
  throw lastError;
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
  // Ficha pessoal escrita pelo corretor (as "anotações" dele são privadas e
  // NÃO entram aqui).
  personal?: string | null;
  tags?: string[];
  followUpsSent?: number;
  campaignName?: string | null;
  // Canais que já temos dele (só se sabe se está preenchido; o número em si não entra no prompt).
  phone?: string | null;
  email?: string | null;
}

type HistoryItem = Pick<DbMessage, "sender" | "content"> & {
  deliveredAt?: Date;
  channel?: MessageChannel;
  // E-mails enviados com rastreio: quantas vezes a imagem de abertura carregou.
  openToken?: string | null;
  openCount?: number;
};

const CHANNEL_NAME: Record<MessageChannel, string> = { LINKEDIN: "LinkedIn", EMAIL: "e-mail", WHATSAPP: "WhatsApp" };

// Como escrever em cada canal (o resto do estilo vale pra todos).
const CHANNEL_STYLE: Record<MessageChannel, string> = {
  LINKEDIN: "Mensagem de LinkedIn: curta e direta, sem saudação formal nem assinatura.",
  EMAIL:
    "E-MAIL: comece com uma saudação curta pelo primeiro nome (ex.: \"Oi, Mariana,\"), 2 a 4 frases, e termine com uma despedida simples " +
    "e o primeiro nome do corretor. Sem assunto no corpo, sem formatação, sem link.",
  WHATSAPP: "WhatsApp: bem curto e informal, como mensagem entre pessoas. Sem assinatura.",
};

const TIME_ZONE = "America/Sao_Paulo";

function nowLabel(now = new Date()) {
  return now.toLocaleString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: TIME_ZONE });
}

const STAGE: Record<LeadStatus, string> = {
  NEW: "contato adicionado pelo corretor (vocês se conhecem por fora do LinkedIn); ainda não houve mensagem",
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
  if (lead.phone !== undefined || lead.email !== undefined) {
    lines.push(`Contatos na ficha: WhatsApp ${lead.phone ? "sim" : "não"}; e-mail ${lead.email ? "sim" : "não"}`);
  }
  if (lead.tags?.length) lines.push(`Etiquetas do corretor: ${lead.tags.join(", ")}`);
  if (lead.personal?.trim()) lines.push(`Ficha pessoal (o que o corretor sabe dessa pessoa): ${lead.personal.trim().slice(0, 1200)}`);
  return lines.join("\n");
}

function transcriptOf(history: HistoryItem[]): string {
  return history
    .map((m) => {
      const who = m.sender === "LEAD" ? "LEAD" : m.sender === "AGENT" ? "VOCÊ (automático)" : "VOCÊ (corretor digitou)";
      const date = m.deliveredAt ? m.deliveredAt.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: TIME_ZONE }) : "";
      const opened = m.sender !== "LEAD" && m.openToken ? (m.openCount ? `aberto ${m.openCount}x` : "ainda não aberto") : "";
      const tag = [date, m.channel && m.channel !== "LINKEDIN" ? CHANNEL_NAME[m.channel] : "", opened].filter(Boolean).join(", ");
      return `${who}${tag ? ` [${tag}]` : ""}: ${m.content}`;
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
- E-MAIL ABERTO: o histórico pode marcar e-mails como "aberto Nx" ou "ainda não aberto". É só um indício (alguns apps abrem sozinhos, outros bloqueiam) e serve pra VOCÊ calibrar o tom e a insistência. Nunca diga ou insinue que sabe que a pessoa abriu ou leu.
- FICHA PESSOAL: se houver, use no máximo UM detalhe por mensagem e só quando encaixar com naturalidade (ex.: na abertura, numa retomada, no aniversário). Nunca diga que tem ficha/anotações. Nada delicado (saúde, problemas pessoais, família em dificuldade) se o lead não trouxe o assunto.
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
- Se perguntarem por uma operadora/seguradora/produto específico que o material não cita, não confirme nem negue: diga que trabalha com as principais do mercado e que verifica.
- Não peça dados sensíveis (CPF, renda, saúde, documentos) e não mande links.
- Nunca diga que é IA, robô ou assistente — e nunca afirme ser humano se perguntarem: nesse caso, passe pro corretor.

PASSE A CONVERSA PRO CORRETOR (action = handoff) quando o lead:
- pedir preço, valor, cotação, proposta, simulação ou condição específica;
- pedir para ser chamado ou ligado agora (ex.: "me liga", "me chama no zap"): quem faz isso é o corretor;
- propuser ou aceitar um dia/horário concreto para conversar (se ele só aceitou conversar, sem horário, NÃO é handoff: responda perguntando o melhor dia e horário e se prefere telefone ou vídeo);
- perguntar se está falando com robô/IA/mensagem automática;
- estiver irritado, reclamar, ameaçar denunciar ou fizer crítica séria;
- indicar outra pessoa para tratar do assunto (registre quem no motivo);
- trouxer assunto sensível (sinistro, doença, caso jurídico), pergunta técnica que o material não responde, ou escrever em outro idioma;
- fizer algo que você não consiga responder com segurança.
O motivo do handoff deve ser curto e específico, para o corretor entender em 3 segundos (ex.: "Pediu cotação para 20 vidas").

CONTATO (WhatsApp / e-mail)
- Se o lead passar o próprio WhatsApp ou e-mail, ou disser que prefere falar por lá, NÃO é handoff: agradeça, diga que anotou e siga a conversa. O sistema já guarda o contato sozinho. Não prometa quando nem por qual canal vai chamar.
- Se a ficha ainda não tem WhatsApp e o lead já demonstrou interesse, você pode perguntar UMA vez, com leveza, qual o melhor número para continuar por WhatsApp. Se ele ignorar ou recusar, não insista.
- Número ou e-mail de OUTRA pessoa (assistente, sócio, indicação) continua sendo handoff.

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
            "Análise interna, NÃO é enviada. CURTA: no máximo 2 frases (até ~40 palavras): o que o lead quer e qual o próximo passo " +
            "(ou qual regra de handoff/encerramento se aplica).",
        },
        action: { type: "string", enum: ["reply", "handoff"] },
        message: {
          type: "string",
          description: "Texto da mensagem a enviar ao lead, segue o COMO ESCREVER. Obrigatório quando action = reply; deixe vazio (\"\") quando action = handoff.",
        },
        qualified: { type: "boolean", description: "true se o lead quer avançar. Só com action = reply." },
        declined: { type: "boolean", description: "true se o lead recusou claramente — encerra os follow-ups. Só com action = reply." },
        handoff_reason: { type: "string", description: "Motivo curto e específico (obrigatório se action = handoff)." },
      },
      // "message" obrigatório: alguns modelos pulam campos opcionais e mandavam
      // action=reply sem o texto.
      required: ["analysis", "action", "message"],
    },
  },
};

export interface ConversationInput {
  instructions: string | null;
  lead: LeadContext;
  history: HistoryItem[];
  // Canal em que a resposta vai sair (o mesmo em que o lead escreveu).
  channel?: MessageChannel;
  now?: Date;
}

export async function decideResponse(input: ConversationInput, opts: { model?: string } = {}): Promise<AgentDecision> {
  const client = nousClient();
  const model = opts.model || (await conversationModel());
  const now = input.now ?? new Date();

  const channel = input.channel ?? "LINKEDIN";
  const system = `Você é a secretária do corretor: conduz, por ele, as conversas com possíveis clientes (LinkedIn, e-mail e WhatsApp).

${contextBlock(input.instructions, input.lead, now)}

CANAL DESTA RESPOSTA: ${CHANNEL_NAME[channel]}. ${CHANNEL_STYLE[channel]}

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
    const response = await completeWithTool(client, { model, messages, tool: RESPOND_TOOL });
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

    if (out.action !== "reply") {
      return { action: "handoff", reason: out.handoff_reason?.trim() || "O agente não soube responder.", ...base, checkIssues: lastIssues };
    }

    // Quis responder mas esqueceu o texto (alguns modelos põem no content):
    // aproveita o content ou pede de novo, em vez de passar pro corretor.
    const message = (out.message?.trim() || response.choices[0]?.message?.content?.trim() || "").trim();
    lastIssues = message ? checkMessage({ message, previousOutgoing, instructions: input.instructions }) : ["faltou o texto da mensagem (campo message vazio)"];
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
  return `Você escreve, pelo corretor, mensagens (LinkedIn, e-mail ou WhatsApp) para possíveis clientes.

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
    const response = await completeWithTool(client, { model, messages, tool: WRITE_TOOL });
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

// Primeira mensagem no LinkedIn depois que o convite é aceito. Se já houve
// contato por outro canal (ex.: e-mail enquanto o convite estava pendente), o
// histórico entra pra não repetir a apresentação.
export async function generateOpeningMessage(
  instructions: string | null,
  lead: LeadContext,
  opts: { model?: string; history?: HistoryItem[] } = {},
): Promise<string> {
  const history = opts.history ?? [];
  return writeMessage(
    proactiveSystemPrompt(
      instructions,
      lead,
      "O lead acabou de aceitar o convite de conexão. Escreva a PRIMEIRA mensagem: agradeça a conexão em poucas palavras, faça uma ponte " +
        "com o cargo/área dele quando houver e abra espaço pra conversa. Use só o primeiro nome. Nada de pitch longo." +
        (history.length
          ? " Vocês já tiveram contato por outro canal (histórico abaixo): não se apresente de novo nem repita o que já foi dito; retome com naturalidade."
          : "") +
        `\nCanal desta mensagem: ${CHANNEL_NAME.LINKEDIN}. ${CHANNEL_STYLE.LINKEDIN}`,
    ),
    history.length ? `Contato até agora (mais antigo primeiro):\n${transcriptOf(history)}\n\nEscreva a mensagem de abertura no LinkedIn.` : "Escreva a mensagem de abertura.",
    { model: opts.model, check: { previousOutgoing: history.filter((m) => m.sender !== "LEAD").map((m) => m.content), instructions } },
  );
}

// Convite do LinkedIn parado há dias e a pessoa tem e-mail na ficha: a
// secretária se apresenta por e-mail (camada extra da prospecção).
export async function generateIntroEmail(instructions: string | null, lead: LeadContext, daysPending: number, opts: { model?: string } = {}): Promise<string> {
  return writeMessage(
    proactiveSystemPrompt(
      instructions,
      lead,
      `Você mandou um convite de conexão no LinkedIn para essa pessoa há ${daysPending} dias e ela ainda não aceitou (muita gente quase não entra lá). ` +
        "Escreva um PRIMEIRO e-mail curto de apresentação: quem você é em meia frase, uma ponte concreta com o cargo/empresa dela e uma pergunta leve. " +
        "Pode mencionar de passagem que tentou se conectar pelo LinkedIn. Nada de pitch, preço ou anexo." +
        `\nCanal desta mensagem: ${CHANNEL_NAME.EMAIL}. ${CHANNEL_STYLE.EMAIL}`,
    ),
    "Escreva o e-mail de apresentação (só o corpo).",
    { model: opts.model, check: { previousOutgoing: [], instructions } },
  );
}

// Contato adicionado à mão pelo corretor (indicação, evento, conhecido): a
// secretária faz o primeiro contato no canal escolhido por ele.
export async function generateFirstContact(instructions: string | null, lead: LeadContext, channel: MessageChannel, opts: { model?: string } = {}): Promise<string> {
  return writeMessage(
    proactiveSystemPrompt(
      instructions,
      lead,
      "Essa pessoa foi adicionada pelo próprio corretor — vocês se conhecem ou ela veio por indicação/evento (veja a ficha pessoal, se houver). " +
        "Escreva a PRIMEIRA mensagem: cumprimente pelo primeiro nome, faça a ponte com o que a ficha diz (como se conheceram, quem indicou) quando houver, " +
        "diga em meia frase por que está escrevendo e termine com uma pergunta leve. Nada de pitch, preço ou anexo. Não diga que achou a pessoa no LinkedIn." +
        `\nCanal desta mensagem: ${CHANNEL_NAME[channel]}. ${CHANNEL_STYLE[channel]}`,
    ),
    "Escreva a primeira mensagem.",
    { model: opts.model, check: { previousOutgoing: [], instructions } },
  );
}

// ---------------------------------------------------------------------------
// Próximo passo: com mais de um canal possível, a secretária decide se insiste,
// por onde, ou se para. Os sinais (convite, aberturas de e-mail, tentativas)
// vêm prontos em texto.
// ---------------------------------------------------------------------------

export interface NextStepDecision {
  action: "send" | "wait" | "stop";
  channel: MessageChannel | null;
  reason: string;
  usage: Usage;
}

function nextStepTool(options: MessageChannel[]): OpenAI.Chat.Completions.ChatCompletionTool {
  return {
    type: "function",
    function: {
      name: "next_step",
      description: "Decide o próximo passo com esta pessoa.",
      parameters: {
        type: "object",
        properties: {
          analysis: { type: "string", description: "Raciocínio curto (2-3 frases) sobre os sinais." },
          action: { type: "string", enum: ["send", "wait", "stop"] },
          channel: { type: "string", enum: options, description: "Obrigatório quando action=send." },
          reason: { type: "string", description: "Uma frase curta, em português, pro corretor entender a decisão. Ex.: \"Abriu o e-mail 2x e não respondeu; vou retomar pelo LinkedIn.\"" },
        },
        required: ["analysis", "action", "reason"],
      },
    },
  };
}

export async function decideNextStep(
  input: { instructions: string | null; lead: LeadContext; history: HistoryItem[]; options: MessageChannel[]; signals: string[]; extraTouch: boolean },
  opts: { model?: string } = {},
): Promise<NextStepDecision> {
  const client = nousClient();
  const model = opts.model || (await conversationModel());
  const system = `Você é a secretária do corretor e cuida da prospecção de novos clientes. A pessoa abaixo NÃO respondeu à nossa última mensagem.
Decida o PRÓXIMO PASSO: enviar uma mensagem por um dos canais disponíveis, esperar mais um pouco, ou encerrar.

${contextBlock(input.instructions, input.lead, new Date())}

CANAIS DISPONÍVEIS AGORA: ${input.options.map((c) => CHANNEL_NAME[c]).join(", ")}

SINAIS
${input.signals.map((s) => `- ${s}`).join("\n")}

COMO DECIDIR
- O LinkedIn é o canal principal da prospecção; e-mail é uma camada a mais.
- E-mail aberto é um indício de interesse (fraco: alguns apps abrem sozinhos). Abriu e não respondeu = vale uma nova tentativa, de preferência por OUTRO canal.
- Nada de sinal depois de várias tentativas = encerre com elegância (stop) em vez de insistir.
- Evite repetir o mesmo canal que já ficou sem resposta quando houver outro disponível e fizer sentido.
- WhatsApp só aparece nos canais quando a pessoa já deu sinal de interesse. É o canal mais pessoal: use quando o sinal for claro (respondeu antes, abriu e-mail) e o LinkedIn/e-mail não andaram; mensagem curta e leve.
- "wait" só quando o último contato foi recente demais ou algo indica que é melhor dar mais tempo.
${input.extraTouch ? "- A sequência normal de retomadas ACABOU. Só envie (uma última vez) se os sinais justificarem de verdade; caso contrário, stop.\n" : ""}
Use a ferramenta next_step. Nunca responda em texto livre.`;

  const response = await completeWithTool(client, {
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: `Histórico (mais antigo primeiro):\n${transcriptOf(input.history) || "(vazio)"}\n\nQual o próximo passo?` },
    ],
    tool: nextStepTool(input.options),
  });
  const toolCall = response.choices[0]?.message?.tool_calls?.[0];
  if (!toolCall || toolCall.type !== "function") throw new Error("O agente não decidiu o próximo passo.");
  const out = JSON.parse(toolCall.function.arguments) as { action?: string; channel?: string; reason?: string };
  const action = out.action === "wait" || out.action === "stop" ? out.action : "send";
  const channel = input.options.includes(out.channel as MessageChannel) ? (out.channel as MessageChannel) : null;
  // "send" sem canal válido: vai pelo primeiro disponível (o principal).
  return {
    action,
    channel: action === "send" ? (channel ?? input.options[0]) : null,
    reason: out.reason?.trim() || (action === "stop" ? "Sem sinais de interesse; encerrando." : "Decisão da secretária."),
    usage: usageOf(response),
  };
}

// Follow-up número `attempt` (1..maxCount) numa conversa sem resposta.
export async function generateFollowUp(
  instructions: string | null,
  lead: LeadContext,
  history: HistoryItem[],
  attempt: number,
  maxCount: number,
  channel: MessageChannel = "LINKEDIN",
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
        "Não repita frases, aberturas ou perguntas do histórico. Não mencione que é um follow-up nem conte tentativas.\n" +
        `Canal desta mensagem: ${CHANNEL_NAME[channel]}. ${CHANNEL_STYLE[channel]}`,
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
    const response = await completeWithTool(client, {
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
      tool: SCORE_TOOL,
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

export async function suggestReply(
  instructions: string | null,
  lead: LeadContext,
  history: HistoryItem[],
  channel: MessageChannel = "LINKEDIN",
): Promise<string> {
  return writeMessage(
    proactiveSystemPrompt(
      instructions,
      lead,
      "Escreva a PRÓXIMA mensagem do corretor nesta conversa, respondendo ao que o lead disse por último. " +
        "O corretor vai revisar antes de enviar, então aqui você pode sugerir mesmo quando seria caso de handoff. Não repita frases do histórico.\n" +
        `Canal desta mensagem: ${CHANNEL_NAME[channel]}. ${CHANNEL_STYLE[channel]}`,
    ),
    `Conversa até agora (mais antiga primeiro):\n${transcriptOf(history) || "(sem mensagens)"}`,
  );
}
