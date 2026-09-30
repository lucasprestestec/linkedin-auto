import type { MessageChannel } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { startOfLocalDay } from "@/lib/schedule";
import { readableReason } from "@/lib/format";

// O que a secretária fez (e o que aconteceu) desde `since` — base do painel
// "Hoje" da Início e do resumo do fim do dia. Tudo derivado do que já está no
// banco: mensagens, convites, aberturas de e-mail e status dos leads.

export type TimelineKind = "invite" | "accepted" | "sent" | "reply" | "open" | "handoff" | "qualified";

export interface TimelineItem {
  at: Date;
  kind: TimelineKind;
  leadId: string;
  name: string;
  text: string;
}

export interface DailyReport {
  since: Date;
  invites: number;
  accepted: number;
  sent: Record<MessageChannel, number>;
  sentByYou: number;
  replies: { leadId: string; name: string; channel: MessageChannel }[];
  opens: { leadId: string; name: string; count: number }[];
  qualified: { leadId: string; name: string }[];
  needYou: { leadId: string; name: string; reason: string }[];
  timeline: TimelineItem[];
}

const CHANNEL: Record<MessageChannel, string> = { LINKEDIN: "LinkedIn", EMAIL: "e-mail", WHATSAPP: "WhatsApp" };

function nameOf(l: { firstName: string | null; lastName: string | null }) {
  return [l.firstName, l.lastName].filter(Boolean).join(" ") || "Lead";
}

export async function dailyReport(since = startOfLocalDay()): Promise<DailyReport> {
  const leadSelect = { id: true, firstName: true, lastName: true } as const;
  const [invited, accepted, messages, opened, qualified, needYou] = await Promise.all([
    prisma.lead.findMany({ where: { invitedAt: { gte: since } }, select: { ...leadSelect, invitedAt: true } }),
    prisma.lead.findMany({ where: { connectedAt: { gte: since } }, select: { ...leadSelect, connectedAt: true } }),
    prisma.message.findMany({
      where: { createdAt: { gte: since } },
      orderBy: { createdAt: "asc" },
      select: { sender: true, channel: true, createdAt: true, lead: { select: leadSelect } },
    }),
    prisma.message.findMany({
      where: { lastOpenedAt: { gte: since }, sender: { not: "LEAD" } },
      select: { openCount: true, lastOpenedAt: true, lead: { select: leadSelect } },
    }),
    prisma.lead.findMany({ where: { status: "QUALIFIED", updatedAt: { gte: since } }, select: { ...leadSelect, updatedAt: true } }),
    prisma.lead.findMany({
      where: { status: "NEEDS_HUMAN" },
      orderBy: { updatedAt: "desc" },
      select: { ...leadSelect, needsHumanReason: true, updatedAt: true },
    }),
  ]);

  const sent: Record<MessageChannel, number> = { LINKEDIN: 0, EMAIL: 0, WHATSAPP: 0 };
  let sentByYou = 0;
  const replies = new Map<string, { leadId: string; name: string; channel: MessageChannel }>();
  const timeline: TimelineItem[] = [];

  for (const m of messages) {
    const name = nameOf(m.lead);
    if (m.sender === "LEAD") {
      replies.set(m.lead.id, { leadId: m.lead.id, name, channel: m.channel });
      timeline.push({ at: m.createdAt, kind: "reply", leadId: m.lead.id, name, text: `respondeu pelo ${CHANNEL[m.channel]}` });
    } else if (m.sender === "AGENT") {
      sent[m.channel]++;
      timeline.push({ at: m.createdAt, kind: "sent", leadId: m.lead.id, name, text: `o assistente escreveu pelo ${CHANNEL[m.channel]}` });
    } else {
      sentByYou++;
    }
  }

  // Aberturas: uma linha por pessoa, somando os e-mails abertos hoje.
  const opens = new Map<string, { leadId: string; name: string; count: number; at: Date }>();
  for (const o of opened) {
    const cur = opens.get(o.lead.id);
    const at = o.lastOpenedAt!;
    opens.set(o.lead.id, { leadId: o.lead.id, name: nameOf(o.lead), count: (cur?.count ?? 0) + o.openCount, at: cur && cur.at > at ? cur.at : at });
  }
  for (const o of opens.values()) timeline.push({ at: o.at, kind: "open", leadId: o.leadId, name: o.name, text: "abriu o seu e-mail" });

  // Convites: vários no mesmo dia viram uma linha só na linha do tempo.
  if (invited.length) {
    const last = invited.reduce((a, b) => (a.invitedAt! > b.invitedAt! ? a : b));
    timeline.push({
      at: last.invitedAt!,
      kind: "invite",
      leadId: last.id,
      name: invited.length === 1 ? nameOf(last) : `${invited.length} pessoas`,
      text: invited.length === 1 ? "recebeu um convite no LinkedIn" : "receberam convite no LinkedIn",
    });
  }
  for (const a of accepted) timeline.push({ at: a.connectedAt!, kind: "accepted", leadId: a.id, name: nameOf(a), text: "aceitou o convite" });
  for (const q of qualified) timeline.push({ at: q.updatedAt, kind: "qualified", leadId: q.id, name: nameOf(q), text: "virou oportunidade" });
  for (const h of needYou.filter((l) => l.updatedAt >= since)) {
    timeline.push({ at: h.updatedAt, kind: "handoff", leadId: h.id, name: nameOf(h), text: `precisa de você: ${readableReason(h.needsHumanReason ?? "responder")}` });
  }
  timeline.sort((a, b) => b.at.getTime() - a.at.getTime());

  return {
    since,
    invites: invited.length,
    accepted: accepted.length,
    sent,
    sentByYou,
    replies: [...replies.values()],
    opens: [...opens.values()].map(({ leadId, name, count }) => ({ leadId, name, count })),
    qualified: qualified.map((q) => ({ leadId: q.id, name: nameOf(q) })),
    needYou: needYou.map((l) => ({ leadId: l.id, name: nameOf(l), reason: readableReason(l.needsHumanReason ?? "Precisa da sua resposta") })),
    timeline,
  };
}

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

