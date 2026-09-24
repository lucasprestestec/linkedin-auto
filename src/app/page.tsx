import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { dayKeyOf, greeting, relativeTime, splitHeadline, weekdayShort } from "@/lib/format";
import { firstNameOf } from "@/lib/shell";
import { IconAlert, IconArrowRight, IconArrowUpRight, IconChat, IconChevronRight, IconClock, IconUser } from "@/components/Icons";
import { MobileHeader } from "@/components/MobileHeader";
import { LeadList, type LeadItem } from "./LeadList";
import { RhythmCard, type DayBar } from "./RhythmCard";

export const dynamic = "force-dynamic";

const DAY_MS = 24 * 60 * 60 * 1000;

async function getData() {
  const weekAgo = new Date(Date.now() - 7 * DAY_MS);
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const outbound = { some: { sender: { in: ["AGENT" as const, "HUMAN" as const] } } };
  const inbound = { some: { sender: "LEAD" as const } };

  const [settings, leads, sentToday, sentWeek, contacted, repliedAfterContact] = await Promise.all([
    prisma.settings.findUniqueOrThrow({ where: { id: "singleton" } }),
    prisma.lead.findMany({
      include: { messages: { orderBy: { deliveredAt: "desc" }, take: 1 }, campaign: { select: { name: true } } },
    }),
    prisma.message.count({ where: { sender: { not: "LEAD" }, createdAt: { gte: startOfDay } } }),
    prisma.message.findMany({ where: { sender: { not: "LEAD" }, createdAt: { gte: weekAgo } }, select: { createdAt: true } }),
    prisma.lead.count({ where: { messages: outbound } }),
    prisma.lead.count({ where: { AND: [{ messages: outbound }, { messages: inbound }] } }),
  ]);

  // Barras: mensagens enviadas por dia, do mais antigo (6 dias atrás) até hoje.
  const perDay = new Map<string, number>();
  for (const m of sentWeek) perDay.set(dayKeyOf(m.createdAt), (perDay.get(dayKeyOf(m.createdAt)) ?? 0) + 1);
  const days: DayBar[] = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(Date.now() - (6 - i) * DAY_MS);
    return { label: i === 6 ? "hoje" : weekdayShort(d), value: perDay.get(dayKeyOf(d)) ?? 0 };
  });

  return {
    settings,
    leads,
    sentToday,
    days,
    replyRate: contacted > 0 ? Math.round((repliedAfterContact / contacted) * 100) : null,
    newThisWeek: leads.filter((l) => l.createdAt >= weekAgo).length,
  };
}

const TILES = [
  { key: "urgent", label: "Precisa de você", tone: "peach", Icon: IconUser },
  { key: "open", label: "Conversando", tone: "lav", Icon: IconChat },
  { key: "waiting", label: "Aguardando resposta", tone: "cream", Icon: IconClock },
] as const;

export default async function HomePage({ searchParams }: PageProps<"/">) {
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q : "";
  const status = typeof params.status === "string" ? params.status : "";
  const { settings, leads, sentToday, days, replyRate, newThisWeek } = await getData();

  const items: LeadItem[] = leads
    .map((lead) => {
      const last = lead.messages[0];
      const when = last?.deliveredAt ?? lead.updatedAt;
      const { role, company } = splitHeadline(lead.jobTitle);
      return {
        id: lead.id,
        firstName: lead.firstName,
        lastName: lead.lastName,
        jobTitle: lead.jobTitle,
        role,
        company,
        linkedinProfileUrl: lead.linkedinProfileUrl,
        status: lead.status,
        needsHumanReason: lead.needsHumanReason,
        followUpsSent: lead.followUpsSent,
        tags: lead.tags,
        campaignName: lead.campaign?.name ?? null,
        icpScore: lead.icpScore,
        lastMessage: last ? { content: last.content, sender: last.sender } : null,
        when: relativeTime(when),
        whenTs: when.getTime(),
      };
    })
    .sort((a, b) => b.whenTs - a.whenTs);

  const counts = {
    urgent: leads.filter((l) => l.status === "NEEDS_HUMAN").length,
    open: leads.filter((l) => l.status === "CONVERSATION_OPEN" || l.status === "QUALIFIED").length,
    waiting: leads.filter((l) => l.status === "WAITING_REPLY").length,
  };
  const name = firstNameOf(settings.ownerName);

  return (
    <main className="page home">
      <MobileHeader />

      <div className="home-grid">
        <section className="home-hero rise" aria-label="Resumo">
          <h1 className="display hero-title">
            {greeting()}
            {name ? (
              <>
                , <span className="name-grad">{name}.</span>
              </>
            ) : (
              <span className="name-grad">.</span>
            )}
          </h1>
          <p className="hero-sub">
            <b>{counts.open}</b> conversa{counts.open !== 1 ? "s" : ""} em andamento.{" "}
            {newThisWeek > 0 ? "Novos leads chegando esta semana. ✨" : "Que tal convidar gente nova hoje?"}
          </p>
          {newThisWeek > 0 && (
            <Link href="/?status=all#leads" className="hero-bubble" aria-label={`${newThisWeek} novos leads esta semana`}>
              <span className="hero-bubble-arrow">
                <IconArrowUpRight size={16} />
              </span>
              <b className="display">+{newThisWeek}</b>
              <span>
                novo{newThisWeek > 1 ? "s" : ""} lead{newThisWeek > 1 ? "s" : ""}
                <br />
                esta semana
              </span>
            </Link>
          )}
        </section>

        <div className="stat-tiles rise" style={{ "--i": 1 } as React.CSSProperties}>
          {TILES.map(({ key, label, tone, Icon }) => (
            <Link key={key} href={`/?status=${key}#leads`} className={`stat-tile tile-${tone}`} aria-current={status === key ? "true" : undefined}>
              <span className="stat-tile-icon">
                <Icon size={20} />
              </span>
              <b className="stat-tile-num">{counts[key]}</b>
              <span className="stat-tile-label">{label}</span>
              <span className="stat-tile-go" aria-hidden="true">
                <IconArrowRight size={16} />
              </span>
            </Link>
          ))}
        </div>

        <div className="home-rhythm rise" style={{ "--i": 2 } as React.CSSProperties}>
          <RhythmCard days={days} replyRate={replyRate} sentToday={sentToday} dailyLimit={settings.dailyMessageLimit} paused={settings.automationPaused} />
        </div>
      </div>

      {settings.linkedinNeedsReconnect && (
        <Link href="/settings" className="alert rise">
          <span className="alert-icon">
            <IconAlert size={20} />
          </span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <strong>LinkedIn desconectado</strong>
            <p>{settings.linkedinReconnectReason ?? "A sessão expirou"}. A automação está parada até você reconectar.</p>
          </span>
          <IconChevronRight size={18} />
        </Link>
      )}

      <LeadList key={`${q}|${status}`} leads={items} followUpMax={settings.followUpMaxCount} initialQuery={q} initialSection={status} />
    </main>
  );
}
