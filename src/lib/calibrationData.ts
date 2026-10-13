// Conteúdo da calibragem do assistente: o que perguntamos ao corretor e como cada resposta vira
// "jeito de escrever". Só dados (sem banco, sem IA), usado nas telas e no prompt.

export type Treatment = "auto" | "voce" | "senhor" | "varies";
export type EmojiLevel = "auto" | "never" | "rare" | "sometimes" | "often";
export type Formality = "auto" | "very_informal" | "informal" | "balanced" | "formal" | "very_formal";
export type LengthPref = "auto" | "short" | "medium" | "long";
export type Greeting = "auto" | "oi" | "ola" | "bomdia" | "direct" | "varies";
export type Closing = "auto" | "abraco" | "att" | "obrigado" | "none" | "varies";
export type Approach = "auto" | "direct" | "warm" | "varies";

export interface Option {
  value: string;
  label: string;
}

export type ClosedId = "emoji" | "treatment" | "formality" | "length" | "greeting" | "closing" | "approach";

export interface ClosedQuestion {
  id: ClosedId;
  title: string;
  options: Option[];
}

// Parte 1: perguntas de múltipla escolha. "auto" = ainda não respondeu (sem regra).
export const CLOSED_QUESTIONS: ClosedQuestion[] = [
  {
    id: "emoji",
    title: "Você usa emojis nas mensagens de trabalho?",
    options: [
      { value: "never", label: "Nunca" },
      { value: "rare", label: "Quase nunca" },
      { value: "sometimes", label: "Às vezes" },
      { value: "often", label: "Bastante" },
    ],
  },
  {
    id: "formality",
    title: "Seu jeito de falar com cliente é mais…",
    options: [
      { value: "very_informal", label: "Bem informal" },
      { value: "informal", label: "Informal" },
      { value: "balanced", label: "Equilibrado" },
      { value: "formal", label: "Formal" },
      { value: "very_formal", label: "Bem formal" },
    ],
  },
  {
    id: "length",
    title: "Suas mensagens costumam ser…",
    options: [
      { value: "short", label: "Bem curtas (1 ou 2 frases)" },
      { value: "medium", label: "Médias (2 ou 3 frases)" },
      { value: "long", label: "Mais completas (3 ou 4 frases)" },
    ],
  },
  {
    id: "treatment",
    title: "Como você chama o cliente?",
    options: [
      { value: "voce", label: "De “você”" },
      { value: "senhor", label: "De “senhor” ou “senhora”" },
      { value: "varies", label: "Depende da pessoa" },
    ],
  },
  {
    id: "greeting",
    title: "Como você começa uma conversa?",
    options: [
      { value: "oi", label: "“Oi, Fulano”" },
      { value: "ola", label: "“Olá, Fulano”" },
      { value: "bomdia", label: "“Bom dia” ou “Boa tarde”" },
      { value: "direct", label: "Vou direto ao assunto" },
      { value: "varies", label: "Depende" },
    ],
  },
  {
    id: "closing",
    title: "Como você costuma se despedir?",
    options: [
      { value: "abraco", label: "“Abraço”" },
      { value: "att", label: "“Att.”" },
      { value: "obrigado", label: "“Obrigado”" },
      { value: "none", label: "Sem despedida" },
      { value: "varies", label: "Depende" },
    ],
  },
  {
    id: "approach",
    title: "Com alguém novo, você…",
    options: [
      { value: "direct", label: "Vai direto ao que oferece" },
      { value: "warm", label: "Puxa conversa antes de falar do que faz" },
      { value: "varies", label: "Depende" },
    ],
  },
];

export function optionLabel(id: ClosedId, value: string): string | null {
  return CLOSED_QUESTIONS.find((q) => q.id === id)?.options.find((o) => o.value === value)?.label ?? null;
}

// Parte 3: situações reais. O corretor responde com as próprias palavras; cada resposta vira um
// exemplo do jeito dele para aquela situação. `label` é como a situação aparece no prompt.
export interface Situation {
  id: string;
  label: string;
  // O que está acontecendo (mostrado na tela).
  context: string;
  // O que o lead disse (vazio quando a mensagem é sua, sem resposta de ninguém).
  leadSays: string;
  ask: string;
}