function names(list: { name: string }[], max = 3) {
  const n = list.map((x) => x.name.split(" ")[0]);
  if (n.length <= max) return n.length > 1 ? `${n.slice(0, -1).join(", ")} e ${n.at(-1)}` : n.join("");
  return `${n.slice(0, max).join(", ")} e mais ${n.length - max}`;
}

// Uma linha curta pro push ("5 convites · 3 mensagens · 2 responderam").
export function reportHeadline(r: DailyReport): string {
  const parts = [
    r.invites && plural(r.invites, "convite", "convites"),
    r.sent.LINKEDIN + r.sent.EMAIL + r.sent.WHATSAPP && plural(r.sent.LINKEDIN + r.sent.EMAIL + r.sent.WHATSAPP, "mensagem", "mensagens"),
    r.replies.length && plural(r.replies.length, "resposta", "respostas"),
    r.opens.length && plural(r.opens.length, "e-mail aberto", "e-mails abertos"),
    r.needYou.length && `${r.needYou.length} precisa${r.needYou.length === 1 ? "" : "m"} de você`,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : "Dia tranquilo, sem novidades.";
}

// Texto do e-mail de resumo (vai pra caixa do próprio corretor).
export function reportText(r: DailyReport, ownerFirstName: string | null, appUrl: string | null): string {
  const lines: string[] = [`Oi${ownerFirstName ? `, ${ownerFirstName}` : ""}! Aqui vai o resumo do dia do seu assistente.`, ""];
  lines.push(`• Convites enviados no LinkedIn: ${r.invites}`);
  if (r.accepted) lines.push(`• Aceitaram o convite: ${r.accepted}`);
  lines.push(`• Mensagens do assistente: ${r.sent.LINKEDIN} no LinkedIn, ${r.sent.EMAIL} por e-mail, ${r.sent.WHATSAPP} no WhatsApp`);
  if (r.replies.length) lines.push(`• Responderam: ${names(r.replies, 6)}`);
  if (r.opens.length) lines.push(`• Abriram seu e-mail: ${names(r.opens, 6)}`);
  if (r.qualified.length) lines.push(`• Viraram oportunidade: ${names(r.qualified, 6)}`);
  lines.push("");
  if (r.needYou.length) {
    lines.push(`Precisam de você (${r.needYou.length}):`);
    for (const n of r.needYou.slice(0, 8)) lines.push(`  - ${n.name}: ${n.reason}`);
    if (r.needYou.length > 8) lines.push(`  - e mais ${r.needYou.length - 8}`);
  } else {
    lines.push("Ninguém esperando resposta sua. 👌");
  }
  if (appUrl) lines.push("", `Abrir o painel: ${appUrl}`);
  return lines.join("\n");
}
