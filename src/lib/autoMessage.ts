// Reconhece, por regra (sem IA), mensagens que NÃO vêm de uma pessoa conversando: menu de
// atendimento, resposta automática de férias, protocolo, FAQ, pedido de CPF/CNPJ de robô,
// "prove que é humano" e assistentes de IA de terceiros. O agente nunca conversa com isso:
// passa pro corretor com o motivo. Só padrões claros; o que a regra não pegar, o prompt cobre.

export interface AutoMessage {
  kind: "menu" | "auto_reply" | "faq" | "data_request" | "human_check" | "ai_assistant";
  // Motivo legível pro corretor.
  reason: string;
  // Não vale acordar o corretor por push (ex.: menu, resposta de férias).
  silent: boolean;
}

function norm(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

export function detectAutomatedMessage(text: string): AutoMessage | null {
  const t = norm(text);

  // Uma pessoa perguntando "você é um robô?" / "isso é mensagem automática?" não é robô: o modelo trata (handoff).
  if (
    /\b(voce|vc|tu)\s+(e|eh|esta)\s+(um\s+|uma\s+|o\s+|a\s+)?(robo|bot|ia|chatbot|inteligencia)\b/.test(t) ||
    /\b(isso|isto)\s+(e|eh)\s+(uma\s+)?(mensagem\s+)?automatic[^.!\n]*\?/.test(t)
  ) {
    return null;
  }

  if (/\b(assistente|atendente)\s+(de\s+)?(ia|inteligencia artificial)\b/.test(t)) {
    return { kind: "ai_assistant", reason: "Quem respondeu é um assistente de IA (não a pessoa); veja se vale continuar com ela", silent: false };
  }

  if (/\b(n[aã]o|nao)\s+(sou\s+)?(um\s+)?robo\b/.test(t) && /\b(responda|digite|clique|confirme|envie)\b/.test(t)) {
    return { kind: "human_check", reason: "Pediu para confirmar que é humano (verificação automática); o assistente não respondeu", silent: true };
  }

  if (/\bdigite\s+(o\s+numero\s+|a\s+opcao\s+)?\d\b/.test(t) || /(^|\n)\s*\d\s*[-–.)]\s*\S[^\n]*\n\s*\d\s*[-–.)]\s*\S[^\n]*\n\s*\d\s*[-–.)]\s*\S/.test(t)) {
    return { kind: "menu", reason: "Caiu num menu de atendimento automático da empresa; o assistente não respondeu", silent: true };
  }

  if (
    /\b(resposta|mensagem|e-?mail|atendimento)\s+automatic[oa]\b/.test(t) ||
    /\b(out of office|auto-?reply|fora do escritorio)\b/.test(t) ||
    /\bnao\s+responda\s+(a\s+)?(est[ea]|ess[ea])\b|\bpor favor,?\s+nao\s+responda\b/.test(t) ||
    /\bprotocolo\D{0,8}\d{4,}/.test(t)
  ) {
    return { kind: "auto_reply", reason: "Resposta automática (ausência, protocolo ou aviso), não uma conversa; o assistente não respondeu", silent: true };
  }

  if (/\b(assistente|atendente)\s+virtual\b|\bchatbot\b/.test(t)) {
    return { kind: "faq", reason: "Respondeu um assistente virtual da empresa (atendimento automático); o assistente não respondeu", silent: true };
  }

  if (/\bpara\s+(abrir|registrar)\s+(um\s+)?chamado\b|\bpara\s+continuar(\s+o\s+atendimento)?,?\s+informe\b|\binforme\s+(o\s+)?(seu\s+|o\s+)?(cnpj|cpf)\b/.test(t)) {
    return { kind: "data_request", reason: "Atendimento automático pedindo dados (CNPJ/CPF ou chamado); o assistente não respondeu", silent: true };
  }

  return null;
}
