// Conferência automática de uma mensagem antes de ela ir pro lead. Regras
// objetivas (sem IA): se alguma falhar, o agente reescreve uma vez; se falhar
// de novo, a conversa passa pro corretor. Usada também no banco de testes.

export interface CheckInput {
  message: string;
  // Mensagens que já enviamos (agente ou corretor), pra pegar repetição.
  previousOutgoing: string[];
  // Material do corretor: um valor em R$ só é aceito se estiver escrito ali.
  instructions: string | null;
}

const MAX_CHARS = 600;
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

export function checkMessage({ message, previousOutgoing, instructions }: CheckInput): string[] {
  const issues: string[] = [];
  const text = message.trim();
  if (!text) return ["mensagem vazia"];

  if (text.length > MAX_CHARS) issues.push(`longa demais (${text.length} caracteres; máximo ${MAX_CHARS})`);
  if (/https?:\/\/|www\.|\b[a-z0-9-]+\.(com|com\.br|net|org|io)\b/i.test(text)) issues.push("contém link ou site");
  if (/\[[^\]]{1,40}\]|\{[^}]{1,40}\}|<[^>]{1,40}>/.test(text)) issues.push("tem um campo não preenchido (ex.: [Nome])");
  if (/\*\*|__|^#{1,6}\s|^\s*([-*•]|\d+[.)])\s/m.test(text)) issues.push("usa formatação/lista, não parece mensagem de LinkedIn");

  if (
    // (?![\p{L}\p{N}]) no lugar de \b: o \b do JavaScript não trata "ô" como letra e deixava passar "robô".
    /\b(sou|como)\s+(uma?\s+)?(ia|intelig[eê]ncia artificial|assistente virtual|chatbot|bot|rob[oô]|modelo de linguagem)(?![\p{L}\p{N}])/iu.test(text) ||
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
  if (questions > MAX_QUESTIONS) issues.push(`perguntas demais numa mensagem só (${questions})`);

  const emojis = (text.match(/\p{Extended_Pictographic}/gu) ?? []).length;
  if (emojis > MAX_EMOJIS) issues.push(`emojis demais (${emojis})`);

  const said = new Set(previousOutgoing.flatMap(sentences));
  const repeated = sentences(text).find((s) => said.has(s));
  if (repeated) issues.push("repete uma frase que já mandamos antes");
  if (previousOutgoing.some((p) => normalize(p) === normalize(text))) issues.push("é igual a uma mensagem anterior");

  return issues;
}
