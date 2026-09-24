import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { clockTime, dayLabel, relativeTime, sameDay, shortDate } from "@/lib/format";
import { STATUS_LABEL, STATUS_TONE } from "@/lib/status";
import { Avatar } from "@/components/Avatar";
import { IconArrowLeft, IconCheckCheck, IconChevronRight, IconHand, IconLinkedin, IconSparkles, IconUser } from "@/components/Icons";
import { ReplyForm } from "./ReplyForm";
import { LeadCrm } from "./LeadCrm";

export const dynamic = "force-dynamic";

export default async function LeadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [lead, settings, campaigns, tagRows] = await Promise.all([
    prisma.lead.findUnique({
      where: { id },
      include: { messages: { orderBy: { deliveredAt: "asc" } }, campaign: { select: { name: true } } },
    }),
    prisma.settings.findUniqueOrThrow({ where: { id: "singleton" } }),
    prisma.campaign.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.lead.findMany({ where: { tags: { isEmpty: false } }, select: { tags: true } }),
  ]);

  if (!lead) notFound();

  const tone = STATUS_TONE[lead.status];
  const fullName = `${lead.firstName ?? ""} ${lead.lastName ?? ""}`.trim() || "Lead";
  const knownTags = [...new Set(tagRows.flatMap((r) => r.tags))].sort();
  const crm = (
    <LeadCrm
      leadId={lead.id}
      notes={lead.notes ?? ""}
      tags={lead.tags}
      knownTags={knownTags}
      campaignId={lead.campaignId}
      campaigns={campaigns}
    />
  );
  const facts = (
    <dl className="facts">
      <div>
        <dt>Status</dt>
        <dd>
          <span className={`badge badge-${tone}`}>{STATUS_LABEL[lead.status]}</span>
        </dd>
      </div>
      {lead.icpScore != null && (
        <div>
          <dt>Encaixe com o cliente ideal</dt>
          <dd>{lead.icpScore}%</dd>
        </div>
      )}
      <div>
        <dt>Campanha</dt>
        <dd>{lead.campaign?.name ?? "Instruções gerais"}</dd>
      </div>
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

  return (
    <div className="chat-layout">
    <div className="chat-page">
      <header className="chat-header">
        <Link href="/" className="icon-btn icon-btn-round" aria-label="Voltar" style={{ border: "none", background: "transparent", boxShadow: "none" }}>
          <IconArrowLeft size={24} />
        </Link>
        <Avatar firstName={lead.firstName} lastName={lead.lastName} size={40} status={tone} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="lead-name" style={{ fontSize: 16 }}>
            {fullName}
          </div>
          <div className="tiny faint" style={{ fontWeight: 600 }}>
            {STATUS_LABEL[lead.status]}
          </div>
        </div>
        <a
          href={lead.linkedinProfileUrl}
          target="_blank"
          rel="noreferrer"
          aria-label="Ver perfil no LinkedIn"
          className="icon-btn icon-btn-round"
          style={{ color: "#0a66c2" }}
        >
          <IconLinkedin size={18} />
        </a>
      </header>

      <div className="chat-intro only-mobile rise">
        <Avatar firstName={lead.firstName} lastName={lead.lastName} size={76} />
        <h1 className="title-lg" style={{ marginTop: 8 }}>
          {fullName}
        </h1>
        {lead.jobTitle && (
          <p className="small muted" style={{ maxWidth: 300 }}>
            {lead.jobTitle}
          </p>
        )}
        <div className="row" style={{ gap: 6, marginTop: 6, flexWrap: "wrap", justifyContent: "center" }}>
          <span className={`badge badge-${tone}`}>{STATUS_LABEL[lead.status]}</span>
          {lead.followUpsSent > 0 && (lead.status === "WAITING_REPLY" || lead.status === "CONVERSATION_OPEN") && (
            <span className="badge badge-waiting badge-plain">
              Follow-up {lead.followUpsSent}/{settings.followUpMaxCount}
            </span>
          )}
          <span className="badge badge-plain">Lead desde {shortDate(lead.createdAt)}</span>
          {lead.tags.map((t) => (
            <span key={t} className="badge badge-waiting badge-plain">
              {t}
            </span>
          ))}
        </div>
      </div>

      {/* No celular o CRM fica aqui, recolhido; no computador, no painel lateral. */}
      <details className="card notice only-mobile" style={{ marginBottom: 8 }}>
        <summary className="notice-summary">
          <span style={{ flex: 1, fontWeight: 700 }}>Anotações, etiquetas e campanha</span>
          {lead.notes && <span className="badge badge-plain">com anotação</span>}
          <IconChevronRight size={18} className="chev notice-chev" />
        </summary>
        <div style={{ padding: "4px 18px 18px" }}>{crm}</div>
      </details>

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
              {showDay && <div className="day-sep">{dayLabel(message.deliveredAt)}</div>}
              <div className={`msg ${kind}`}>
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
                  {!fromLead && <IconCheckCheck size={13} style={{ color: "var(--brand)" }} />}
                </div>
              </div>
            </div>
          );
        })}

        {lead.status === "NEEDS_HUMAN" && (
          <div className="handoff rise">
            <span className="alert-icon">
              <IconHand size={20} />
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="row" style={{ gap: 8, justifyContent: "space-between" }}>
                <strong style={{ fontSize: 14 }}>A IA passou a conversa pra você</strong>
                <span className="tiny faint" style={{ flexShrink: 0 }}>
                  {relativeTime(lead.updatedAt)}
                </span>
              </div>
              <p className="small" style={{ color: "var(--urgent-ink)", fontWeight: 600, marginTop: 3 }}>
                {lead.needsHumanReason ?? "Precisa de resposta"}
              </p>
            </div>
          </div>
        )}
      </div>

      <ReplyForm leadId={lead.id} />
    </div>

      <aside className="lead-aside" aria-label="Detalhes do lead">
        <div className="card card-pad stack" style={{ alignItems: "center", textAlign: "center", gap: 6 }}>
          <Avatar firstName={lead.firstName} lastName={lead.lastName} size={64} />
          <h2 className="title-md" style={{ marginTop: 6 }}>
            {fullName}
          </h2>
          {lead.jobTitle && <p className="small muted">{lead.jobTitle}</p>}
          <a href={lead.linkedinProfileUrl} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm" style={{ marginTop: 8 }}>
            <IconLinkedin size={15} style={{ color: "#0a66c2" }} /> Ver no LinkedIn
          </a>
        </div>
        <div className="card card-pad">{facts}</div>
        <div className="card card-pad">{crm}</div>
      </aside>
    </div>
  );
}
