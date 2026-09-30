import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatSlot } from "@/lib/slots";
import { dayKeyOf, dayLabel, greeting, todayLabel, weekdayShort } from "@/lib/format";
import { firstNameOf } from "@/lib/shell";
import { remainingDailyInviteQuota } from "@/lib/prospect";
import { getConversationItems } from "@/lib/conversations";
import { MobileHeader } from "@/components/MobileHeader";
import { Avatar } from "@/components/Avatar";
import { Sparkline } from "@/components/Sparkline";
import { IconAlert, IconArrowRight, IconCalendar, IconCheck, IconChevronRight, IconEye, IconFlame, IconMessages, IconSparkles, IconUserPlus } from "@/components/Icons";
import { dailyReport, type TimelineKind } from "@/lib/dailyReport";
import { clockTime } from "@/lib/format";
import { AutomationBar } from "./AutomationBar";
import { HomeConversations } from "./HomeConversations";

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

  const [settings, conversations, recentLeads, messagesToday, remaining, contacted, repliedAfterContact, active, qualified, recentMsgs, recentQualified, report] =
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
      dailyReport(),
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
    report,
    settings,
    conversations,
    levas,
    remaining: Math.max(0, remaining),
    messagesToday,
    invitesToday: Math.max(0, settings.dailyInviteLimit - remaining),
    kpis: {
      contacted,
      replied: repliedAfterContact,
      rate: contacted ? Math.round((repliedAfterContact / contacted) * 100) : null,
      active,
      qualified,
    },
    spark: {
      sent: series(recentMsgs.filter((m) => m.sender !== "LEAD").map((m) => m.deliveredAt)),
      received: series(recentMsgs.filter((m) => m.sender === "LEAD").map((m) => m.deliveredAt)),
      qualified: series(recentQualified.map((l) => l.updatedAt)),
    },
  };
}

const TIMELINE_ICON: Record<TimelineKind, React.ReactNode> = {
  invite: <IconUserPlus size={15} />,
  accepted: <IconCheck size={15} strokeWidth={2.6} />,
  sent: <IconSparkles size={15} />,
  reply: <IconMessages size={15} />,
  open: <IconEye size={15} />,
  handoff: <IconAlert size={15} />,
  qualified: <IconFlame size={15} />,
};

function listNames(names: string[]) {
  if (names.length <= 1) return names.join("");
  if (names.length <= 3) return `${names.slice(0, -1).join(", ")} e ${names.at(-1)}`;
  return `${names.slice(0, 2).join(", ")} e mais ${names.length - 2}`;
}

