// Ações prontas do compositor: cada uma pede à IA um rascunho com um objetivo, usando a conversa e a ficha.
// O rascunho cai no campo de mensagem para o corretor revisar; nada é enviado sozinho.
export const REPLY_INTENTS = {
  documents: {
    label: "Pedir documentos",
    goal: "pedir os documentos para avançar. Peça só os que o material do corretor cita como necessários; se o material não cita nenhum, peça de forma geral os documentos para montar a proposta, sem inventar uma lista.",
  },
  talk: {
    label: "Convidar para conversar",
    goal: "convidar a pessoa para uma conversa curta e pedir que diga o melhor dia e horário. Não invente horários.",
  },
  next: {
    label: "Confirmar próximos passos",
    goal: "agradecer e confirmar os próximos passos combinados. Cite só o que está na conversa; não crie compromissos novos.",
  },
  nudge: {
    label: "Retomar com leveza",
    goal: "retomar o contato de forma leve, sem pressionar, lembrando o assunto da conversa.",
  },
} as const;

export type ReplyIntent = keyof typeof REPLY_INTENTS;

export const isReplyIntent = (v: unknown): v is ReplyIntent => typeof v === "string" && Object.hasOwn(REPLY_INTENTS, v);

// Prazos do "Lembrar de retornar".
export const REMIND_OPTIONS = [
  { days: 1, label: "Amanhã" },
  { days: 3, label: "Em 3 dias" },
  { days: 7, label: "Em 1 semana" },
] as const;
