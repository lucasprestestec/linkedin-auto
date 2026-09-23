import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { STATUS_LABEL, statusColors } from "@/lib/status";
import { ReplyForm } from "./ReplyForm";

export const dynamic = "force-dynamic";

export default async function LeadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lead = await prisma.lead.findUnique({
    where: { id },
    include: { messages: { orderBy: { deliveredAt: "asc" } } },
  });

  if (!lead) notFound();

  const colors = statusColors(lead.status);

  return (
    <main style={{ maxWidth: 640, margin: "0 auto", minHeight: "100dvh", display: "flex", flexDirection: "column" }}>
      <header
        style={{
          position: "sticky",
          top: 0,
          background: "var(--bg)",
          borderBottom: "1px solid var(--border)",
          padding: "14px 16px",
          display: "flex",
          alignItems: "center",
          gap: 12,
          zIndex: 10,
        }}
      >
        <Link href="/" style={{ color: "var(--text-muted)", fontSize: 20, textDecoration: "none" }} aria-label="Voltar">
          ←
        </Link>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 600 }}>
            {lead.firstName} {lead.lastName}
          </div>
          {lead.jobTitle && (
            <div style={{ fontSize: 12.5, color: "var(--text-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {lead.jobTitle}
            </div>
          )}
        </div>
        <span
          style={{
            flexShrink: 0,
            fontSize: 12,
            fontWeight: 600,
            padding: "4px 10px",
            borderRadius: 999,
            color: colors.fg,
            background: colors.bg,
          }}
        >
          {STATUS_LABEL[lead.status]}
        </span>
      </header>

      <div style={{ flex: 1, padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
        {lead.messages.map((message: { id: string; sender: string; content: string }) => {
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
            </div>
          );
        })}
      </div>

      <ReplyForm leadId={lead.id} />
    </main>
  );
}
