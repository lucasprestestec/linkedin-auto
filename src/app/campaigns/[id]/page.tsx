import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { campaignNumbers } from "@/lib/campaignStats";
import { getConversationItems } from "@/lib/conversations";
import { MobileHeader } from "@/components/MobileHeader";
import { CampaignStatus } from "@/components/CampaignStatus";
import { ConversationRow } from "@/components/ConversationRow";
import { IconArrowLeft, IconCheck, IconPlus, IconRefresh } from "@/components/Icons";
import { describeRule } from "@/lib/followupPolicy";
import { CampaignMenu } from "../CampaignMenu";

export const dynamic = "force-dynamic";

export default async function CampaignPage({ params, searchParams }: PageProps<"/campaigns/[id]">) {
  const { id } = await params;
  const isNew = (await searchParams).novo === "1";
  const [campaign, conversations, settings] = await Promise.all([
    prisma.campaign.findUnique({
      where: { id },
      include: { leads: { select: { status: true, messages: { select: { sender: true } } } } },
    }),
    getConversationItems(),
    prisma.settings.findUniqueOrThrow({ where: { id: "singleton" }, select: { followUpMaxCount: true, followUpDelayHours: true } }),
  ]);
  if (!campaign) notFound();

  const n = campaignNumbers(campaign.leads);
  const people = conversations.filter((c) => c.campaignId === campaign.id);
  const active = campaign.status === "ACTIVE";
  const full = campaign.maxLeads != null && n.leads >= campaign.maxLeads;

  return (
    <main className="page">
      <MobileHeader />
      <Link href="/campaigns" className="back-link">
        <IconArrowLeft size={18} /> Campanhas
      </Link>

      {isNew && (
        <div className="success-banner">
          <span className="success-banner-icon">
            <IconCheck size={16} strokeWidth={3} />
          </span>
          <span>
            <b>Campanha criada!</b> Agora adicione as pessoas que você quer alcançar.
          </span>
        </div>
      )}

      <header className="stack" style={{ gap: 10 }}>
        <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <div className="stack" style={{ gap: 8, minWidth: 0 }}>
            <CampaignStatus status={campaign.status} />
            <h1 className="display page-title" style={{ overflowWrap: "anywhere" }}>
              {campaign.name}
            </h1>
          </div>
          <CampaignMenu id={campaign.id} name={campaign.name} status={campaign.status} leads={n.leads} />
        </div>
        {campaign.description && <p className="hero-sub" style={{ margin: 0 }}>{campaign.description}</p>}
      </header>

      <dl className="kpis">
        <div className="kpi-item">
          <dd>
            {n.leads}
            {campaign.maxLeads ? <small className="faint">/{campaign.maxLeads}</small> : null}
          </dd>
          <dt>Leads</dt>
        </div>
        <div className="kpi-item">
          <dd>{n.connected}</dd>
          <dt>Aceitaram</dt>
        </div>
        <div className="kpi-item">
          <dd>{n.rate === null ? "—" : `${n.rate}%`}</dd>
          <dt>Resposta</dt>
        </div>
        <div className="kpi-item">
          <dd>{n.qualified}</dd>
          <dt>Oportunidades</dt>
        </div>
      </dl>

      <p className="small muted row" style={{ gap: 6 }}>
        <IconRefresh size={15} /> Follow-up:{" "}
        {campaign.followUpMaxCount != null && campaign.followUpDelayHours != null
          ? describeRule(campaign.followUpMaxCount, campaign.followUpDelayHours)
          : `padrão da conta (${describeRule(settings.followUpMaxCount, settings.followUpDelayHours)})`}
        <Link href={`/campaigns/${campaign.id}/edit`} className="sec-link" style={{ color: "var(--brand)" }}>
          Alterar
        </Link>
      </p>

      {campaign.instructions && (
        <section className="offer-box">
          <span className="label">Oferta que a IA usa nas conversas</span>
          <p>{campaign.instructions}</p>
        </section>
      )}

      <section className="stack" style={{ gap: 8 }}>
        <div className="sec-head">
          <h2>Pessoas nesta campanha</h2>
          {active && !full ? (
            <Link href={`/prospect?campaign=${campaign.id}`} className="btn btn-primary btn-sm">
              <IconPlus size={16} /> Adicionar pessoas
            </Link>
          ) : (
            <span className="small faint">{full ? "Limite de leads atingido" : "Campanha pausada — reative pra adicionar"}</span>
          )}
        </div>
        {people.length === 0 ? (
          <p className="empty-line">Ninguém ainda. Quem você convidar aparece aqui, e a IA conversa com a oferta desta campanha.</p>
        ) : (
          <ul className="rows boxed">
            {people.map((c) => (
              <li key={c.id}>
                <ConversationRow c={c} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
