import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { clockTime, dayLabel, readableReason, relativeTime, shortDate, splitHeadline } from "@/lib/format";
import { STATUS_LABEL } from "@/lib/status";
import { ReplyForm } from "./ReplyForm";
import { ChannelProvider } from "./ChannelContext";
import { ChannelSwitcher } from "./ChannelSwitcher";
import { ThreadView, type ThreadMessage } from "./ThreadView";
import type { ChannelKey } from "@/components/ChannelBadge";
import { LeadTabs } from "./LeadTabs";
import { LeadTags } from "./LeadTags";
import { LeadCampaign } from "./LeadCampaign";
import { LeadNotes } from "./LeadNotes";
import { LeadProfile } from "./LeadProfile";
import { LeadActions } from "./LeadActions";
import { HandoffCard } from "./HandoffCard";
import { LeadFollowUp } from "./LeadFollowUp";
import { describeRule, followUpRuleFor } from "@/lib/followupPolicy";
import { DetailsToggle, LeadWorkspace } from "./LeadWorkspace";
import { ConversationList } from "@/components/ConversationList";
import { emailEnabled } from "@/lib/email";
import { deskcommConfigOf } from "@/lib/deskcomm";
import { getConversationItems } from "@/lib/conversations";

export const dynamic = "force-dynamic";

