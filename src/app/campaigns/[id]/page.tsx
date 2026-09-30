import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { campaignNumbers } from "@/lib/campaignStats";
import { getConversationItems } from "@/lib/conversations";
import { MobileHeader } from "@/components/MobileHeader";
import { CampaignStatus } from "@/components/CampaignStatus";
import { ConversationRow } from "@/components/ConversationRow";
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

  const stats = [
    { value: `${n.leads}${campaign.maxLeads ? `/${campaign.maxLeads}` : ""}`, label: "Pessoas" },
    { value: n.connected, label: "Aceitaram" },
    { value: n.rate === null ? "—" : `${n.rate}%`, label: "Responderam" },
    { value: n.qualified, label: "Oportunidades" },
  ];

  return (
    <main className="page">
      <MobileHeader />
      <Link href="/campaigns" className="btn-text" style={{ alignSelf: "flex-start" }}>
        ← Campanhas
      </Link>

      {isNew && (
        <p className="note note-ok">
          <b>Campanha criada.</b> Agora adicione as pessoas que você quer alcançar.
        </p>
      )}

      <header className="p-head">
        <div className="stack" style={{ gap: 8 }}>
          <span>
            <CampaignStatus status={campaign.status} />
          </span>
          <h1 className="t-title" style={{ overflowWrap: "anywhere" }}>
            {campaign.name}
          </h1>
          {campaign.description && <p className="t-sub" style={{ margin: 0 }}>{campaign.description}</p>}
        </div>
        <CampaignMenu id={campaign.id} name={campaign.name} status={campaign.status} leads={n.leads} />
      </header>

      <div className="h-stats">
        {stats.map((s) => (
          <div key={s.label} className="h-stat">
            <b>{s.value}</b>
            <span>{s.label}</span>
          </div>
        ))}
      </div>

      <section className="sec">
        <div className="sec-head">
          <h2 className="t-label">Como a secretária conduz</h2>
          <Link href={`/campaigns/${campaign.id}/edit`} className="btn-text">
            Alterar
          </Link>
        </div>
        <dl className="kv" style={{ gridTemplateColumns: "130px 1fr" }}>
          <dt>Acompanhamento</dt>
          <dd>
            {campaign.followUpMaxCount != null && campaign.followUpDelayHours != null
              ? describeRule(campaign.followUpMaxCount, campaign.followUpDelayHours)
              : `padrão da conta (${describeRule(settings.followUpMaxCount, settings.followUpDelayHours)})`}
          </dd>
          {campaign.instructions && (
            <>
              <dt>Oferta</dt>
              <dd style={{ whiteSpace: "pre-line" }}>{campaign.instructions}</dd>
            </>
          )}
        </dl>
      </section>

      <section className="sec">
        <div className="sec-head">
          <h2 className="t-label">Pessoas nesta campanha</h2>
          {active && !full ? (
            <Link href={`/prospect?campaign=${campaign.id}`} className="btn-solid btn-sm">
              Adicionar pessoas
            </Link>
          ) : (
            <span className="hint" style={{ margin: 0 }}>{full ? "Limite atingido" : "Campanha pausada. Reative para adicionar."}</span>
          )}
        </div>
        {people.length === 0 ? (
          <p className="empty">Ninguém ainda. Quem você convidar aparece aqui, e a secretária conversa com a oferta desta campanha.</p>
        ) : (
          <ul className="list">
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
