import Link from "next/link";
import { notFound } from "next/navigation";
import type { LeadStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { clockTime, dayLabel, readableReason, relativeTime, sameDay, shortDate, splitHeadline } from "@/lib/format";
import { STATUS_LABEL, STATUS_TONE } from "@/lib/status";
import { EMPTY_SEARCH, buildLinkedinSearchUrl } from "@/lib/linkedin";
import { Avatar } from "@/components/Avatar";
import {
  IconArrowLeft,
  IconBuilding,
  IconChat,
  IconCheckCheck,
  IconFlame,
  IconLinkedin,
  IconMail,
  IconSearch,
  IconSparkles,
  IconUser,
} from "@/components/Icons";
import { ReplyForm } from "./ReplyForm";
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

// Etapas mostradas no "Status do lead". NEEDS_HUMAN é uma conversa em andamento;
// LOST aparece à parte.
const STAGES: { label: string; statuses: LeadStatus[] }[] = [
  { label: "Convite", statuses: ["INVITE_SENT"] },
  { label: "Conectado", statuses: ["WAITING_REPLY"] },
  { label: "Em conversa", statuses: ["CONVERSATION_OPEN", "NEEDS_HUMAN"] },
  { label: "Qualificado", statuses: ["QUALIFIED"] },
];

function StatusStepper({ status }: { status: LeadStatus }) {
  const current = STAGES.findIndex((s) => s.statuses.includes(status));
  return (
    <section className="side-card">
      <div className="side-card-head">
        <h3>Status do lead</h3>
        {status === "LOST" && <span className="status-pill pill-lost" style={{ height: 28 }}>Sem resposta</span>}
      </div>
      <ol className="lead-stepper" aria-label="Etapas do lead">
        {STAGES.map((s, i) => (
          <li key={s.label} className={i < current ? "done" : i === current ? "current" : undefined} aria-current={i === current ? "step" : undefined}>
            <span className="stepper-dot" />
            <span className="stepper-label">{s.label}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

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

  const tone = STATUS_TONE[lead.status];
  const fullName = `${lead.firstName ?? ""} ${lead.lastName ?? ""}`.trim() || "Lead";
  const firstName = lead.firstName ?? "o lead";
  const { role, company } = splitHeadline(lead.jobTitle);
  const knownTags = [...new Set(tagRows.flatMap((r) => r.tags))].sort();
  const author = settings.ownerName?.trim() || "você";
  const highIntent = lead.icpScore != null && lead.icpScore >= 70;
  // Canais do composer: LinkedIn sempre; e-mail se a caixa está configurada e a
  // ficha tem e-mail. Começa no canal em que a pessoa escreveu por último.
  const replyChannels: ("LINKEDIN" | "EMAIL" | "WHATSAPP")[] = lead.linkedinProfileUrl ? ["LINKEDIN"] : [];
  if (lead.email && (await emailEnabled())) replyChannels.push("EMAIL");
  if (lead.phone && deskcommConfigOf(settings)) replyChannels.push("WHATSAPP");
  // Sem nenhum canal (contato sem LinkedIn e sem e-mail/WhatsApp conectados): o
  // envio explica o que falta.
  if (replyChannels.length === 0) replyChannels.push("LINKEDIN");
  const lastLeadChannel = lead.messages.findLast((m) => m.sender === "LEAD")?.channel ?? "LINKEDIN";

  // ---- Atividades: linha do tempo montada com o que já está no banco ----
  const firstOut = lead.messages.find((m) => m.sender !== "LEAD");
  const firstIn = lead.messages.find((m) => m.sender === "LEAD");
  const lastMsg = lead.messages.at(-1);
  const events = [
    { when: lead.createdAt, text: "Entrou na sua lista de leads" },
    lead.invitedAt && { when: lead.invitedAt, text: "Convite de conexão enviado" },
    firstOut && { when: firstOut.deliveredAt, text: firstOut.sender === "AGENT" ? "A IA abriu a conversa" : "Você abriu a conversa" },
    firstIn && { when: firstIn.deliveredAt, text: `${firstName} respondeu pela primeira vez` },
    lead.followUpsSent > 0 && lastMsg && { when: lastMsg.deliveredAt, text: `${lead.followUpsSent} follow-up${lead.followUpsSent > 1 ? "s" : ""} sem resposta` },
    lead.status === "NEEDS_HUMAN" && { when: lead.updatedAt, text: `A IA passou pra você: ${readableReason(lead.needsHumanReason ?? "precisa de resposta")}` },
    lead.status === "QUALIFIED" && { when: lead.updatedAt, text: "Marcado como qualificado" },
    lead.archivedAt && { when: lead.archivedAt, text: "Conversa arquivada no LinkedIn" },
  ]
    .filter((e): e is { when: Date; text: string } => Boolean(e))
    .sort((a, b) => b.when.getTime() - a.when.getTime());

  // "Reunião marcada · 02/10 15:30" quando a data é conhecida.
  const statusLabel =
    lead.status === "MEETING_SCHEDULED" && lead.meetingAt
      ? `${STATUS_LABEL[lead.status]} · ${lead.meetingAt.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })}`
      : STATUS_LABEL[lead.status];

  const profileBadges = (
    <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
      <span className={`soft-badge pill-${tone}`}>
        <i className="dot" /> {lead.status === "QUALIFIED" ? "Lead qualificado" : statusLabel}
      </span>
      {highIntent ? (
        <span className="soft-badge pill-urgent">
          <IconFlame size={14} /> Alta intenção · {lead.icpScore}%
        </span>
      ) : (
        lead.icpScore != null && <span className="soft-badge pill-lost">{lead.icpScore}% de encaixe</span>
      )}
    </div>
  );

  const companyRow = company && (
    <div className="company-row">
      <span className="company-row-icon">
        <IconBuilding size={22} />
      </span>
      <span className="stack" style={{ minWidth: 0 }}>
        <b className="truncate">{company}</b>
        <span className="tiny faint truncate">{role}</span>
      </span>
    </div>
  );

  // Regra que vale agora pra esta conversa, e a que valeria sem personalizar.
  const rule = followUpRuleFor(lead, lead.campaign, settings);
  const inherited = followUpRuleFor({ followUpMaxCount: null, followUpDelayHours: null }, lead.campaign, settings);
  const inheritedLabel = `${describeRule(inherited.maxCount, inherited.delayHours)} (${inherited.source === "campaign" ? "da campanha" : "da conta"})`;

  const sideCards = (
    <>
      <StatusStepper status={lead.status} />
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
        custom={
          rule.source === "lead" ? { count: rule.maxCount, days: Math.max(1, Math.round(rule.delayHours / 24)) } : null
        }
      />
    </>
  );

  const conversation = (
    <div className="thread">
      {lead.messages.length === 0 && (
        <p className="small faint" style={{ textAlign: "center", padding: "24px 0" }}>
          {lead.status === "INVITE_SENT"
            ? "Nenhuma mensagem ainda. Assim que o convite for aceito, a IA abre a conversa."
            : "Conexão aceita. A IA vai mandar a mensagem de abertura na próxima rodada."}
        </p>
      )}

      {lead.messages.map((message, i) => {
        const prev = lead.messages[i - 1];
        const showDay = !prev || !sameDay(prev.deliveredAt, message.deliveredAt);
        const fromLead = message.sender === "LEAD";
        const kind = fromLead ? "msg-in" : message.sender === "AGENT" ? "msg-out msg-agent" : "msg-out msg-human";
        return (
          <div key={message.id} style={{ display: "contents" }}>
            {showDay && (
              <div className="day-sep">
                {dayLabel(message.deliveredAt)}
                {dayLabel(message.deliveredAt) === "Hoje" ? `, ${shortDate(message.deliveredAt)}` : ""}
              </div>
            )}
            <div className={`msg ${kind}`}>
              {fromLead && (
                <span className="msg-avatar">
                  <Avatar firstName={lead.firstName} lastName={lead.lastName} size={44} />
                </span>
              )}
              <div className="msg-body">
                {message.channel === "WHATSAPP" && (
                  <div className="msg-channel">
                    <IconChat size={12} /> WhatsApp
                  </div>
                )}
                {message.channel === "EMAIL" && (
                  <div className="msg-channel">
                    <IconMail size={12} /> E-mail{message.subject ? ` · ${message.subject}` : ""}
                    {!fromLead && message.openToken && (
                      <span className={message.openCount > 0 ? "open-badge opened" : "open-badge"}>
                        {message.openCount > 0
                          ? `Aberto${message.openCount > 1 ? ` ${message.openCount}x` : ""} · ${dayLabel(message.lastOpenedAt!)} ${clockTime(message.lastOpenedAt!)}`
                          : "Não aberto"}
                      </span>
                    )}
                  </div>
                )}
                <div className="bubble">{message.content}</div>
                <div className="msg-meta">
                  {message.sender === "AGENT" && (
                    <>
                      <IconSparkles size={12} /> IA ·
                    </>
                  )}
                  {message.sender === "HUMAN" && (
                    <>
                      <IconUser size={12} /> Você ·
                    </>
                  )}
                  {clockTime(message.deliveredAt)}
                  {!fromLead && <IconCheckCheck size={15} style={{ color: "var(--brand)" }} />}
                </div>
              </div>
            </div>
          </div>
        );
      })}

      {lead.status === "NEEDS_HUMAN" && (
        <HandoffCard leadId={lead.id} firstName={firstName} reason={readableReason(lead.needsHumanReason ?? "A conversa precisa de você")} when={relativeTime(lead.updatedAt)} />
      )}
      <div id="thread-end" />
    </div>
  );

  const facts = (
    <dl className="facts">
      <div>
        <dt>Cargo</dt>
        <dd>{lead.jobTitle ?? "—"}</dd>
      </div>
      <div>
        <dt>Status</dt>
        <dd>
          <span className={`status-pill pill-${tone}`} style={{ height: 28 }}>
            {statusLabel}
          </span>
        </dd>
      </div>
      {lead.nextStep && (
        <div>
          <dt>Próximo passo (secretária)</dt>
          <dd className="next-step">
            <IconSparkles size={14} /> {lead.nextStep}
            {lead.nextStepAt && (
              <span className="tiny faint">
                {" "}
                · volta a olhar em{" "}
                {lead.nextStepAt.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })}
              </span>
            )}
          </dd>
        </div>
      )}
      {lead.icpScore != null && (
        <div>
          <dt>Encaixe com o cliente ideal</dt>
          <dd>{lead.icpScore}%</dd>
        </div>
      )}
      <div>
        <dt>Campanha</dt>
        <dd>{lead.campaign?.name ?? "Sem campanha"}</dd>
      </div>
      {lead.followUpsSent > 0 && (
        <div>
          <dt>Follow-ups</dt>
          <dd>
            {lead.followUpsSent}/{rule.maxCount}
          </dd>
        </div>
      )}
      <div>
        <dt>Lead desde</dt>
        <dd>{shortDate(lead.createdAt)}</dd>
      </div>
      <div>
        <dt>Mensagens</dt>
        <dd>{lead.messages.length}</dd>
      </div>
    </dl>
  );

  // Tudo o que não é a conversa, num card só: dados, empresa e histórico.
  const moreInfo = (
    <section className="side-card">
      <div className="side-card-head">
        <h3>Mais sobre {firstName}</h3>
      </div>
      {facts}
      <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
        {lead.linkedinProfileUrl && (
          <a href={lead.linkedinProfileUrl} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm">
            <IconLinkedin size={15} style={{ color: "#0a66c2" }} /> Perfil no LinkedIn
          </a>
        )}
        {company && (
          <a
            href={buildLinkedinSearchUrl({ ...EMPTY_SEARCH, companies: [company] })}
            target="_blank"
            rel="noreferrer"
            className="btn btn-secondary btn-sm"
          >
            <IconSearch size={15} /> Outras pessoas da {company}
          </a>
        )}
      </div>
      <details className="history">
        <summary>Histórico</summary>
        <ol className="timeline">
          {events.map((e, i) => (
            <li key={i}>
              <span className="timeline-dot" />
              <div className="stack" style={{ gap: 2 }}>
                <span className="small" style={{ fontWeight: 600 }}>
                  {e.text}
                </span>
                <span className="tiny faint">
                  {shortDate(e.when)} · {clockTime(e.when)}
                </span>
              </div>
            </li>
          ))}
        </ol>
      </details>
    </section>
  );

  const aboutTab = (
    <div className="stack tab-pad" style={{ gap: 14 }}>
      {profileBadges}
      {companyRow}
      <LeadActions leadId={lead.id} status={lead.status} profileUrl={lead.linkedinProfileUrl} />
      {sideCards}
      <LeadProfile leadId={lead.id} firstName={firstName} email={lead.email} phone={lead.phone} personal={lead.personal} variant="tab" />
      <LeadNotes leadId={lead.id} notes={lead.notes ?? ""} author={author} />
      {moreInfo}
    </div>
  );

  return (
    <div className="conv-layout lead-view">
      <aside className="conv-col only-desktop" aria-label="Lista de conversas">
        <ConversationList items={conversations} activeId={lead.id} pane />
      </aside>

      <LeadWorkspace>
        <div className="chat-card">
          <header className="chat-head">
            <Link href="/conversations" className="chat-back only-mobile" aria-label="Voltar para Conversas">
              <IconArrowLeft size={22} />
            </Link>
            <Avatar firstName={lead.firstName} lastName={lead.lastName} size={44} status={tone} />
            <div className="chat-head-main">
              <h1 className="chat-name">{fullName}</h1>
              {lead.jobTitle && <p className="chat-role">{company ? `${role} · ${company}` : lead.jobTitle}</p>}
            </div>
            <DetailsToggle />
            {lead.linkedinProfileUrl && (
              <a href={lead.linkedinProfileUrl} target="_blank" rel="noreferrer" className="chat-more" aria-label="Ver no LinkedIn" title="Ver no LinkedIn">
                <IconLinkedin size={19} />
              </a>
            )}
          </header>

          <LeadTabs
            chat={conversation}
            about={aboutTab}
            composer={<ReplyForm
                key="composer"
                leadId={lead.id}
                firstName={firstName}
                profileUrl={lead.linkedinProfileUrl}
                channels={replyChannels}
                defaultChannel={lastLeadChannel}
              />}
          />
        </div>

        <aside className="lead-side" aria-label="Detalhes do lead">
          <section className="side-card">
            {profileBadges}
            {companyRow}
            <LeadActions leadId={lead.id} status={lead.status} profileUrl={lead.linkedinProfileUrl} />
          </section>
          {sideCards}
          <LeadProfile leadId={lead.id} firstName={firstName} email={lead.email} phone={lead.phone} personal={lead.personal} />
          <LeadNotes leadId={lead.id} notes={lead.notes ?? ""} author={author} />
          {moreInfo}
        </aside>
      </LeadWorkspace>
    </div>
  );
}
