import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { clockTime, dayLabel, relativeTime, sameDay, shortDate } from "@/lib/format";
import { STATUS_LABEL, STATUS_TONE } from "@/lib/status";
import { Avatar } from "@/components/Avatar";
import { IconArrowLeft, IconCheckCheck, IconHand, IconLinkedin, IconSparkles, IconUser } from "@/components/Icons";
import { ReplyForm } from "./ReplyForm";

export const dynamic = "force-dynamic";

export default async function LeadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [lead, settings] = await Promise.all([
    prisma.lead.findUnique({
      where: { id },
      include: { messages: { orderBy: { deliveredAt: "asc" } } },
    }),
    prisma.settings.findUniqueOrThrow({ where: { id: "singleton" } }),
  ]);

  if (!lead) notFound();

  const tone = STATUS_TONE[lead.status];
  const fullName = `${lead.firstName ?? ""} ${lead.lastName ?? ""}`.trim() || "Lead";

  return (
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

      <div className="chat-intro rise">
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
        </div>
      </div>

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
  );
}
