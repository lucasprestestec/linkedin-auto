import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { dayKeyOf, dayLabel, greeting, weekdayShort } from "@/lib/format";
import { firstNameOf } from "@/lib/shell";
import { remainingDailyInviteQuota } from "@/lib/prospect";
import { getConversationItems } from "@/lib/conversations";
import { MobileHeader } from "@/components/MobileHeader";
import { ConversationRow } from "@/components/ConversationRow";
import { Sparkline } from "@/components/Sparkline";
import { IconAlert, IconArrowRight, IconCheck, IconChevronRight, IconUserPlus } from "@/components/Icons";
import { AutomationBar } from "./AutomationBar";

export const dynamic = "force-dynamic";

const DAY_MS = 24 * 60 * 60 * 1000;
const DAYS = 14;
const LEVAS = 6;

type Leva = {
  key: string;
  date: Date;
  people: number;
  queued: number;
  accepted: number;
  replied: number;
  qualified: number;
  campaigns: string[];
};

async function getData() {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const since = new Date(Date.now() - (DAYS - 1) * DAY_MS);
  since.setHours(0, 0, 0, 0);
  const outbound = { some: { sender: { in: ["AGENT" as const, "HUMAN" as const] } } };
  const inbound = { some: { sender: "LEAD" as const } };

  const [settings, conversations, recentLeads, messagesToday, remaining, contacted, repliedAfterContact, active, qualified, recentMsgs, recentQualified] =
    await Promise.all([
      prisma.settings.findUniqueOrThrow({ where: { id: "singleton" } }),
      getConversationItems(),
      // Cada leva = pessoas adicionadas no mesmo dia.
      prisma.lead.findMany({
        where: { createdAt: { gte: since } },
        select: {
          createdAt: true,
          invitedAt: true,
          status: true,
          campaign: { select: { name: true } },
          messages: { where: { sender: "LEAD" }, select: { id: true }, take: 1 },
        },
      }),
      prisma.message.count({ where: { sender: { not: "LEAD" }, createdAt: { gte: startOfDay } } }),
      remainingDailyInviteQuota(),
      prisma.lead.count({ where: { messages: outbound } }),
      prisma.lead.count({ where: { AND: [{ messages: outbound }, { messages: inbound }] } }),
      prisma.lead.count({ where: { status: { in: ["CONVERSATION_OPEN", "NEEDS_HUMAN"] } } }),
      prisma.lead.count({ where: { status: "QUALIFIED" } }),
      prisma.message.findMany({ where: { deliveredAt: { gte: since } }, select: { sender: true, deliveredAt: true } }),
      prisma.lead.findMany({ where: { status: "QUALIFIED", updatedAt: { gte: since } }, select: { updatedAt: true } }),
    ]);

  // Séries diárias (mais antigo → hoje) pros minigráficos.
  const keys = Array.from({ length: DAYS }, (_, i) => dayKeyOf(new Date(since.getTime() + i * DAY_MS)));
  const series = (dates: Date[]) => {
    const count = new Map<string, number>();
    for (const d of dates) count.set(dayKeyOf(d), (count.get(dayKeyOf(d)) ?? 0) + 1);
    return keys.map((k) => count.get(k) ?? 0);
  };

  const byDay = new Map<string, Leva>();
  for (const l of recentLeads) {
    const key = dayKeyOf(l.createdAt);
    const leva = byDay.get(key) ?? { key, date: l.createdAt, people: 0, queued: 0, accepted: 0, replied: 0, qualified: 0, campaigns: [] };
    leva.people++;
    if (!l.invitedAt && l.status === "INVITE_SENT") leva.queued++;
    if (l.status !== "INVITE_SENT" && l.status !== "LOST") leva.accepted++;
    if (l.messages.length > 0) leva.replied++;
    if (l.status === "QUALIFIED") leva.qualified++;
    const camp = l.campaign?.name ?? "Sem campanha";
    if (!leva.campaigns.includes(camp)) leva.campaigns.push(camp);
    byDay.set(key, leva);
  }
  const levas = [...byDay.values()].sort((a, b) => b.key.localeCompare(a.key)).slice(0, LEVAS);

  return {
    settings,
    conversations,
    levas,
    remaining: Math.max(0, remaining),
    messagesToday,
    invitesToday: Math.max(0, settings.dailyInviteLimit - remaining),
    kpis: {
      contacted,
      rate: contacted ? Math.round((repliedAfterContact / contacted) * 100) : null,
      active,
      qualified,
    },
    spark: {
      sent: series(recentMsgs.filter((m) => m.sender !== "LEAD").map((m) => m.deliveredAt)),
      received: series(recentMsgs.filter((m) => m.sender === "LEAD").map((m) => m.deliveredAt)),
      all: series(recentMsgs.map((m) => m.deliveredAt)),
      qualified: series(recentQualified.map((l) => l.updatedAt)),
    },
  };
}