export default async function HomePage() {
  const { report, settings, conversations, levas, remaining, messagesToday, invitesToday, kpis, spark } = await getData();
  const draftCount = await prisma.draft.count({ where: { status: "PENDING" } });
  // Próxima reunião marcada (pela secretária ou por você): atalho pra tela Agenda.
  const [meetingCount, nextMeeting] = await Promise.all([
    prisma.lead.count({ where: { meetingAt: { gte: new Date() } } }),
    prisma.lead.findFirst({ where: { meetingAt: { gte: new Date() } }, orderBy: { meetingAt: "asc" }, select: { firstName: true, lastName: true, meetingAt: true } }),
  ]);
  const sentToday = report.sent.LINKEDIN + report.sent.EMAIL + report.sent.WHATSAPP;
  const name = firstNameOf(settings.ownerName);
  const linkedinOk = Boolean(settings.linkedinIdentityId) && !settings.linkedinNeedsReconnect;

  // Sua vez: quem precisa de você primeiro; depois quem respondeu e ainda não teve resposta.
  const needYou = conversations
    .filter((c) => c.status === "NEEDS_HUMAN" || (c.unanswered && c.status !== "LOST"))
    .sort((a, b) => Number(b.status === "NEEDS_HUMAN") - Number(a.status === "NEEDS_HUMAN") || b.whenTs - a.whenTs);

  const steps = [
    { done: linkedinOk, label: "Conectar seu LinkedIn", href: "/settings" },
    { done: Boolean(settings.targetAudience?.trim()), label: "Dizer quem você quer alcançar", href: "/settings#alcance" },
    { done: conversations.length > 0, label: "Adicionar as primeiras pessoas", href: "/prospect" },
    { done: linkedinOk && !settings.automationPaused, label: "Ligar a automação", href: "#auto" },
  ];
  const doneCount = steps.filter((s) => s.done).length;

  const quick = [
    { value: kpis.contacted, label: "Contatados", spark: spark.sent },
    { value: kpis.replied, label: "Respostas", note: kpis.rate === null ? null : `${kpis.rate}% de resposta`, spark: spark.received },
    { value: kpis.qualified, label: "Oportunidades", spark: spark.qualified },
  ];

  return (
    <main className="page home-lux">
      <MobileHeader />

      <header className="lux-hero rise">
        <p className="overline">{todayLabel()}</p>
        <h1 className="serif-title">
          {greeting()}
          {name ? (
            <>
              ,<br />
              <span className="gold-text">{name}.</span>
            </>
          ) : (
            <span className="gold-text">.</span>
          )}
        </h1>
        <p className="lux-sub">
          {needYou.length > 0 ? (
            <>
              Você tem <b>{needYou.length} conversa{needYou.length > 1 ? "s" : ""}</b> que precisa{needYou.length > 1 ? "m" : ""} da sua atenção.
            </>
          ) : (
            "Tudo em dia. A IA avisa aqui quando alguém precisar de você."
          )}
        </p>
      </header>

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

      {nextMeeting?.meetingAt && (
        <Link href="/agenda" className="alert">
          <span className="alert-icon">
            <IconCalendar size={20} />
          </span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <strong>
              Próxima reunião: {[nextMeeting.firstName, nextMeeting.lastName].filter(Boolean).join(" ") || "lead"} · {formatSlot(nextMeeting.meetingAt)}
            </strong>
            <p>
              {meetingCount > 1 ? `${meetingCount} reuniões marcadas. ` : ""}Toque aqui para ver a agenda e os horários livres.
            </p>
          </span>
          <IconChevronRight size={18} />
        </Link>
      )}

      {draftCount > 0 && (
        <Link href="/approvals" className="alert">
          <span className="alert-icon">
            <IconCheck size={20} />
          </span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <strong>
              {draftCount} mensagem{draftCount > 1 ? "ns" : ""} esperando sua aprovação
            </strong>
            <p>A secretária já escreveu. Toque aqui pra revisar e enviar.</p>
          </span>
          <IconChevronRight size={18} />
        </Link>
      )}

      <div className="home-grid-lux">
        <div className="home-main">
          {doneCount < steps.length && (
            <section className="panel setup-panel" aria-label="Primeiros passos">
              <div className="panel-head">
                <h2>
                  Primeiros passos <span className="count-pill">{doneCount}/{steps.length}</span>
                </h2>
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

          <HomeConversations items={conversations} />

          <section className="panel" aria-labelledby="timeline-title">
            <div className="panel-head">
              <h2 id="timeline-title">O que a secretária fez hoje</h2>
              <span className="panel-note">{report.timeline.length ? `${report.timeline.length} acontecimento${report.timeline.length > 1 ? "s" : ""}` : ""}</span>
            </div>
            {report.timeline.length === 0 ? (
              <p className="panel-empty">
                Nada por enquanto. Assim que ela convidar, escrever ou alguém responder, aparece aqui — e no fim do expediente você recebe o resumo do
                dia.
              </p>
            ) : (
              <ol className="day-timeline">
                {report.timeline.slice(0, 12).map((t, i) => (
                  <li key={`${t.kind}-${t.leadId}-${i}`} className={`tl-${t.kind}`}>
                    <span className="tl-icon" aria-hidden>
                      {TIMELINE_ICON[t.kind]}
                    </span>
                    <Link href={t.kind === "invite" && t.name.endsWith("pessoas") ? "/campaigns" : `/leads/${t.leadId}`} className="tl-text">
                      <b>{t.name}</b> {t.text}
                    </Link>
                    <time className="tl-time">{clockTime(t.at)}</time>
                  </li>
                ))}
                {report.timeline.length > 12 && <li className="tl-more">e mais {report.timeline.length - 12} hoje</li>}
              </ol>
            )}
          </section>

          <section className="panel" aria-labelledby="results-title">
            <div className="panel-head">
              <h2 id="results-title">Resultados por leva</h2>
              <span className="panel-note">últimos {DAYS} dias</span>
            </div>
            {levas.length === 0 ? (
              <p className="panel-empty">Quando você convidar pessoas, cada leva aparece aqui com quantas aceitaram e responderam.</p>
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
        </div>

        <aside className="home-rail" aria-label="Resumo">
          <section className="panel rail-card" aria-labelledby="yourturn-title">
            <Link href="/conversations?status=urgent" className="panel-head panel-link">
              <h2 id="yourturn-title">
                Sua vez <span className="count-pill">{needYou.length}</span>
              </h2>
              <IconChevronRight size={18} />
            </Link>
            {needYou.length === 0 ? (
              <p className="panel-empty">
                <IconCheck size={16} strokeWidth={3} /> Ninguém esperando resposta sua.
              </p>
            ) : (
              <ul className="turn-list">
                {needYou.slice(0, 3).map((c) => (
                  <li key={c.id}>
                    <Link href={`/leads/${c.id}`} className="turn-card">
                      <span className={`lux-dot ${c.status === "NEEDS_HUMAN" ? "dot-urgent" : "dot-waiting"}`} aria-hidden />
                      <Avatar firstName={c.firstName} lastName={c.lastName} size={40} />
                      <span className="turn-main">
                        <span className="turn-top">
                          <b>
                            {c.firstName} {c.lastName}
                          </b>
                          <small>{c.when}</small>
                        </span>
                        {c.company && <small className="turn-sub">{c.company}</small>}
                        <span className="turn-msg">
                          {c.status === "NEEDS_HUMAN" && c.needsHumanReason ? c.needsHumanReason : (c.lastMessage?.content ?? "")}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section id="auto" className="panel rail-card" aria-labelledby="today-title">
            <div className="panel-head">
              <h2 id="today-title">Hoje</h2>
            </div>
            <dl className="today-stats">
              <div>
                <dd>{report.invites}</dd>
                <dt>convites</dt>
              </div>
              <div>
                <dd>{sentToday}</dd>
                <dt>mensagens</dt>
                {report.sent.EMAIL + report.sent.WHATSAPP > 0 && (
                  <span className="today-note">
                    {[report.sent.EMAIL && `${report.sent.EMAIL} e-mail`, report.sent.WHATSAPP && `${report.sent.WHATSAPP} WhatsApp`].filter(Boolean).join(" · ")}
                  </span>
                )}
              </div>
              <div>
                <dd>{report.replies.length}</dd>
                <dt>respostas</dt>
              </div>
              <div>
                <dd>{report.opens.length}</dd>
                <dt>e-mails abertos</dt>
              </div>
            </dl>
            <div className="today-list">
              <Link href="/conversations?status=urgent" className="today-item">
                <span className="today-icon">
                  <IconMessages size={18} />
                </span>
                <span className="today-text">
                  <b>
                    {needYou.length} conversa{needYou.length !== 1 ? "s" : ""} para responder
                  </b>
                  <small>{needYou.length ? listNames(needYou.map((c) => c.firstName ?? "Lead")) : "Nada pendente"}</small>
                </span>
              </Link>
              <Link href="/prospect" className="today-item">
                <span className="today-icon">
                  <IconUserPlus size={18} />
                </span>
                <span className="today-text">
                  <b>{remaining > 0 ? `Cabem mais ${remaining} convite${remaining !== 1 ? "s" : ""} hoje` : "Limite de convites de hoje atingido"}</b>
                  <small>{remaining > 0 ? "Toque pra adicionar uma nova leva" : `${invitesToday} enviados hoje`}</small>
                </span>
                <IconArrowRight size={16} className="today-go" />
              </Link>
              <AutomationBar
                variant="item"
                paused={settings.automationPaused}
                connected={linkedinOk}
                today={`${messagesToday} mensage${messagesToday !== 1 ? "ns" : "m"} enviada${messagesToday !== 1 ? "s" : ""} hoje`}
              />
            </div>
          </section>

          <section className="panel rail-card" aria-labelledby="quick-title">
            <div className="panel-head">
              <h2 id="quick-title">Visão rápida</h2>
              <span className="panel-select">Últimos {DAYS} dias</span>
            </div>
            <dl className="quick-stats">
              {quick.map((k) => (
                <div key={k.label}>
                  <dd>{k.value}</dd>
                  <dt>{k.label}</dt>
                  {k.note && <span className="quick-note">{k.note}</span>}
                  <span className="quick-spark">
                    <Sparkline values={k.spark} />
                  </span>
                </div>
              ))}
            </dl>
          </section>
        </aside>
      </div>
    </main>
  );
}
