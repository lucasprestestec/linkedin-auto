// "Meu jeito de escrever": o que o corretor diz sobre como ele fala. Entra no prompt do
// assistente como um bloco à parte. As REGRAS FIXAS (não inventar, não se dizer humano,
// quando passar a conversa) e o material de vendas sempre valem acima deste bloco.

export type Treatment = "auto" | "voce" | "senhor";
export type EmojiLevel = "auto" | "never" | "few";
export type LengthPref = "auto" | "short";

export interface WritingStyle {
  treatment: Treatment;
  emoji: EmojiLevel;
  length: LengthPref;
  // Regras do jeito dele, uma por item ("Nunca começo com 'Prezado'").
  rules: string[];
  // Mensagens que ele mesmo já escreveu.
  samples: string[];
  // Sugestões que ele recusou (não voltam a aparecer).
  dismissed: string[];
}

export const EMPTY_STYLE: WritingStyle = { treatment: "auto", emoji: "auto", length: "auto", rules: [], samples: [], dismissed: [] };

export const MAX_RULES = 12;
export const MAX_RULE_CHARS = 200;
export const MAX_SAMPLES = 20;
export const MAX_SAMPLE_CHARS = 600;
export const SAMPLES_IN_PROMPT = 5;
const MAX_DISMISSED = 200;

function pick<T extends string>(v: unknown, allowed: readonly T[], fallback: T): T {
  return typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
}

// Texto que vai pro prompt: sem caracteres de controle e sem quebra de linha nas regras.
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

// Aceita qualquer coisa (JSON do banco ou do formulário) e devolve um estilo válido.
export function parseWritingStyle(raw: unknown): WritingStyle {
  const o = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  return {
    treatment: pick(o.treatment, ["auto", "voce", "senhor"] as const, "auto"),
    emoji: pick(o.emoji, ["auto", "never", "few"] as const, "auto"),
    length: pick(o.length, ["auto", "short"] as const, "auto"),
    rules: list(o.rules, MAX_RULES, MAX_RULE_CHARS),
    samples: list(o.samples, MAX_SAMPLES, MAX_SAMPLE_CHARS, true),
    dismissed: list(o.dismissed, MAX_DISMISSED, 80),
  };
}

export function writingStyleIsEmpty(s: WritingStyle | null | undefined): boolean {
  return !s || (s.treatment === "auto" && s.emoji === "auto" && s.length === "auto" && s.rules.length === 0 && s.samples.length === 0);
}

// Avisa, na hora de escrever, regras que o assistente nunca vai seguir (as regras fixas vencem).
export function ruleWarnings(rules: string[]): { rule: string; why: string }[] {
  const out: { rule: string; why: string }[] = [];
  for (const rule of rules) {
    if (/\bsou eu\b|humano|pessoa de verdade|n[aã]o sou (um )?rob[oô]|escrevendo eu/i.test(rule)) {
      out.push({ rule, why: "O assistente nunca diz que é uma pessoa de verdade, então essa regra não vale." });
    } else if (/pre[cç]o|valor|R\$|desconto|cota[cç][aã]o|\d\s?%/i.test(rule)) {
      out.push({ rule, why: "O assistente nunca passa preço nem desconto: isso fica com você." });
    } else if (/ignor|esque[cç]a|desconsider/i.test(rule) && /regra|instru/i.test(rule)) {
      out.push({ rule, why: "As regras fixas do assistente não podem ser desligadas." });
    }
  }
  return out;
}

// Uma linha pra tela de configurações.
export function summarizeStyle(s: WritingStyle): string {
  if (writingStyleIsEmpty(s)) return "Ainda não definido: o assistente usa um jeito neutro";
  const parts = [
    s.samples.length && `${s.samples.length} exemplo${s.samples.length > 1 ? "s" : ""}`,
    s.rules.length && `${s.rules.length} regra${s.rules.length > 1 ? "s" : ""}`,
    s.treatment === "voce" ? 'trata por "você"' : s.treatment === "senhor" ? 'trata por "senhor(a)"' : "",
    s.emoji === "never" ? "sem emoji" : s.emoji === "few" ? "poucos emojis" : "",
    s.length === "short" ? "mensagens curtas" : "",
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

// Bloco do prompt. Sorteia alguns exemplos a cada mensagem: variar evita que o assistente
// copie sempre as mesmas frases. Sem nada preenchido, devolve null (o prompt fica como está).
export function renderStyleBlock(style: WritingStyle | null | undefined, rng: () => number = Math.random): string | null {
  if (!style || writingStyleIsEmpty(style)) return null;
  const lines: string[] = [
    "JEITO DO CORRETOR (o tom e o formato que ele prefere. As REGRAS FIXAS logo abaixo e o material dele valem SEMPRE acima disto: se algo aqui conflitar com elas, ignore o que conflita)",
  ];
  if (style.treatment === "voce") lines.push('- Trate a pessoa por "você".');
  if (style.treatment === "senhor") lines.push('- Trate a pessoa por "senhor" ou "senhora" (se não souber o gênero, use o nome).');
  if (style.emoji === "never") lines.push("- Não use emojis.");
  if (style.emoji === "few") lines.push("- Emojis só raramente: no máximo 1 e só se o lead usar.");
  if (style.length === "short") lines.push("- Prefira mensagens bem curtas: 1 ou 2 frases.");
  if (style.rules.length) {
    lines.push("- Regras dele:");
    for (const r of style.rules) lines.push(`  • ${r}`);
  }
  if (style.samples.length) {
    const chosen = shuffled(style.samples, rng).slice(0, SAMPLES_IN_PROMPT);
    lines.push(
      "- Mensagens que ele mesmo já escreveu. Aprenda o ritmo, o vocabulário e o jeito de abrir e fechar. Nunca copie frases inteiras e nunca use os nomes, empresas ou dados que aparecerem nelas:",
    );
    chosen.forEach((m, i) => lines.push(`  ${i + 1}) "${m.replace(/\n+/g, " / ")}"`));
  }
  return lines.join("\n");
}

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
