import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { STATUS_LABEL, STATUS_ORDER, statusColors } from "@/lib/status";
import { toggleAutomation, logout } from "./actions";

export const dynamic = "force-dynamic";

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

  leads.sort((a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status));

  return { settings, leads, sentToday };
}

export default async function HomePage() {
  const { settings, leads, sentToday } = await getData();

  return (
    <main style={{ maxWidth: 640, margin: "0 auto", paddingBottom: 40 }}>
      <header
        style={{
          position: "sticky",
          top: 0,
          background: "var(--bg)",
          borderBottom: "1px solid var(--border)",
          padding: "14px 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          zIndex: 10,
        }}
      >
        <div>
          <div style={{ fontSize: 15, fontWeight: 600 }}>
            {settings.automationPaused ? "Automação pausada" : "Automação ativa"}
          </div>
          <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
            {sentToday} de {settings.dailyMessageLimit} mensagens hoje
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
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
              }}
            >
              {settings.automationPaused ? "Retomar" : "Pausar"}
            </button>
          </form>
          <form action={logout}>
            <button
              type="submit"
              style={{
                padding: "8px 10px",
                borderRadius: 8,
                border: "1px solid var(--border)",
                background: "var(--surface)",
                color: "var(--text-muted)",
                fontSize: 13.5,
                cursor: "pointer",
              }}
            >
              Sair
            </button>
          </form>
        </div>
      </header>

      {leads.length === 0 ? (
        <p style={{ padding: 24, color: "var(--text-muted)", fontSize: 14 }}>
          Nenhum lead ainda. Assim que alguém aceitar um convite ou responder, aparece aqui.
        </p>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {leads.map((lead) => {
            const colors = statusColors(lead.status);
            const lastMessage = lead.messages[0];
            return (
              <li key={lead.id} style={{ borderBottom: "1px solid var(--border)" }}>
                <Link
                  href={`/leads/${lead.id}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "14px 16px",
                    textDecoration: "none",
                    color: "inherit",
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 600 }}>
                      {lead.firstName} {lead.lastName}
                    </div>
                    {lastMessage && (
                      <div
                        style={{
                          fontSize: 13,
                          color: "var(--text-muted)",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {lastMessage.content}
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
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
