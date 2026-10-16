import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { campaignNumbers, channelNumbers } from "@/lib/campaignStats";
import { getConversationItems } from "@/lib/conversations";
import { MobileHeader } from "@/components/MobileHeader";
import { CampaignStatus } from "@/components/CampaignStatus";
import { ConversationRow } from "@/components/ConversationRow";
import { describeRule } from "@/lib/followupPolicy";
import { CampaignMenu } from "../CampaignMenu";
import { reviewStateOf } from "@/lib/campaignReview";
import { describeCadence } from "@/lib/cadence";
import { ReleaseReviewButton } from "@/app/approvals/ReleaseReviewButton";

export const dynamic = "force-dynamic";

export default async function CampaignPage({ params, searchParams }: PageProps<"/campaigns/[id]">) {
  const { id } = await params;
  const isNew = (await searchParams).novo === "1";
  const [campaign, conversations, settings] = await Promise.all([
    prisma.campaign.findUnique({
      where: { id },
      include: { leads: { select: { status: true, linkedinConnected: true, invitedAt: true, phone: true, doNotContact: true, messages: { select: { sender: true, channel: true, openCount: true } } } }, steps: { orderBy: { position: "asc" } } },
    }),
    getConversationItems(),
    prisma.settings.findUniqueOrThrow({ where: { id: "singleton" }, select: { followUpMaxCount: true, followUpDelayHours: true, campaignReview: true, campaignReviewDays: true, campaignReviewMessages: true } }),
  ]);
  if (!campaign) notFound();

  const n = campaignNumbers(campaign.leads);
  const ch = channelNumbers(campaign.leads);
  const review = await reviewStateOf(campaign, settings);
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

      {review.inReview && (
        <div className="note note-warn row" style={{ justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <span>
            <b>Campanha em revisão.</b> Tudo o que o assistente escrever nela passa pela sua aprovação até {review.messages} mensagens (
            {Math.min(review.sent, review.messages)} até agora) e pelo menos até{" "}
            {review.until.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" })}.
          </span>
          <ReleaseReviewButton campaignId={campaign.id} name={campaign.name} />
        </div>
      )}

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
          <h2 className="t-label">Por canal</h2>
        </div>
        <dl className="kv" style={{ gridTemplateColumns: "110px 1fr" }}>
          <dt>E-mail</dt>
          <dd>
            {ch.email.sent} enviados · {ch.email.opened} abriram · {ch.email.replied} responderam · {ch.email.optedOut} pediram para sair
          </dd>
          <dt>LinkedIn</dt>
          <dd>
            {ch.linkedin.added} adicionados · {ch.linkedin.accepted} aceitaram · {ch.linkedin.replied} responderam
          </dd>
          <dt>WhatsApp</dt>
          <dd>
            {ch.whatsapp.have} têm WhatsApp · {ch.whatsapp.replied} responderam
          </dd>
        </dl>
        <p className="small muted">Conta pessoas, uma vez cada. A abertura do e-mail é um sinal aproximado: alguns aplicativos abrem sozinhos e outros bloqueiam a imagem.</p>
      </section>

      <section className="sec">
        <div className="sec-head">
          <h2 className="t-label">Como o assistente conduz</h2>
          <Link href={`/campaigns/${campaign.id}/edit`} className="btn-text">
            Alterar
          </Link>
        </div>
        <dl className="kv" style={{ gridTemplateColumns: "130px 1fr" }}>
          <dt>Cadência</dt>
          <dd>
            {campaign.steps.length
              ? `${describeCadence(campaign.steps.some((st) => st.position === 0) ? campaign.steps : [{ day: 0, position: 0 }, ...campaign.steps])} · texto fixo pra quem não respondeu`
              : "sem cadência fixa: o assistente escreve as retomadas"}{" "}
            <Link href={`/campaigns/${campaign.id}/cadence`} className="btn-text">
              {campaign.steps.length ? "Editar" : "Montar"}
            </Link>
          </dd>
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
            <Link href={`/contacts?campaign=${campaign.id}`} className="btn-solid btn-sm">
              Adicionar pessoas
            </Link>
          ) : (
            <span className="hint" style={{ margin: 0 }}>{full ? "Limite atingido" : "Campanha pausada. Reative para adicionar."}</span>
          )}
        </div>
        {people.length === 0 ? (
          <p className="empty">Ninguém ainda. Quem você convidar aparece aqui, e o assistente conversa com a oferta desta campanha.</p>
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
