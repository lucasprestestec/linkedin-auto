import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { greeting, relativeTime } from "@/lib/format";
import { firstNameOf } from "@/lib/shell";
import { campaignNumbers } from "@/lib/campaignStats";
import { remainingDailyInviteQuota } from "@/lib/prospect";
import { parseIdealClient } from "@/lib/audience";
import { Avatar } from "@/components/Avatar";
import { MobileHeader } from "@/components/MobileHeader";
import { IconAlert, IconArrowRight, IconCheck, IconChevronRight, IconMegaphone, IconPlus, IconSparkles } from "@/components/Icons";
import { AutomationCard } from "./AutomationCard";
import { FunnelCard, type FunnelStep } from "./FunnelCard";
import { CampaignNumbers } from "./campaigns/CampaignNumbers";

export const dynamic = "force-dynamic";

async function getData() {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const outbound = { some: { sender: { in: ["AGENT" as const, "HUMAN" as const] } } };
  const inbound = { some: { sender: "LEAD" as const } };

  const [settings, needYou, campaigns, messagesToday, remaining, total, connected, contacted, replied, repliedAfterContact, qualified] =
    await Promise.all([
      prisma.settings.findUniqueOrThrow({ where: { id: "singleton" } }),
      prisma.lead.findMany({
        where: { status: "NEEDS_HUMAN" },
        orderBy: { updatedAt: "desc" },
        take: 5,
        select: { id: true, firstName: true, lastName: true, needsHumanReason: true, updatedAt: true },
      }),
      prisma.campaign.findMany({
        orderBy: { createdAt: "desc" },
        take: 3,
        include: { leads: { select: { status: true, messages: { select: { sender: true } } } } },
      }),
      prisma.message.count({ where: { sender: { not: "LEAD" }, createdAt: { gte: startOfDay } } }),
      remainingDailyInviteQuota(),
      prisma.lead.count(),
      prisma.lead.count({ where: { status: { not: "INVITE_SENT" } } }),
      prisma.lead.count({ where: { messages: outbound } }),
      prisma.lead.count({ where: { messages: inbound } }),
      prisma.lead.count({ where: { AND: [{ messages: outbound }, { messages: inbound }] } }),
      prisma.lead.count({ where: { status: "QUALIFIED" } }),
    ]);
  const needYouCount = needYou.length ? await prisma.lead.count({ where: { status: "NEEDS_HUMAN" } }) : 0;
  const campaignCount = campaigns.length ? await prisma.campaign.count() : 0;

  return {
    settings,
    needYou,
    needYouCount,
    campaigns,
    campaignCount,
    messagesToday,
    invitesToday: Math.max(0, settings.dailyInviteLimit - remaining),
    funnel: { total, connected, contacted, replied, repliedAfterContact, qualified },
  };
}

