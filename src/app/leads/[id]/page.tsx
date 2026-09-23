import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { relativeTime } from "@/lib/format";
import { Avatar } from "@/components/Avatar";
import { ReplyForm } from "./ReplyForm";

export const dynamic = "force-dynamic";

export default async function LeadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lead = await prisma.lead.findUnique({
    where: { id },
    include: { messages: { orderBy: { deliveredAt: "asc" } } },
  });

  if (!lead) notFound();

  const needsHuman = lead.status === "NEEDS_HUMAN";

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "calc(100dvh - 57px)" }}>
      <header
        style={{
          position: "sticky",
          top: 0,
          background: "var(--bg)",
          borderBottom: "1px solid var(--border)",
          padding: "12px 16px",
          display: "flex",
          alignItems: "center",
          gap: 12,
          zIndex: 10,
        }}
      >
        <Link href="/" style={{ color: "var(--text-muted)", fontSize: 20, textDecoration: "none", lineHeight: 1 }} aria-label="Voltar">
          ←
        </Link>
        <Avatar firstName={lead.firstName} lastName={lead.lastName} size={36} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>
            {lead.firstName} {lead.lastName}
          </div>
          {lead.jobTitle && (
            <div style={{ fontSize: 12, color: "var(--text-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {lead.jobTitle}
            </div>
          )}
        </div>
        <a
          href={lead.linkedinProfileUrl}
          target="_blank"
          rel="noreferrer"
          aria-label="Ver perfil no LinkedIn"
          style={{ color: "var(--text-faint)", fontSize: 18, flexShrink: 0 }}
        >
          ↗
        </a>
      </header>

      {needsHuman && (
        <div
          style={{
            margin: "12px 16px 0",
            padding: "10px 12px",
            borderRadius: 8,
            background: "var(--accent-urgent-bg)",
            color: "var(--accent-urgent)",
            fontSize: 13,
            display: "flex",
            justifyContent: "space-between",
            gap: 8,
          }}
        >
          <span>{lead.needsHumanReason ?? "Precisa de resposta"}</span>
          <span style={{ flexShrink: 0, opacity: 0.8 }}>{relativeTime(lead.updatedAt)}</span>
        </div>
      )}

      <div style={{ flex: 1, padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
        {lead.messages.map((message) => {
          const fromLead = message.sender === "LEAD";
          return (
            <div
              key={message.id}
              style={{
                alignSelf: fromLead ? "flex-start" : "flex-end",
                maxWidth: "80%",
                padding: "10px 13px",
                borderRadius: 12,
                background: fromLead ? "var(--surface)" : "var(--primary)",
                color: fromLead ? "var(--text)" : "#fff",
                border: fromLead ? "1px solid var(--border)" : "none",
                fontSize: 14.5,
              }}
            >
              {message.content}
              <div style={{ fontSize: 10.5, opacity: 0.65, marginTop: 4, textAlign: "right" }}>
                {relativeTime(message.deliveredAt)}
              </div>
            </div>
          );
        })}
      </div>

      <ReplyForm leadId={lead.id} />
    </div>
  );
}
