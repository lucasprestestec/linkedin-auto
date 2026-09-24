import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { greeting, relativeTime, todayLabel } from "@/lib/format";
import { IconAlert, IconChevronRight, IconPlus, IconZap } from "@/components/Icons";
import { AutomationSwitch } from "./AutomationSwitch";
import { LeadList, type LeadItem } from "./LeadList";

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

  return { settings, leads, sentToday };
}

export default async function HomePage() {
  const { settings, leads, sentToday } = await getData();

  const items: LeadItem[] = leads
    .map((lead) => {
      const last = lead.messages[0];
      const when = last?.deliveredAt ?? lead.updatedAt;
      return {
        item: {
          id: lead.id,
          firstName: lead.firstName,
          lastName: lead.lastName,
          jobTitle: lead.jobTitle,
          status: lead.status,
          needsHumanReason: lead.needsHumanReason,
          lastMessage: last ? { content: last.content, sender: last.sender } : null,
          when: relativeTime(when),
        },
        sortKey: when.getTime(),
      };
    })
    .sort((a, b) => b.sortKey - a.sortKey)
    .map((x) => x.item);

  const needYou = leads.filter((l) => l.status === "NEEDS_HUMAN").length;
  const talking = leads.filter((l) => l.status === "CONVERSATION_OPEN").length;
  const qualified = leads.filter((l) => l.status === "QUALIFIED").length;
  const usage = Math.min(100, Math.round((sentToday / Math.max(1, settings.dailyMessageLimit)) * 100));

  return (
    <main className="page">
      <header className="topbar">
        <div className="topbar-titles">
          <div className="eyebrow">{todayLabel()}</div>
          <h1 className="title-xl">{greeting()}</h1>
        </div>
        <Link href="/prospect" className="icon-btn icon-btn-round" aria-label="Nova prospecção">
          <IconPlus size={20} />
        </Link>
      </header>

      {settings.linkedinNeedsReconnect && (
        <Link href="/settings" className="alert rise">
          <span className="alert-icon">
            <IconAlert size={20} />
          </span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <strong>LinkedIn desconectado</strong>
            <p>
              {settings.linkedinReconnectReason ?? "A sessão expirou"}. A automação está parada até você reconectar.
            </p>
          </span>
          <IconChevronRight size={18} />
        </Link>
      )}

      <section className="hero rise" aria-label="Resumo de hoje">
        <div className="stack" style={{ gap: 16 }}>
          <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
            <div className="stack" style={{ gap: 8 }}>
              <span className="hero-label">
                <IconZap size={14} /> Mensagens enviadas hoje
              </span>
              <span className="hero-number">
                {sentToday}
                <small>/ {settings.dailyMessageLimit}</small>
              </span>
            </div>
            <span
              className="badge badge-plain"
              style={{ background: "rgba(255,255,255,0.12)", color: "#fff", marginTop: 2 }}
            >
              {usage}% do limite
            </span>
          </div>
          <div className="meter" role="progressbar" aria-valuenow={usage} aria-valuemin={0} aria-valuemax={100}>
            <span style={{ width: `${usage}%` }} />
          </div>

          <div className="hero-stats">
            <div className="hero-stat">
              <i className="dot" style={{ background: "#ff8a6b" }} />
              <b>{needYou}</b>
              <span>Pra você</span>
            </div>
            <div className="hero-stat">
              <i className="dot" style={{ background: "#7fb0ff" }} />
              <b>{talking}</b>
              <span>Conversando</span>
            </div>
            <div className="hero-stat">
              <i className="dot" style={{ background: "#4ee0a2" }} />
              <b>{qualified}</b>
              <span>Qualificados</span>
            </div>
          </div>

          <div className="hero-divider" />
          <AutomationSwitch paused={settings.automationPaused} />
        </div>
      </section>

      <LeadList leads={items} />
    </main>
  );
}