export const SITUATIONS: Situation[] = [
  {
    id: "abertura",
    label: "primeira mensagem, depois que a pessoa aceita a conexão",
    context: "Uma Diretora de RH de uma empresa média acabou de aceitar o seu convite de conexão no LinkedIn.",
    leadSays: "",
    ask: "Qual seria a sua primeira mensagem para ela?",
  },
  {
    id: "quem_e",
    label: 'quando o lead pergunta "do que se trata?"',
    context: "O lead respondeu à sua primeira mensagem.",
    leadSays: "Oi, tudo bem? Do que se trata?",
    ask: "Como você responderia?",
  },
  {
    id: "ja_tenho",
    label: "quando o lead diz que já tem fornecedor",
    context: "Você perguntou como a empresa cuida disso hoje.",
    leadSays: "Já temos isso resolvido aqui, obrigado.",
    ask: "Como você responderia?",
  },
  {
    id: "desconfiado",
    label: "quando o lead desconfia",
    context: "O lead está com o pé atrás.",
    leadSays: "Mais um vendedor… como você conseguiu meu contato?",
    ask: "Como você responderia?",
  },
  {
    id: "preco",
    label: "quando o lead pergunta o preço logo de cara",
    context: "Ele ainda não sabe nem como funciona.",
    leadSays: "Quanto custa?",
    ask: "Como você responderia?",
  },
  {
    id: "sem_tempo",
    label: "quando o lead está sem tempo",
    context: "O lead respondeu, mas está corrido.",
    leadSays: "Agora estou sem tempo, me chama no mês que vem.",
    ask: "Como você responderia?",
  },
  {
    id: "interesse",
    label: "quando o lead topa conversar",
    context: "O lead demonstrou interesse.",
    leadSays: "Interessante! Pode ser, vamos conversar.",
    ask: "Como você responderia para marcar?",
  },
  {
    id: "silencio",
    label: "retomada depois de alguns dias sem resposta",
    context: "Você mandou uma mensagem há 3 dias e a pessoa não respondeu.",
    leadSays: "",
    ask: "Como você retomaria o contato?",
  },
  {
    id: "sem_interesse",
    label: "quando o lead recusa",
    context: "O lead respondeu com educação, mas recusou.",
    leadSays: "Não tenho interesse, obrigado.",
    ask: "Como você responderia?",
  },
  {
    id: "despedida",
    label: "quando a conversa termina bem",
    context: "A conversa correu bem e o lead está encerrando.",
    leadSays: "Valeu, obrigado pela conversa!",
    ask: "Como você responderia?",
  },
];

export const SITUATION_IDS = new Set(SITUATIONS.map((s) => s.id));

// Parte 2: "qual parece mais com você?". Escolher é mais fácil que escrever. O texto escolhido vira
// exemplo e, se o corretor não respondeu a pergunta direta, ajuda a inferir tamanho, tom e emoji.
export interface Pair {
  id: string;
  situation: string;
  a: string;
  b: string;
  traitsA: Partial<{ length: LengthPref; formality: Formality; emoji: EmojiLevel; approach: Approach }>;
  traitsB: Partial<{ length: LengthPref; formality: Formality; emoji: EmojiLevel; approach: Approach }>;
}

export const PAIRS: Pair[] = [
  {
    id: "ab_quem_e",
    situation: 'O lead pergunta: "Do que se trata?"',
    a: "Oi! Trabalho com benefícios para empresas. Vocês já oferecem algo pro time hoje?",
    b: "Olá, tudo bem? Muito prazer! Sou corretor e ajudo empresas a estruturar benefícios para os colaboradores. Gostaria de entender como vocês trabalham com isso atualmente.",
    traitsA: { length: "short", formality: "informal" },
    traitsB: { length: "long", formality: "formal" },
  },
  {
    id: "ab_ja_tenho",
    situation: 'O lead diz: "Já temos, obrigado."',
    a: "Que bom! Quando é a renovação de vocês? Às vezes vale comparar só pra ter uma referência.",
    b: "Entendo perfeitamente e fico feliz que já estejam bem atendidos. Se quiser, posso fazer uma comparação sem compromisso para garantir que continuem com as melhores condições.",
    traitsA: { length: "short", formality: "informal" },
    traitsB: { length: "long", formality: "formal" },
  },
  {
    id: "ab_abertura",
    situation: "Uma pessoa acabou de aceitar seu convite no LinkedIn.",
    a: "Oi, Mariana! Valeu por aceitar. Vi que você cuida do RH da Vértice: como vocês lidam com benefícios hoje?",
    b: "Oi, Mariana, tudo bem? Obrigado pela conexão! Gostei de conhecer o trabalho de vocês na Vértice e fiquei curioso pra saber mais.",
    traitsA: { approach: "direct" },
    traitsB: { approach: "warm" },
  },
  {
    id: "ab_emoji",
    situation: "O lead aceitou conversar na quinta.",
    a: "Show, combinado! 😊 Qualquer coisa é só me chamar.",
    b: "Combinado. Qualquer dúvida, é só me chamar.",
    traitsA: { emoji: "sometimes" },
    traitsB: { emoji: "rare" },
  },
];

export const PAIR_IDS = new Set(PAIRS.map((p) => p.id));
