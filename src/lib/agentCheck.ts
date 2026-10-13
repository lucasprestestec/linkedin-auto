// Conferência automática de uma mensagem antes de ela ir pro lead. Regras
// objetivas (sem IA): se alguma falhar, o agente reescreve uma vez; se falhar
// de novo, a conversa passa pro corretor. Usada também no banco de testes.

export interface CheckInput {
  message: string;
  // Mensagens que já enviamos (agente ou corretor), pra pegar repetição.
  previousOutgoing: string[];
  // Material do corretor: um valor em R$ só é aceito se estiver escrito ali.
  instructions: string | null;
  // A assistente pode confirmar que é assistente virtual (admin).
  allowAiDisclosure?: boolean;
}

const MAX_CHARS = 600;
// Texto aprovado do material (abertura, cadência) pode ser maior, até aqui.
const MAX_CHARS_APPROVED = 1500;
const MAX_QUESTIONS = 2;
const MAX_EMOJIS = 2;

function normalize(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sentences(s: string) {
  return s
    .split(/(?<=[.!?])\s+|\n+/)
    .map(normalize)
    .filter((x) => x.length >= 30);
}

// A mensagem segue um texto do material? Mede quantos trechos de 5 palavras
// dela aparecem no material (nome e empresa trocados não atrapalham).
function followsMaterial(text: string, material: string | null): boolean {
  if (!material) return false;
  const words = normalize(text).split(" ");
  if (words.length < 12) return false;
  const haystack = ` ${normalize(material)} `;
  let total = 0;
  let found = 0;
  for (let i = 0; i + 5 <= words.length; i += 2) {
    total++;
    if (haystack.includes(` ${words.slice(i, i + 5).join(" ")} `)) found++;
  }
  return total > 0 && found / total >= 0.5;
}

export function checkMessage({ message, previousOutgoing, instructions, allowAiDisclosure }: CheckInput): string[] {
  const issues: string[] = [];
  const text = message.trim();
  if (!text) return ["mensagem vazia"];

  const approved = followsMaterial(text, instructions);
  const maxChars = approved ? MAX_CHARS_APPROVED : MAX_CHARS;
  if (text.length > maxChars) issues.push(`longa demais (${text.length} caracteres; máximo ${maxChars})`);
  if (/https?:\/\/|www\.|\b[a-z0-9-]+\.(com|com\.br|net|org|io)\b/i.test(text)) issues.push("contém link ou site");
  if (/\[[^\]]{1,40}\]|\{[^}]{1,40}\}|<[^>]{1,40}>/.test(text)) issues.push("tem um campo não preenchido (ex.: [Nome])");
  if (/\*\*|__|^#{1,6}\s/m.test(text) || (!approved && /^\s*([-*•]|\d+[.)])\s/m.test(text))) {
    issues.push("usa formatação/lista, não parece mensagem de conversa");
  }

  if (
    !allowAiDisclosure &&
    // (?![\p{L}\p{N}]) no lugar de \b: o \b do JavaScript não trata "ô" como letra e deixava passar "robô".
    /\b(sou|como)\s+((uma?|a|o)\s+)?(ia|intelig[eê]ncia artificial|assistente virtual|chatbot|bot|rob[oô]|modelo de linguagem)(?![\p{L}\p{N}])/iu.test(text) ||
    /\bmodelo de linguagem\b/i.test(text)
  ) {
    issues.push("se apresenta como IA/robô");
  }

  // O contrário também é proibido: afirmar ser uma pessoa de verdade (mesmo sem ninguém perguntar).
  if (
    /\bsou eu (mesmo|mesma)\s+(que\s+)?(estou\s+|to\s+|tô\s+)?(escrevendo|digitando)\b/i.test(text) ||
    /\b(eu|a gente) (mesmo|mesma) (estou|to|tô) (escrevendo|digitando)\b/i.test(text) ||
    /\bn[aã]o\s+(sou|é|e)\s+(um\s+|uma\s+)?(rob[oô]|bot|ia|m[aá]quina|mensagem autom[aá]tica)(?![\p{L}\p{N}])/iu.test(text) ||
    /\bsou\s+(uma\s+)?(pessoa|humano|humana)\b(\s+de verdade|\s+real)?/i.test(text) ||
    /\bpessoa de verdade\b/i.test(text)
  ) {
    issues.push("afirma ser uma pessoa de verdade (o assistente nunca pode dizer isso)");
  }

  // Valores em dinheiro só se o próprio material do corretor trouxer o número.
  const money = text.match(/R\$\s?\d[\d.,]*|\b\d[\d.,]*\s?(reais|mil reais)\b/gi) ?? [];
  const allowed = new Set((instructions?.match(/\d[\d.,]*/g) ?? []).map((d) => d.replace(/\D/g, "")));
  for (const m of money) {
    const digits = m.replace(/\D/g, "");
    if (!digits || !allowed.has(digits)) {
      issues.push(`cita valor em dinheiro que não está no material (${m.trim()})`);
      break;
    }
  }


  const questions = (text.match(/\?/g) ?? []).length;
  if (questions > MAX_QUESTIONS && !approved) issues.push(`perguntas demais numa mensagem só (${questions})`);

  const emojis = (text.match(/\p{Extended_Pictographic}/gu) ?? []).length;
  if (emojis > MAX_EMOJIS) issues.push(`emojis demais (${emojis})`);

  const said = new Set(previousOutgoing.flatMap(sentences));
  const repeated = sentences(text).find((s) => said.has(s));
  if (repeated) issues.push("repete uma frase que já mandamos antes");
  if (previousOutgoing.some((p) => normalize(p) === normalize(text))) issues.push("é igual a uma mensagem anterior");

  return issues;
}
