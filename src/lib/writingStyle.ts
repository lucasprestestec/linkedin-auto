import {
  CLOSED_QUESTIONS,
  PAIRS,
  PAIR_IDS,
  SITUATIONS,
  SITUATION_IDS,
  optionLabel,
  type Approach,
  type Closing,
  type EmojiLevel,
  type Formality,
  type Greeting,
  type LengthPref,
  type Treatment,
} from "@/lib/calibrationData";

export type { Approach, Closing, EmojiLevel, Formality, Greeting, LengthPref, Treatment };

// "Meu jeito de escrever": o que o corretor diz sobre como ele fala, vindo da calibragem e dos
// ajustes que ele pede depois. Entra no prompt do assistente como um bloco à parte. As REGRAS FIXAS
// (não inventar, não se dizer pessoa de verdade, quando passar a conversa) e o material de vendas
// sempre valem acima deste bloco.

export interface WritingStyle {
  treatment: Treatment;
  emoji: EmojiLevel;
  formality: Formality;
  length: LengthPref;
  greeting: Greeting;
  closing: Closing;
  approach: Approach;
  // Palavras e expressões que ele nunca / sempre usa (texto livre).
  never: string;
  always: string;
  // Respostas dele às situações da calibragem (id da situação -> texto).
  answers: Record<string, string>;
  // Qual versão ele escolheu em cada par "qual parece mais com você" (id do par -> A ou B).
  choices: Record<string, "A" | "B">;
  // Ajustes que ele pediu ou aceitou, um por item ("Escreva mensagens mais curtas").
  rules: string[];
  // Mensagens que ele colou à mão (opcional).
  samples: string[];
  // Sugestões que ele recusou (não voltam a aparecer).
  dismissed: string[];
  // Quando terminou a calibragem (ISO).
  calibratedAt: string | null;
}

export const EMPTY_STYLE: WritingStyle = {
  treatment: "auto",
  emoji: "auto",
  formality: "auto",
  length: "auto",
  greeting: "auto",
  closing: "auto",
  approach: "auto",
  never: "",
  always: "",
  answers: {},
  choices: {},
  rules: [],
  samples: [],
  dismissed: [],
  calibratedAt: null,
};

export const MAX_RULES = 20;
export const MAX_RULE_CHARS = 200;
export const MAX_SAMPLES = 20;
export const MAX_SAMPLE_CHARS = 600;
export const MAX_ANSWER_CHARS = 600;
export const MAX_WORDS_CHARS = 200;
export const SAMPLES_IN_PROMPT = 3;
const MAX_DISMISSED = 200;

function pick<T extends string>(v: unknown, allowed: readonly T[], fallback: T): T {
  return typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
}

// Texto que vai pro prompt: sem caracteres de controle e, nas regras, sem quebra de linha.
function clean(v: unknown, max: number, keepNewlines = false): string {
  if (typeof v !== "string") return "";
  const t = v
    .replace(/\r/g, "")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .trim();
  return (keepNewlines ? t.replace(/\n{3,}/g, "\n\n") : t.replace(/\s*\n\s*/g, " ")).slice(0, max).trim();
}

function list(v: unknown, max: number, maxChars: number, keepNewlines = false): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const item of v) {
    const t = clean(item, maxChars, keepNewlines);
    if (t && !out.includes(t)) out.push(t);
    if (out.length >= max) break;
  }
  return out;
}

function answersOf(v: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!v || typeof v !== "object" || Array.isArray(v)) return out;
  for (const [k, raw] of Object.entries(v as Record<string, unknown>)) {
    const t = clean(raw, MAX_ANSWER_CHARS, true);
    if (SITUATION_IDS.has(k) && t) out[k] = t;
  }
  return out;
}

function choicesOf(v: unknown): Record<string, "A" | "B"> {
  const out: Record<string, "A" | "B"> = {};
  if (!v || typeof v !== "object" || Array.isArray(v)) return out;
  for (const [k, raw] of Object.entries(v as Record<string, unknown>)) {
    if (PAIR_IDS.has(k) && (raw === "A" || raw === "B")) out[k] = raw;
  }
  return out;
}

