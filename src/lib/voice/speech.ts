// Texto que vai ser FALADO (mensagem de voz). Sem banco e sem rede: só regras.

// Áudio longo cansa e custa por letra: passou disso, a resposta sai em texto.
export const MAX_SPEECH_CHARS = 500;

const EMOJI = /[\p{Extended_Pictographic}️‍]/gu;
const URL = /https?:\/\/\S+|www\.\S+/gi;

// Abreviações de chat que a voz leria errado ("vc" viraria "vê cê").
const SPOKEN: [RegExp, string][] = [
  [/\bvcs\b/gi, "vocês"],
  [/\bvc\b/gi, "você"],
  [/\bpq\b/gi, "porque"],
  [/\btbm?\b/gi, "também"],
  [/\bblz\b/gi, "beleza"],
  [/\bobg\b/gi, "obrigado"],
  [/\bmsg\b/gi, "mensagem"],
  [/\bhj\b/gi, "hoje"],
];

// Limpa o texto pra voz: tira emoji, link e marcação, lê "R$" e "%" por extenso e garante pausas.
export function prepareSpeechText(text: string): string {
  let t = text
    .replace(URL, "")
    .replace(EMOJI, "")
    .replace(/[*_`#>~]+/g, "")
    .replace(/R\$\s?([\d.,]+)/g, "$1 reais")
    .replace(/(\d)\s?%/g, "$1 por cento");
  for (const [rx, to] of SPOKEN) t = t.replace(rx, to);
  t = t
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => (/[.!?…:]$/.test(l) ? l : `${l}.`))
    .join(" ")
    .replace(/\s{2,}/g, " ")
    .trim();
  return t;
}

// Motivos pra NÃO mandar essa resposta em áudio (ela vai em texto). Vazio = pode falar.
export function speechIssues(text: string): string[] {
  const issues: string[] = [];
  const t = text.trim();
  if (!t) return ["vazia"];
  if (t.length > MAX_SPEECH_CHARS) issues.push(`longa demais pra áudio (${t.length} caracteres; máximo ${MAX_SPEECH_CHARS})`);
  if (URL.test(t)) issues.push("tem link (não dá pra falar um link)");
  URL.lastIndex = 0;
  if (/\d[\d\s().-]{7,}\d/.test(t)) issues.push("tem número longo (telefone, código) que não funciona bem falado");
  return issues;
}
