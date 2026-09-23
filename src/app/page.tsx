import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { LEAD_SECTIONS } from "@/lib/status";
import { relativeTime } from "@/lib/format";
import { Avatar } from "@/components/Avatar";
import { toggleAutomation } from "./actions";
import type { Lead, LeadStatus, Message } from "@prisma/client";

export const dynamic = "force-dynamic";

type LeadWithMessages = Lead & { messages: Message[] };

async function getData() {
  const [settings, leads] = await Promise.all([
    prisma.settings.findUniqueOrThrow({ where: { id: "singleton" } }),
    prisma.lead.findMany({
      include: { messages: { orderBy: { deliveredAt: "desc" }, take: 1 } },
    }),
  ]);

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const sentToday = await prisma.message.count({
    where: { sender: { not: "LEAD" }, createdAt: { gte: startOfDay } },
  });

  return { settings, leads, sentToday };
}

export default async function HomePage() {
  const { settings, leads, sentToday } = await getData();

  const byStatus = new Map<LeadStatus, LeadWithMessages[]>();
  for (const lead of leads) {
    const list = byStatus.get(lead.status) ?? [];
    list.push(lead);
    byStatus.set(lead.status, list);
  }
  for (const list of byStatus.values()) {
    list.sort((a, b) => (b.messages[0]?.deliveredAt.getTime() ?? b.updatedAt.getTime()) - (a.messages[0]?.deliveredAt.getTime() ?? a.updatedAt.getTime()));
  }

  return (
    <>
      <header
        style={{
          position: "sticky",
          top: 0,
          background: "var(--bg)",
          borderBottom: "1px solid var(--border)",
          padding: "16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          zIndex: 10,
        }}
      >
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0, letterSpacing: -0.2 }}>Leads</h1>
          <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 2 }}>
            {settings.automationPaused ? "Automação pausada" : "Automação ativa"} · {sentToday}/{settings.dailyMessageLimit} mensagens hoje
          </div>
        </div>
        <form action={toggleAutomation}>
          <button
            type="submit"
            style={{
              padding: "8px 14px",
              borderRadius: 8,
              border: "1px solid var(--border)",
              background: settings.automationPaused ? "var(--primary)" : "var(--surface)",
              color: settings.automationPaused ? "#fff" : "var(--text)",
              fontSize: 13.5,
              fontWeight: 600,
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            {settings.automationPaused ? "Retomar" : "Pausar"}
          </button>
        </form>
      </header>

      {leads.length === 0 ? (
        <p style={{ padding: 24, color: "var(--text-muted)", fontSize: 14 }}>
          Nenhum lead ainda. Assim que alguém aceitar um convite ou responder, aparece aqui.
        </p>
      ) : (
        <div style={{ padding: "8px 0 24px" }}>
          {LEAD_SECTIONS.map((section) => {
            const items = section.statuses.flatMap((s) => byStatus.get(s) ?? []);
            if (items.length === 0) return null;
            const urgent = section.key === "urgent";

            return (
              <div key={section.key} style={{ marginTop: 24 }}>
                <div
                  style={{
                    padding: "0 16px 8px",
                    fontSize: 11.5,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: 0.6,
                    color: urgent ? "var(--accent-urgent)" : "var(--text-faint)",
                  }}
                >
                  {section.label} {items.length > 1 && `· ${items.length}`}
                </div>
                <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                  {items.map((lead) => {
                    const lastMessage = lead.messages[0];
                    const when = lastMessage?.deliveredAt ?? lead.updatedAt;
                    return (
                      <li key={lead.id}>
                        <Link
                          href={`/leads/${lead.id}`}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 12,
                            padding: urgent ? "12px 16px" : "9px 16px",
                            textDecoration: "none",
                            color: "inherit",
                            borderLeft: urgent ? "3px solid var(--accent-urgent)" : "3px solid transparent",
                          }}
                        >
                          <Avatar firstName={lead.firstName} lastName={lead.lastName} size={urgent ? 40 : 34} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                              <span style={{ fontSize: urgent ? 15.5 : 14.5, fontWeight: urgent ? 700 : 600 }}>
                                {lead.firstName} {lead.lastName}
                              </span>
                              <span style={{ fontSize: 11.5, color: "var(--text-faint)", flexShrink: 0, marginLeft: "auto" }}>
                                {relativeTime(when)}
                              </span>
                            </div>
                            <div
                              style={{
                                fontSize: 13,
                                color: urgent ? "var(--text)" : "var(--text-muted)",
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                marginTop: 1,
                              }}
                            >
                              {urgent && lead.needsHumanReason ? lead.needsHumanReason : lastMessage?.content ?? lead.jobTitle}
                            </div>
                          </div>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