// Aceita qualquer coisa (JSON do banco ou do formulário) e devolve um estilo válido.
export function parseWritingStyle(raw: unknown): WritingStyle {
  const o = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  return {
    treatment: pick(o.treatment, ["auto", "voce", "senhor", "varies"] as const, "auto"),
    // "few" era o nome antigo de "quase nunca".
    emoji: pick(o.emoji === "few" ? "rare" : o.emoji, ["auto", "never", "rare", "sometimes", "often"] as const, "auto"),
    formality: pick(o.formality, ["auto", "very_informal", "informal", "balanced", "formal", "very_formal"] as const, "auto"),
    length: pick(o.length, ["auto", "short", "medium", "long"] as const, "auto"),
    greeting: pick(o.greeting, ["auto", "oi", "ola", "bomdia", "direct", "varies"] as const, "auto"),
    closing: pick(o.closing, ["auto", "abraco", "att", "obrigado", "none", "varies"] as const, "auto"),
    approach: pick(o.approach, ["auto", "direct", "warm", "varies"] as const, "auto"),
    never: clean(o.never, MAX_WORDS_CHARS),
    always: clean(o.always, MAX_WORDS_CHARS),
    answers: answersOf(o.answers),
    choices: choicesOf(o.choices),
    rules: list(o.rules, MAX_RULES, MAX_RULE_CHARS),
    samples: list(o.samples, MAX_SAMPLES, MAX_SAMPLE_CHARS, true),
    dismissed: list(o.dismissed, MAX_DISMISSED, 80),
    calibratedAt: typeof o.calibratedAt === "string" && !Number.isNaN(Date.parse(o.calibratedAt)) ? o.calibratedAt : null,
  };
}

export function writingStyleIsEmpty(s: WritingStyle | null | undefined): boolean {
  if (!s) return true;
  return (
    s.treatment === "auto" &&
    s.emoji === "auto" &&
    s.formality === "auto" &&
    s.length === "auto" &&
    s.greeting === "auto" &&
    s.closing === "auto" &&
    s.approach === "auto" &&
    !s.never &&
    !s.always &&
    Object.keys(s.answers).length === 0 &&
    Object.keys(s.choices).length === 0 &&
    s.rules.length === 0 &&
    s.samples.length === 0
  );
}