export default async function HomePage() {
  const { settings, needYou, needYouCount, campaigns, campaignCount, messagesToday, invitesToday, funnel } = await getData();
  const name = firstNameOf(settings.ownerName);
  const linkedinOk = Boolean(settings.linkedinIdentityId) && !settings.linkedinNeedsReconnect;
  const icp = parseIdealClient(settings.targetAudience);
  const hasAudience = Boolean(settings.targetAudience?.trim()) && (icp.titles.length > 0 || icp.notes.length > 0 || icp.industries.length > 0);

  // Primeiros passos: some quando tudo estiver feito.
  const steps = [
    { done: linkedinOk, label: "Conecte seu LinkedIn", hint: "Pra automação agir em seu nome", href: "/settings" },
    { done: hasAudience, label: "Diga quem você quer alcançar", hint: "Cargos, setores e região", href: "/settings#alcance" },
    { done: campaignCount > 0, label: "Crie sua primeira campanha", hint: "O que oferecer e pra quem", href: "/campaigns/new" },
    { done: linkedinOk && !settings.automationPaused, label: "Ligue a automação", hint: "No card acima", href: "#auto-title" },
  ];
  const doneCount = steps.filter((s) => s.done).length;

  const funnelSteps: FunnelStep[] = [
    { label: "Convidados", value: funnel.total },
    { label: "Aceitaram", value: funnel.connected },
    { label: "Contatados", value: funnel.contacted },
    { label: "Responderam", value: funnel.replied },
    { label: "Oportunidades", value: funnel.qualified },
  ];

  return (
    <main className="page home-simple">
      <MobileHeader />

      <header className="page-hero rise">
        <h1 className="display page-title">
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
          {needYouCount > 0
            ? `${needYouCount} conversa${needYouCount > 1 ? "s" : ""} esperando você. O resto a IA está cuidando.`
            : "Tudo em dia. A IA avisa aqui quando alguém precisar de você."}
        </p>
      </header>

      {settings.linkedinNeedsReconnect && (
        <Link href="/settings" className="alert rise">
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

      <div className="home-cols">
        <div className="home-main">
          <AutomationCard
            paused={settings.automationPaused}
            connected={linkedinOk}
            invitesToday={invitesToday}
            inviteLimit={settings.dailyInviteLimit}
            messagesToday={messagesToday}
            messageLimit={settings.dailyMessageLimit}
          />

          {doneCount < steps.length && (
            <section className="card card-pad setup rise" aria-labelledby="setup-title">
              <div className="row" style={{ justifyContent: "space-between", gap: 12 }}>
                <h2 id="setup-title" className="block-title">
                  Primeiros passos
                </h2>
                <span className="small faint">
                  {doneCount} de {steps.length}
                </span>
              </div>
              <div className="setup-meter" aria-hidden="true">
                <span style={{ width: `${(doneCount / steps.length) * 100}%` }} />
              </div>
              <ol className="setup-list">
                {steps.map((s, i) => (
                  <li key={s.label}>
                    <Link href={s.href} className={`setup-item${s.done ? " done" : ""}`}>
                      <span className="setup-check">{s.done ? <IconCheck size={15} strokeWidth={3} /> : i + 1}</span>
                      <span className="stack" style={{ flex: 1, minWidth: 0 }}>
                        <b>{s.label}</b>
                        {!s.done && <span className="tiny faint">{s.hint}</span>}
                      </span>
                      {!s.done && <IconChevronRight size={16} className="faint" />}
                    </Link>
                  </li>
                ))}
              </ol>
            </section>
          )}

          <section className="stack" style={{ gap: 12 }} aria-labelledby="needyou-title">
            <div className="section-row" style={{ marginBottom: 0 }}>
              <h2 id="needyou-title">Precisa de você</h2>
              {needYouCount > needYou.length && (
                <Link href="/conversations?status=urgent" className="link-btn">
                  Ver todas ({needYouCount})
                </Link>
              )}
            </div>
            {needYou.length === 0 ? (
              <div className="card card-pad calm">
                <span className="calm-icon">
                  <IconCheck size={20} strokeWidth={3} />
                </span>
                <span className="small muted">Ninguém esperando resposta sua agora.</span>
              </div>
            ) : (
              <ul className="need-list">
                {needYou.map((l) => (
                  <li key={l.id}>
                    <Link href={`/leads/${l.id}`} className="need-card">
                      <Avatar firstName={l.firstName} lastName={l.lastName} size={48} status="urgent" />
                      <span className="stack" style={{ flex: 1, minWidth: 0, gap: 3 }}>
                        <span className="row" style={{ justifyContent: "space-between", gap: 8 }}>
                          <b className="truncate">
                            {l.firstName} {l.lastName}
                          </b>
                          <span className="tiny faint" style={{ flexShrink: 0 }}>
                            {relativeTime(l.updatedAt)}
                          </span>
                        </span>
                        <span className="need-reason">
                          <IconSparkles size={13} /> {l.needsHumanReason ?? "Precisa da sua resposta"}
                        </span>
                      </span>
                      <span className="need-go">
                        Responder <IconArrowRight size={15} />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="home-side">
          <section className="stack" style={{ gap: 12 }} aria-labelledby="camps-title">
            <div className="section-row" style={{ marginBottom: 0 }}>
              <h2 id="camps-title">Suas campanhas</h2>
              {campaignCount > 0 && (
                <Link href="/campaigns" className="link-btn">
                  Ver todas
                </Link>
              )}
            </div>
            {campaigns.map((c) => (
              <Link key={c.id} href={`/campaigns/${c.id}`} className="card camp-mini">
                <span className="row" style={{ gap: 10 }}>
                  <span className="camp-icon tone-lav" style={{ width: 36, height: 36 }}>
                    <IconMegaphone size={17} />
                  </span>
                  <b className="truncate" style={{ flex: 1 }}>
                    {c.name}
                  </b>
                  <IconChevronRight size={16} className="faint" />
                </span>
                <CampaignNumbers numbers={campaignNumbers(c.leads)} />
              </Link>
            ))}
            <Link href="/campaigns/new" className="new-camp">
              <IconPlus size={18} /> {campaignCount === 0 ? "Criar sua primeira campanha" : "Nova campanha"}
            </Link>
          </section>

          {funnel.total > 0 && <FunnelCard steps={funnelSteps} contacted={funnel.contacted} replied={funnel.repliedAfterContact} />}
        </div>
      </div>
    </main>
  );
}