const WHEN_FORMAT = { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" } as const;

export default async function LeadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [lead, settings, campaigns, tagRows, conversations] = await Promise.all([
    prisma.lead.findUnique({
      where: { id },
      include: { messages: { orderBy: { deliveredAt: "asc" } }, campaign: { select: { name: true, followUpMaxCount: true, followUpDelayHours: true } } },
    }),
    prisma.settings.findUniqueOrThrow({ where: { id: "singleton" } }),
    prisma.campaign.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, createdAt: true } }),
    prisma.lead.findMany({ where: { tags: { isEmpty: false } }, select: { tags: true } }),
    getConversationItems(),
  ]);

  if (!lead) notFound();

  const fullName = `${lead.firstName ?? ""} ${lead.lastName ?? ""}`.trim() || "Contato";
  const firstName = lead.firstName ?? "essa pessoa";
  const { role, company } = splitHeadline(lead.jobTitle);
  const knownTags = [...new Set(tagRows.flatMap((r) => r.tags))].sort();
  const author = settings.ownerName?.trim() || "você";
  // Canais do compositor: LinkedIn se há perfil; e-mail e WhatsApp se estão conectados
  // e a ficha tem o contato. Começa no canal em que a pessoa escreveu por último.
  const replyChannels: ("LINKEDIN" | "EMAIL" | "WHATSAPP")[] = lead.linkedinProfileUrl ? ["LINKEDIN"] : [];
  if (lead.email && (await emailEnabled())) replyChannels.push("EMAIL");
  if (lead.phone && deskcommConfigOf(settings)) replyChannels.push("WHATSAPP");
  if (replyChannels.length === 0) replyChannels.push("LINKEDIN");
  const lastLeadChannel = lead.messages.findLast((m) => m.sender === "LEAD")?.channel ?? "LINKEDIN";

  // Histórico: linha do tempo montada com o que já está no banco.
  const firstOut = lead.messages.find((m) => m.sender !== "LEAD");
  const firstIn = lead.messages.find((m) => m.sender === "LEAD");
  const lastMsg = lead.messages.at(-1);
  const events = [
    { when: lead.createdAt, text: "Entrou na sua lista" },
    lead.invitedAt && { when: lead.invitedAt, text: "Convite enviado" },
    firstOut && { when: firstOut.deliveredAt, text: firstOut.sender === "AGENT" ? "O assistente abriu a conversa" : "Você abriu a conversa" },
    firstIn && { when: firstIn.deliveredAt, text: `${firstName} respondeu pela primeira vez` },
    lead.followUpsSent > 0 && lastMsg && { when: lastMsg.deliveredAt, text: `${lead.followUpsSent} mensagem${lead.followUpsSent > 1 ? "s" : ""} de acompanhamento sem resposta` },
    lead.status === "NEEDS_HUMAN" && { when: lead.updatedAt, text: `Passou para você: ${readableReason(lead.needsHumanReason ?? "precisa de resposta")}` },
    lead.status === "QUALIFIED" && { when: lead.updatedAt, text: "Marcado como oportunidade" },
    lead.archivedAt && { when: lead.archivedAt, text: "Conversa arquivada" },
  ]
    .filter((e): e is { when: Date; text: string } => Boolean(e))
    .sort((a, b) => b.when.getTime() - a.when.getTime());

  const statusLabel =
    lead.status === "MEETING_SCHEDULED" && lead.meetingAt
      ? `${STATUS_LABEL[lead.status]} · ${lead.meetingAt.toLocaleString("pt-BR", WHEN_FORMAT)}`
      : STATUS_LABEL[lead.status];

  // Regra de acompanhamento que vale agora pra esta conversa, e a que valeria sem personalizar.
  const rule = followUpRuleFor(lead, lead.campaign, settings);
  const inherited = followUpRuleFor({ followUpMaxCount: null, followUpDelayHours: null }, lead.campaign, settings);
  const inheritedLabel = `${describeRule(inherited.maxCount, inherited.delayHours)} (${inherited.source === "campaign" ? "da campanha" : "da conta"})`;

  // Mensagens com data e hora já formatadas (servidor), para a conversa trocar de canal sem divergir na hidratação.
  const threadMessages: ThreadMessage[] = lead.messages.map((m) => ({
    id: m.id,
    sender: m.sender,
    channel: m.channel,
    content: m.content,
    subject: m.subject,
    opened: m.channel === "EMAIL" && m.sender !== "LEAD" && m.openToken ? { count: m.openCount } : null,
    time: clockTime(m.deliveredAt),
    dayKey: m.deliveredAt.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }),
    dayText: `${dayLabel(m.deliveredAt)}${dayLabel(m.deliveredAt) === "Hoje" ? `, ${shortDate(m.deliveredAt)}` : ""}`,
  }));
  const ORDER: ChannelKey[] = ["LINKEDIN", "WHATSAPP", "EMAIL"];
  const counts: Record<ChannelKey, number> = { LINKEDIN: 0, WHATSAPP: 0, EMAIL: 0 };
  for (const m of lead.messages) counts[m.channel] += 1;
  // O seletor mostra os canais com mensagens e os canais por onde dá para enviar.
  const available = ORDER.filter((c) => counts[c] > 0 || replyChannels.includes(c));
  const lastChannel = lead.messages.at(-1)?.channel ?? lastLeadChannel;

  const conversation = (
    <>
      {lead.messages.length === 0 && (
        <p className="empty" style={{ textAlign: "center" }}>
          {lead.status === "INVITE_SENT" ? "Nenhuma mensagem ainda. Quando o convite for aceito, o assistente abre a conversa." : "Conexão aceita. O assistente manda a primeira mensagem na próxima rodada."}
        </p>
      )}
      <ThreadView messages={threadMessages} leadFirst={lead.firstName} leadLast={lead.lastName} ownerName={author === "você" ? "Você" : author}>
        {lead.status === "NEEDS_HUMAN" && (
          <HandoffCard leadId={lead.id} firstName={firstName} reason={readableReason(lead.needsHumanReason ?? "A conversa precisa de você")} when={relativeTime(lead.updatedAt)} />
        )}
      </ThreadView>
    </>
  );

  const about = (
    <div className="stack" style={{ gap: 28 }}>
      <section className="sec">
        <p className="status-text">{statusLabel}</p>
        <LeadActions leadId={lead.id} status={lead.status} profileUrl={lead.linkedinProfileUrl} />
      </section>

      <LeadProfile leadId={lead.id} firstName={firstName} email={lead.email} phone={lead.phone} personal={lead.personal} />
      <LeadNotes leadId={lead.id} notes={lead.notes ?? ""} author={author} />
      <LeadTags leadId={lead.id} tags={lead.tags} knownTags={knownTags} />
      <LeadCampaign
        leadId={lead.id}
        campaignId={lead.campaignId}
        campaigns={campaigns.map((c) => ({ id: c.id, name: c.name, since: shortDate(c.createdAt) }))}
      />
      <LeadFollowUp
        leadId={lead.id}
        sent={lead.followUpsSent}
        inheritedLabel={inheritedLabel}
        custom={rule.source === "lead" ? { count: rule.maxCount, days: Math.max(1, Math.round(rule.delayHours / 24)) } : null}
      />

      <section className="sec">
        <h2 className="t-label">Sobre</h2>
        <dl className="kv">
          {lead.jobTitle && (
            <>
              <dt>Cargo</dt>
              <dd>{lead.jobTitle}</dd>
            </>
          )}
          {lead.meetingLink && (
            <>
              <dt>Reunião</dt>
              <dd>
                <a href={lead.meetingLink} target="_blank" rel="noreferrer" className="btn-text">
                  Abrir videochamada
                </a>
              </dd>
            </>
          )}
          {lead.nextStep && (
            <>
              <dt>Próximo passo</dt>
              <dd>
                {lead.nextStep}
                {lead.nextStepAt && <span className="faint"> · volta a olhar em {lead.nextStepAt.toLocaleString("pt-BR", WHEN_FORMAT)}</span>}
              </dd>
            </>
          )}
          <dt>Na lista desde</dt>
          <dd>{shortDate(lead.createdAt)}</dd>
        </dl>
        {lead.linkedinProfileUrl && (
          <a href={lead.linkedinProfileUrl} target="_blank" rel="noreferrer" className="btn-text">
            Ver perfil no LinkedIn
          </a>
        )}
      </section>

      <details className="h-fold">
        <summary>Histórico</summary>
        <ol className="h-log">
          {events.map((e, i) => (
            <li key={i}>
              <time>{shortDate(e.when)}</time>
              <span>{e.text}</span>
            </li>
          ))}
        </ol>
      </details>
    </div>
  );

  return (
    <div className="conv-layout">
      <aside className="conv-col only-desktop" aria-label="Lista de conversas">
        <ConversationList items={conversations} activeId={lead.id} />
      </aside>

      <LeadWorkspace>
        <ChannelProvider available={available} reply={replyChannels} initial={lastChannel}>
        <div className="chat">
          <header className="chat-head">
            <Link href="/" className="btn-text only-mobile" aria-label="Voltar para Conversas">
              ← Voltar
            </Link>
            <div className="grow">
              <h1 className="truncate">{fullName}</h1>
              {lead.jobTitle && <p className="truncate">{company ? `${role} · ${company}` : lead.jobTitle}</p>}
            </div>
            <DetailsToggle />
          </header>

          <ChannelSwitcher counts={counts} />

          <LeadTabs
            chat={conversation}
            about={about}
            composer={
              <ReplyForm key="composer" leadId={lead.id} firstName={firstName} />
            }
          />
        </div>
        </ChannelProvider>

        <aside className="details only-desktop" aria-label="Detalhes">
          {about}
        </aside>
      </LeadWorkspace>
    </div>
  );
}
