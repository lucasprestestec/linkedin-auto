// Sinais concretos de interesse numa conversa, cada um com o trecho que o justifica.
// Regra simples e explicável (sem IA): o corretor vê o PORQUÊ de a pessoa estar entre as mais quentes.

export interface SignalMessage {
  sender: "LEAD" | "AGENT" | "HUMAN";
  content: string;
  at: Date;
  openCount: number;
}

export interface Signal {
  key: string;
  label: string;
  quote?: string;
  points: number;
}

const ASK_PRICE = /\b(proposta|or[cç]amento|cota[cç][aã]o|pre[cç]o|valores?|quanto (custa|fica|sai)|me (manda|envia|passa) (os )?(valores|detalhes|informa))/i;
const MEETING = /\b(reuni[aã]o|conversar|ligar|liga[cç][aã]o|agendar|marcar|hor[aá]rio|call|videochamada)\b/i;
const RENEWAL = /\b(renov\w*|vence\w*|vencimento|fim do contrato|contrato (acaba|termina)|reajuste)\b/i;
const DECIDER = /\b(s[oó]ci[oa]|dono|propriet[aá]ri[oa]|ceo|diretor\w*|presidente|fundador\w*|gerente|head|rh|recursos humanos|pessoas)\b/i;

const quote = (text: string, re: RegExp) => {
  const m = re.exec(text);
  if (!m) return undefined;
  const from = Math.max(0, m.index - 30);
  const clip = text.slice(from, m.index + m[0].length + 50).replace(/\s+/g, " ").trim();
  return `${from > 0 ? "…" : ""}${clip}${m.index + m[0].length + 50 < text.length ? "…" : ""}`;
};

export function hotSignals(input: { status: string; jobTitle: string | null; messages: SignalMessage[]; now: Date }): Signal[] {
  const { status, jobTitle, messages, now } = input;
  const fromLead = messages.filter((m) => m.sender === "LEAD");
  const out: Signal[] = [];
  const find = (re: RegExp) => [...fromLead].reverse().find((m) => re.test(m.content));

  const price = find(ASK_PRICE);
  if (price) out.push({ key: "price", label: "Pediu proposta ou valores", quote: quote(price.content, ASK_PRICE), points: 3 });
  const meet = find(MEETING);
  if (meet) out.push({ key: "meeting", label: "Falou em reunião ou conversa", quote: quote(meet.content, MEETING), points: 3 });
  const renew = find(RENEWAL);
  if (renew) out.push({ key: "renewal", label: "Mencionou renovação ou vencimento", quote: quote(renew.content, RENEWAL), points: 2 });
  if (jobTitle && DECIDER.test(jobTitle)) out.push({ key: "decider", label: "Perfil de decisão", quote: jobTitle, points: 1 });

  const opens = messages.filter((m) => m.sender !== "LEAD").reduce((n, m) => n + m.openCount, 0);
  if (opens >= 3) out.push({ key: "opens", label: `Abriu seu e-mail ${opens} vezes`, points: 2 });

  const last = messages.at(-1);
  if (last?.sender === "LEAD") out.push({ key: "waiting", label: "Escreveu por último e espera resposta", points: 2 });
  else if (last && fromLead.length > 0 && now.getTime() - fromLead.at(-1)!.at.getTime() < 48 * 3_600_000) out.push({ key: "recent", label: "Respondeu nas últimas 48 horas", points: 1 });

  if (status === "QUALIFIED") out.push({ key: "qualified", label: "Já marcada como oportunidade", points: 2 });
  if (status === "NEEDS_HUMAN") out.push({ key: "needs", label: "O assistente passou para você", points: 1 });
  return out.sort((a, b) => b.points - a.points);
}

export const hotScore = (signals: Signal[]) => signals.reduce((n, s) => n + s.points, 0);