export default async function HomePage() {
  const { settings, conversations, levas, remaining, messagesToday, invitesToday, kpis, spark } = await getData();
  const name = firstNameOf(settings.ownerName);
  const linkedinOk = Boolean(settings.linkedinIdentityId) && !settings.linkedinNeedsReconnect;

  // Quem precisa de você primeiro; depois quem respondeu e ainda não teve resposta.
  const needYou = conversations
    .filter((c) => c.status === "NEEDS_HUMAN" || (c.unanswered && c.status !== "LOST"))
    .sort((a, b) => Number(b.status === "NEEDS_HUMAN") - Number(a.status === "NEEDS_HUMAN") || b.whenTs - a.whenTs);
  const urgentCount = conversations.filter((c) => c.status === "NEEDS_HUMAN").length;

  const steps = [
    { done: linkedinOk, label: "Conectar seu LinkedIn", href: "/settings" },
    { done: Boolean(settings.targetAudience?.trim()), label: "Dizer quem você quer alcançar", href: "/settings#alcance" },
    { done: conversations.length > 0, label: "Adicionar as primeiras pessoas", href: "/prospect" },
    { done: linkedinOk && !settings.automationPaused, label: "Ligar a automação", href: "#auto" },
  ];
  const doneCount = steps.filter((s) => s.done).length;

  const kpiItems = [
    { value: kpis.contacted, label: "Leads contatados", spark: spark.sent },
    { value: kpis.rate === null ? "—" : `${kpis.rate}%`, label: "Taxa de resposta", spark: spark.received },
    { value: kpis.active, label: "Conversas ativas", spark: spark.all },
    { value: kpis.qualified, label: "Oportunidades", spark: spark.qualified },
  ];

  return (
    <main className="page home-v5">
      <MobileHeader />

      <header className="rise">
        <h1 className="display page-title greet">
          {greeting()}
          {name ? (
            <>
              ,<br />
              <span className="name-grad">{name}.</span>
            </>
          ) : (
            <span className="name-grad">.</span>
          )}
        </h1>
        <p className="hero-sub">
          {urgentCount > 0 ? (
            <>
              {urgentCount} conversa{urgentCount > 1 ? "s" : ""} esperando você.
              <span className="only-mobile-inline"> O resto a IA está cuidando.</span>
            </>
          ) : (
            "Tudo em dia. A IA avisa aqui quando alguém precisar de você."
          )}
        </p>
      </header>

      <div id="auto">
        <AutomationBar
          paused={settings.automationPaused}
          connected={linkedinOk}
          today={`${invitesToday} convites e ${messagesToday} mensagens hoje`}
        />
      </div>

      {settings.linkedinNeedsReconnect && (
        <Link href="/settings" className="alert">
          <span className="alert-icon">
            <IconAlert size={20} />
          </span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <strong>LinkedIn desconectado</strong>
            <p>{settings.linkedinReconnectReason ?? "A sessão expirou"}. Toque aqui pra reconectar.</p>
          </span>
          <IconChevronRight size={18} />
        </Link>
      )}

      {doneCount < steps.length && (
        <section className="setup-v5" aria-label="Primeiros passos">
          <div className="sec-head">
            <h2>Primeiros passos</h2>
            <span className="small faint">
              {doneCount} de {steps.length}
            </span>
          </div>
          <ol className="setup-steps">
            {steps.map((s, i) => (
              <li key={s.label}>
                <Link href={s.href} className={s.done ? "done" : undefined}>
                  <span className="setup-num">{s.done ? <IconCheck size={13} strokeWidth={3} /> : i + 1}</span>
                  {s.label}
                </Link>
              </li>
            ))}
          </ol>
        </section>
      )}

      <section className="batch-cta" aria-label="Nova leva de convites">
        <span className="batch-cta-icon">
          <IconUserPlus size={24} />
        </span>
        <div className="batch-cta-text">
          <h2>Nova leva de convites</h2>
          <p>
            {remaining > 0
              ? `Hoje ainda dá pra convidar ${remaining} pessoa${remaining !== 1 ? "s" : ""}.`
              : "O limite de hoje já foi usado. Amanhã tem mais."}
          </p>
        </div>
        <Link href="/prospect" className="btn btn-primary batch-cta-btn">
          Prospectar <IconArrowRight size={16} />
        </Link>
      </section>

      <section aria-labelledby="needyou-title" className="stack" style={{ gap: 6 }}>
        <div className="sec-head">
          <h2 id="needyou-title">Conversas que precisam de você</h2>
          <Link href="/conversations" className="sec-link">
            Ver todas <IconArrowRight size={14} />
          </Link>
        </div>
        {needYou.length === 0 ? (
          <p className="empty-line">
            <IconCheck size={16} strokeWidth={3} /> Ninguém esperando resposta sua agora.
          </p>
        ) : (
          <ul className="rows boxed">
            {needYou.slice(0, 5).map((c) => (
              <li key={c.id}>
                <ConversationRow c={c} withReply />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="results-title" className="stack" style={{ gap: 10 }}>
        <div className="sec-head">
          <h2 id="results-title">Resultados</h2>
          <span className="small faint">últimos {DAYS} dias</span>
        </div>
        <dl className="kpis">
          {kpiItems.map((k) => (
            <div key={k.label} className="kpi-item">
              <dd>{k.value}</dd>
              <dt>{k.label}</dt>
              <span className="only-desktop kpi-spark">
                <Sparkline values={k.spark} />
              </span>
            </div>
          ))}
        </dl>


        {levas.length === 0 ? (
          <p className="empty-line">Quando você convidar pessoas, cada leva aparece aqui com quantas aceitaram e responderam.</p>
        ) : (
          <ul className="levas">
            {levas.map((l) => (
              <li key={l.key} className="leva">
                <div className="leva-head">
                  <span className="leva-day">
                    <b>{dayLabel(l.date)}</b>
                    <span className="faint"> · {weekdayShort(l.date)}</span>
                  </span>
                  <span className="leva-camps">{l.campaigns.join(", ")}</span>
                </div>
                <dl className="leva-funnel">
                  <div>
                    <dd>{l.people}</dd>
                    <dt>{l.queued > 0 ? `convidadas · ${l.queued} na fila` : "convidadas"}</dt>
                  </div>
                  <div>
                    <dd>{l.accepted}</dd>
                    <dt>aceitaram</dt>
                  </div>
                  <div>
                    <dd>{l.replied}</dd>
                    <dt>responderam</dt>
                  </div>
                  <div>
                    <dd>{l.qualified}</dd>
                    <dt>oportunidades</dt>
                  </div>
                </dl>
                <span className="leva-bar" aria-hidden>
                  <i style={{ width: `${(l.accepted / l.people) * 100}%` }} />
                  <i className="replied" style={{ width: `${(l.replied / l.people) * 100}%` }} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
