import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { campaignNumbers, channelNumbers } from "@/lib/campaignStats";
import { getConversationItems } from "@/lib/conversations";
import { MobileHeader } from "@/components/MobileHeader";
import { CampaignStatus } from "@/components/CampaignStatus";
import { Avatar } from "@/components/Avatar";
import { CHANNELS, ChannelBadge } from "@/components/ChannelBadge";
import { IconArrowRight } from "@/components/Icons";
import { STATUS_LABEL } from "@/lib/status";
import { describeRule } from "@/lib/followupPolicy";
import { CampaignMenu } from "../CampaignMenu";
import { reviewStateOf } from "@/lib/campaignReview";
import { ReleaseReviewButton } from "@/app/approvals/ReleaseReviewButton";

export const dynamic = "force-dynamic";

const STAGE: Partial<Record<string, string>> = { NEEDS_HUMAN: "s-you", QUALIFIED: "s-ok", MEETING_SCHEDULED: "s-meet" };

const clip = (t: string) => (t.length > 140 ? `${t.slice(0, 140).trimEnd()}…` : t);

// Uma campanha: números no painel, como o assistente conduz (cadência), quem está nela, a oferta e o público.
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


  const board = [
    { value: n.leads, label: "Pessoas", note: campaign.maxLeads ? `de ${campaign.maxLeads} no máximo` : "sem limite" },
    { value: n.connected, label: "Aceitaram", note: "o convite ou o contato" },
    { value: n.replied, label: "Responderam", note: n.rate === null ? "ninguém contatado ainda" : `${n.rate}% de resposta` },
    { value: n.qualified, label: "Oportunidades", note: "mostraram interesse", hot: true },
    { value: n.meetings, label: "Reuniões", note: "marcadas" },
  ];

  // A cadência mostra sempre o primeiro contato (D0), mesmo quando ele é escrito pelo assistente.
  const steps = campaign.steps.some((s) => s.position === 0) ? campaign.steps : [{ id: "d0", position: 0, day: 0, channel: null, text: "", notify: false }, ...campaign.steps];

  return (
    <main className="page page-wide" style={{ "--c": "var(--a-camp)" } as React.CSSProperties}>
      <MobileHeader />
      <Link href="/campaigns" className="backlink">
        ← Campanhas
      </Link>

      {isNew && (
        <p className="note note-ok">
          <b>Campanha criada.</b> Agora adicione as pessoas que você quer alcançar.
        </p>
      )}

      <header className="area-head">
        <div className="grow">
          <h1 className="area-title" style={{ overflowWrap: "anywhere" }}>
            <i className="area-sq" aria-hidden="true" />
            {campaign.name}
          </h1>
          <p className="area-sub">
            <CampaignStatus status={campaign.status} /> {campaign.description}
          </p>
        </div>
        <div className="row-act">
          {active && !full ? (
            <Link href={`/contacts?campaign=${campaign.id}`} className="btn-solid">
              Adicionar pessoas
            </Link>
          ) : (
            <span className="cap-note">{full ? "Limite de pessoas atingido" : "Campanha pausada. Reative para adicionar."}</span>
          )}
          <CampaignMenu id={campaign.id} name={campaign.name} status={campaign.status} leads={n.leads} />
        </div>
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

      <section className="board" aria-label="Números da campanha">
        {board.map((b) => (
          <div key={b.label} className={`board-col${b.hot ? " hot" : ""}`}>
            <span className="board-lbl">{b.label}</span>
            <span className="board-num">{b.value}</span>
            <span className="board-note">{b.note}</span>
          </div>
        ))}
      </section>

      <div className="split">
        <div className="stack" style={{ gap: 28 }}>
          <section aria-labelledby="h-cad">
            <h2 className="h2" id="h-cad" style={{ marginBottom: 6 }}>
              Como o assistente conduz
            </h2>
            <p className="cap-note" style={{ marginBottom: 12 }}>
              {campaign.steps.length ? "Textos aprovados que saem no dia certo para quem ainda não respondeu." : "Sem cadência fixa: o assistente escreve as retomadas."}
            </p>
            <ol className="cadence">
              {steps.map((s) => (
                <li key={s.id}>
                  <span className="dday">{s.day === 0 ? "D0" : `D+${s.day}`}</span>
                  <span className="row" style={{ gap: 6 }}>
                    {s.channel ? (
                      <>
                        <ChannelBadge channel={s.channel} size={18} />
                        {CHANNELS[s.channel].label}
                      </>
                    ) : s.position === 0 ? (
                      "Canal da pessoa"
                    ) : (
                      "Mesmo canal"
                    )}
                  </span>
                  <span className="cad-txt">
                    {s.text ? clip(s.text) : "Primeira mensagem, escrita pelo assistente a partir da oferta"}
                    {s.notify && <b> · você recebe um aviso (ex.: hora de ligar)</b>}
                  </span>
                </li>
              ))}
            </ol>
            <dl className="kv" style={{ gridTemplateColumns: "130px 1fr", marginTop: 12 }}>
              <dt>Acompanhamento</dt>
              <dd>
                {campaign.followUpMaxCount != null && campaign.followUpDelayHours != null
                  ? describeRule(campaign.followUpMaxCount, campaign.followUpDelayHours)
                  : `padrão da conta (${describeRule(settings.followUpMaxCount, settings.followUpDelayHours)})`}
              </dd>
            </dl>
            <div className="row wrap" style={{ gap: 18, marginTop: 12 }}>
              <Link href={`/campaigns/${campaign.id}/cadence`} className="link-arrow">
                {campaign.steps.length ? "Editar cadência" : "Montar cadência"} <IconArrowRight size={16} />
              </Link>
              <Link href={`/campaigns/${campaign.id}/edit`} className="link-arrow">
                Editar campanha <IconArrowRight size={16} />
              </Link>
            </div>
          </section>

          <section aria-labelledby="h-people">
            <h2 className="h2" id="h-people">
              Pessoas nesta campanha
            </h2>
            {people.length === 0 ? (
              <p className="empty">Ninguém ainda. Quem você convidar aparece aqui, e o assistente conversa com a oferta desta campanha.</p>
            ) : (
              <div className="table-wrap">
                <table className="tbl" style={{ minWidth: 520 }}>
                  <thead>
                    <tr>
                      <th>Pessoa</th>
                      <th>Situação</th>
                      <th>Canal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {people.map((p) => (
                      <tr key={p.id}>
                        <td>
                          <Link href={`/leads/${p.id}`} className="tbl-person">
                            <Avatar firstName={p.firstName} lastName={p.lastName} photoUrl={p.avatarUrl} size={32} />
                            <span className="n">{[p.firstName, p.lastName].filter(Boolean).join(" ") || "Contato"}</span>
                          </Link>
                        </td>
                        <td>
                          <span className={`stage ${STAGE[p.status] ?? ""}`}>
                            <i aria-hidden="true" />
                            {STATUS_LABEL[p.status]}
                          </span>
                        </td>
                        <td>
                          {p.channel ? (
                            <span className="row" style={{ gap: 6 }}>
                              <ChannelBadge channel={p.channel} size={18} />
                              {CHANNELS[p.channel].label}
                            </span>
                          ) : (
                            <span className="muted">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>

        <aside className="side-col" aria-label="Sobre a campanha">
          <section className="panel">
            <h2 className="panel-h">Oferta</h2>
            {campaign.instructions ? <p style={{ whiteSpace: "pre-line" }}>{campaign.instructions}</p> : <p className="muted small">Sem oferta escrita. O assistente usa a descrição da campanha.</p>}
          </section>

          <section className="panel">
            <h2 className="panel-h">Por canal</h2>
            <dl className="kv" style={{ gridTemplateColumns: "80px 1fr" }}>
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
            <p className="small muted" style={{ marginTop: 8 }}>
              Conta pessoas, uma vez cada. A abertura do e-mail é um sinal aproximado: alguns aplicativos abrem sozinhos e outros bloqueiam a imagem.
            </p>
          </section>

          <section className="panel">
            <h2 className="panel-h">Público-alvo</h2>
            {campaign.audience.length > 0 ? (
              <div className="row wrap" style={{ gap: 6 }}>
                {campaign.audience.map((a) => (
                  <span key={a} className="chip chip-static">
                    {a}
                  </span>
                ))}
              </div>
            ) : (
              <p className="muted small">Nenhum termo definido.</p>
            )}
            <p className="small muted" style={{ marginTop: 10 }}>
              Já vem preenchido na busca quando você adiciona pessoas a esta campanha.{campaign.maxLeads ? ` Limite: ${campaign.maxLeads} pessoas.` : ""}
            </p>
          </section>
        </aside>
      </div>
    </main>
  );
}