// O que o corretor não respondeu diretamente, tentamos inferir das versões que ele escolheu ("qual
// parece mais com você?"). A resposta direta sempre vale mais.
export function effectiveTraits(s: WritingStyle): Pick<WritingStyle, "emoji" | "formality" | "length" | "approach"> {
  const votes: Record<"emoji" | "formality" | "length" | "approach", string[]> = { emoji: [], formality: [], length: [], approach: [] };
  for (const p of PAIRS) {
    const c = s.choices[p.id];
    if (!c) continue;
    const traits = c === "A" ? p.traitsA : p.traitsB;
    for (const [k, v] of Object.entries(traits)) votes[k as keyof typeof votes].push(v as string);
  }
  // Mais votado; em empate, o primeiro.
  const top = (arr: string[]) => {
    const counts = new Map<string, number>();
    for (const v of arr) counts.set(v, (counts.get(v) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  };
  return {
    emoji: s.emoji !== "auto" ? s.emoji : ((top(votes.emoji) as EmojiLevel | undefined) ?? "auto"),
    formality: s.formality !== "auto" ? s.formality : ((top(votes.formality) as Formality | undefined) ?? "auto"),
    length: s.length !== "auto" ? s.length : ((top(votes.length) as LengthPref | undefined) ?? "auto"),
    approach: s.approach !== "auto" ? s.approach : ((top(votes.approach) as Approach | undefined) ?? "auto"),
  };
}

// "Regras" que o assistente nunca vai seguir (as regras fixas vencem). Avisa na hora de escrever.
export interface RuleWarning {
  rule: string;
  why: string;
  // human / override: o assistente ignora a regra. price: só avisa (ele nunca passa preço, mas a regra é inofensiva).
  kind: "human" | "price" | "override";
}

export function ruleWarnings(rules: string[]): RuleWarning[] {
  const out: RuleWarning[] = [];
  for (const rule of rules) {
    if (/\bsou eu\b|humano|pessoa de verdade|n[aã]o sou (um )?rob[oô]|escrevendo eu/i.test(rule)) {
      out.push({ rule, kind: "human", why: "O assistente nunca diz que é uma pessoa de verdade, então essa regra não vale." });
    } else if (/ignor|esque[cç]a|desconsider/i.test(rule) && /regra|instru/i.test(rule)) {
      out.push({ rule, kind: "override", why: "As regras fixas do assistente não podem ser desligadas." });
    } else if (/pre[cç]o|valor|R\$|desconto|cota[cç][aã]o|\d\s?%/i.test(rule)) {
      out.push({ rule, kind: "price", why: "O assistente nunca passa preço nem desconto: isso fica com você." });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Leitura do perfil em palavras (tela) e bloco do prompt.
// ---------------------------------------------------------------------------

// Linhas "Emojis: quase nunca" pra mostrar o perfil ao corretor.
export function describeStyle(s: WritingStyle): { label: string; value: string }[] {
  const t = effectiveTraits(s);
  const rows: { label: string; value: string | null }[] = [
    { label: "Emojis", value: t.emoji === "auto" ? null : optionLabel("emoji", t.emoji) },
    { label: "Tom", value: t.formality === "auto" ? null : optionLabel("formality", t.formality) },
    { label: "Tamanho", value: t.length === "auto" ? null : optionLabel("length", t.length) },
    { label: "Trata o cliente", value: s.treatment === "auto" ? null : optionLabel("treatment", s.treatment) },
    { label: "Começa a conversa", value: s.greeting === "auto" ? null : optionLabel("greeting", s.greeting) },
    { label: "Despedida", value: s.closing === "auto" ? null : optionLabel("closing", s.closing) },
    { label: "Com alguém novo", value: t.approach === "auto" ? null : optionLabel("approach", t.approach) },
    { label: "Nunca usa", value: s.never || null },
    { label: "Costuma usar", value: s.always || null },
  ];
  return rows.filter((r): r is { label: string; value: string } => Boolean(r.value));
}

// Uma linha pra tela de configurações.
export function summarizeStyle(s: WritingStyle): string {
  if (writingStyleIsEmpty(s)) return "Ainda não calibrado: o assistente usa um jeito neutro";
  const answered = Object.keys(s.answers).length;
  const parts = [
    s.calibratedAt ? "Calibrado" : "Calibragem pela metade",
    answered && `${answered} resposta${answered > 1 ? "s" : ""} suas`,
    s.rules.length && `${s.rules.length} ajuste${s.rules.length > 1 ? "s" : ""}`,
  ].filter(Boolean);
  return parts.join(" · ");
}

function shuffled<T>(items: T[], rng: () => number): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const EMOJI_LINE: Record<EmojiLevel, string | null> = {
  auto: null,
  never: "Não use emojis.",
  rare: "Emojis só raramente: no máximo 1 e só se o lead usar.",
  sometimes: "Pode usar um emoji de vez em quando, se combinar com o tom do lead (no máximo 1 por mensagem).",
  often: "Ele gosta de emojis: pode usar 1 ou 2 por mensagem, com naturalidade.",
};

const FORMALITY_LINE: Record<Formality, string | null> = {
  auto: null,
  very_informal: "Tom bem informal, de conversa entre conhecidos (sem gírias pesadas e sem perder o respeito).",
  informal: "Tom informal e próximo.",
  balanced: "Tom equilibrado: cordial e profissional, sem ser duro.",
  formal: "Tom formal e cuidadoso.",
  very_formal: "Tom bem formal e protocolar.",
};

const LENGTH_LINE: Record<LengthPref, string | null> = {
  auto: null,
  short: "Mensagens bem curtas: 1 ou 2 frases.",
  medium: "Mensagens médias: 2 ou 3 frases.",
  long: "Pode ser um pouco mais completo: 3 ou 4 frases, sem virar texto longo.",
};

const TREATMENT_LINE: Record<Treatment, string | null> = {
  auto: null,
  voce: 'Trate a pessoa por "você".',
  senhor: 'Trate a pessoa por "senhor" ou "senhora" só quando o nome deixar isso claro; na dúvida, use o primeiro nome com tom respeitoso, sem adivinhar o gênero.',
  varies: "O tratamento varia com a pessoa: acompanhe o jeito dela (se ela for formal, seja formal).",
};

const GREETING_LINE: Record<Greeting, string | null> = {
  auto: null,
  oi: 'Ao começar uma conversa, use "Oi" e o primeiro nome da pessoa.',
  ola: 'Ao começar uma conversa, use "Olá" e o primeiro nome da pessoa.',
  bomdia: "Ao começar uma conversa, cumprimente conforme o horário (Bom dia, Boa tarde, Boa noite) e use o primeiro nome.",
  direct: "Não abra com saudação longa: vá direto ao assunto.",
  varies: null,
};

const CLOSING_LINE: Record<Closing, string | null> = {
  auto: null,
  abraco: 'Despedida dele: "Abraço". Use quando a mensagem pedir despedida (e-mail, encerramento, retomada), não em toda mensagem.',
  att: 'Despedida dele: "Att.". Use quando a mensagem pedir despedida (e-mail, encerramento, retomada), não em toda mensagem.',
  obrigado: 'Despedida dele: "Obrigado". Use quando a mensagem pedir despedida (e-mail, encerramento, retomada), não em toda mensagem.',
  none: "Ele não costuma usar despedida.",
  varies: null,
};

const APPROACH_LINE: Record<Approach, string | null> = {
  auto: null,
  direct: "Com alguém novo, vá direto ao que você oferece, em uma frase.",
  warm: "Com alguém novo, puxe conversa antes (pergunta sobre a pessoa ou a empresa) e só depois fale do que faz.",
  varies: null,
};

// Bloco do prompt. Sorteia alguns exemplos colados à mão a cada mensagem (variar evita que o
// assistente copie sempre as mesmas frases). Sem nada preenchido, devolve null.
export function renderStyleBlock(style: WritingStyle | null | undefined, rng: () => number = Math.random): string | null {
  if (!style || writingStyleIsEmpty(style)) return null;
  const t = effectiveTraits(style);
  const lines: string[] = [
    "JEITO DO CORRETOR (o tom e o formato que ele prefere). Onde isto conflitar com o COMO ESCREVER acima (tom, emojis, tamanho, saudação, despedida), vale o jeito do corretor. As REGRAS FIXAS logo abaixo e o material dele valem SEMPRE acima de tudo: se algo aqui conflitar com elas, ignore o que conflita.",
  ];
  for (const l of [
    EMOJI_LINE[t.emoji],
    FORMALITY_LINE[t.formality],
    LENGTH_LINE[t.length],
    TREATMENT_LINE[style.treatment],
    GREETING_LINE[style.greeting],
    CLOSING_LINE[style.closing],
    APPROACH_LINE[t.approach],
  ]) {
    if (l) lines.push(`- ${l}`);
  }
  if (style.never) lines.push(`- Palavras ou expressões que ele NUNCA usa: ${style.never}`);
  if (style.always) lines.push(`- Palavras ou expressões que ele costuma usar: ${style.always}`);
  if (style.rules.length) {
    lines.push("- Ajustes que ele pediu:");
    for (const r of style.rules) lines.push(`  • ${r}`);
  }

  const answered = SITUATIONS.filter((s) => style.answers[s.id]);
  if (answered.length) {
    lines.push(
      "- Como ELE mesmo responderia em situações parecidas (é o melhor retrato do jeito dele: aprenda o ritmo, o vocabulário e como abre e fecha; nunca copie frases inteiras nem use nomes ou dados que aparecerem):",
    );
    for (const s of answered) lines.push(`  • ${s.label}: "${style.answers[s.id].replace(/\n+/g, " / ")}"`);
  }

  const picked = PAIRS.filter((p) => style.choices[p.id]).map((p) => (style.choices[p.id] === "A" ? p.a : p.b));
  if (picked.length) {
    lines.push("- Versões que ele escolheu como as mais parecidas com o jeito dele (exemplos de tom, não para copiar):");
    for (const m of picked) lines.push(`  • "${m}"`);
  }

  if (style.samples.length) {
    const chosen = shuffled(style.samples, rng).slice(0, SAMPLES_IN_PROMPT);
    lines.push("- Outras mensagens que ele mesmo escreveu (nunca copie frases inteiras nem use os dados delas):");
    chosen.forEach((m, i) => lines.push(`  ${i + 1}) "${m.replace(/\n+/g, " / ")}"`));
  }
  return lines.length > 1 ? lines.join("\n") : null;
}

// Regras que a calibragem não cobre mas o corretor pode acabar pedindo: ver changeRequests.ts.
export const CLOSED_IDS = CLOSED_QUESTIONS.map((q) => q.id);

// ---------------------------------------------------------------------------
// "Não é meu jeito": motivos que o corretor escolhe. Cada um pode virar uma regra sugerida.
// ---------------------------------------------------------------------------

export interface FeedbackReason {
  key: string;
  label: string;
  // Regra sugerida quando o motivo se repete. null = não vira regra (vai pra revisão).
  rule: string | null;
}

export const FEEDBACK_REASONS: FeedbackReason[] = [
  { key: "long", label: "Muito longa", rule: "Escreva mensagens mais curtas: no máximo 2 frases." },
  { key: "formal", label: "Formal demais", rule: "Escreva de forma mais informal e direta, sem fórmulas de cortesia." },
  { key: "informal", label: "Informal demais", rule: "Escreva de forma um pouco mais cuidadosa e profissional, sem gírias." },
  { key: "repeated", label: "Repetiu o que já falei", rule: "Nunca repita o que já foi dito na conversa nem use a mesma abertura duas vezes." },
  { key: "invented", label: "Disse algo que não é verdade", rule: null },
  { key: "handoff_needed", label: "Devia ter passado pra mim", rule: "Na dúvida, passe a conversa pra mim em vez de responder." },
  { key: "handoff_not_needed", label: "Não precisava passar pra mim", rule: "Tente responder sozinho sempre que o meu material permitir; passe pra mim só nos casos das regras fixas." },
  { key: "other", label: "Outro motivo", rule: null },
];

export const REASON_KEYS = new Set(FEEDBACK_REASONS.map((r) => r.key));
export const DRAFT_REASON_KEYS = ["long", "formal", "informal", "repeated", "invented", "other"];
export const HANDOFF_REASON_KEYS = ["handoff_not_needed", "other"];
