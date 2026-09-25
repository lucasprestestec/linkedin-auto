import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { campaignNumbers } from "@/lib/campaignStats";
import { remainingDailyInviteQuota } from "@/lib/prospect";
import { relativeTime } from "@/lib/format";
import { STATUS_LABEL, STATUS_TONE } from "@/lib/status";
import { Avatar } from "@/components/Avatar";
import { MobileHeader } from "@/components/MobileHeader";
import { IconArrowLeft, IconCheck, IconChevronRight, IconShield } from "@/components/Icons";
import { CampaignNumbers } from "../CampaignNumbers";
import { ProspectTabs } from "../ProspectTabs";
import { ProspectSearch } from "../ProspectSearch";
import { WarmSuggestions } from "../WarmSuggestions";
import { CampaignHeader } from "./CampaignHeader";

export const dynamic = "force-dynamic";

export default async function CampaignPage({ params, searchParams }: PageProps<"/campaigns/[id]">) {
  const { id } = await params;
  const isNew = (await searchParams).novo === "1";
  const [campaign, remaining, settings] = await Promise.all([
    prisma.campaign.findUnique({
      where: { id },
      include: {
        leads: {
          orderBy: { updatedAt: "desc" },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            jobTitle: true,
            status: true,
            updatedAt: true,
            messages: { select: { sender: true } },
          },
        },
      },
    }),
    remainingDailyInviteQuota(),
    prisma.settings.findUniqueOrThrow({ where: { id: "singleton" }, select: { dailyInviteLimit: true } }),
  ]);
  if (!campaign) notFound();

  const numbers = campaignNumbers(campaign.leads);
  const left = Math.max(0, remaining);

  return (
    <main className="page">
      <MobileHeader />
      <Link href="/campaigns" className="back-link">
        <IconArrowLeft size={18} /> Campanhas
      </Link>

      {isNew && (
        <div className="success-banner rise">
          <span className="success-banner-icon">
            <IconCheck size={18} strokeWidth={3} />
          </span>
          <span>
            <b>Campanha criada!</b> Agora escolha quem convidar logo abaixo.
          </span>
        </div>
      )}

      <CampaignHeader id={campaign.id} name={campaign.name} instructions={campaign.instructions ?? ""} leads={campaign.leads.length} />

      {campaign.leads.length > 0 && (
        <section className="card card-pad rise">
          <CampaignNumbers numbers={numbers} size="lg" />
        </section>
      )}

      <section className="stack rise" style={{ gap: 14 }} aria-labelledby="add-title">
        <div className="section-row" style={{ marginBottom: 0 }}>
          <h2 id="add-title">Adicionar pessoas</h2>
          <span className="quota-note">
            <IconShield size={14} /> {left > 0 ? `Hoje ainda dá pra convidar ${left}` : "Limite de convites de hoje atingido"}
            <span className="faint"> · máx. {settings.dailyInviteLimit}/dia</span>
          </span>
        </div>
        <ProspectTabs warm={<WarmSuggestions campaignId={campaign.id} />} search={<ProspectSearch campaignId={campaign.id} />} />
      </section>

      <section className="stack rise" style={{ gap: 12 }} aria-labelledby="people-title">
        <div className="section-row" style={{ marginBottom: 0 }}>
          <h2 id="people-title">Pessoas nesta campanha</h2>
          <span className="small faint">{campaign.leads.length}</span>
        </div>
        {campaign.leads.length === 0 ? (
          <p className="card card-pad small muted">Ninguém ainda. Quem você convidar aparece aqui — e a IA assume a conversa quando aceitarem.</p>
        ) : (
          <ul className="people-list card">
            {campaign.leads.map((l) => (
              <li key={l.id}>
                <Link href={`/leads/${l.id}`} className="people-row">
                  <Avatar firstName={l.firstName} lastName={l.lastName} size={42} status={STATUS_TONE[l.status]} />
                  <span className="stack" style={{ flex: 1, minWidth: 0 }}>
                    <b className="truncate">
                      {l.firstName} {l.lastName}
                    </b>
                    <span className="tiny faint truncate">{l.jobTitle ?? relativeTime(l.updatedAt)}</span>
                  </span>
                  <span className={`status-pill pill-${STATUS_TONE[l.status]}`} style={{ height: 28, fontSize: 12.5 }}>
                    {STATUS_LABEL[l.status]}
                  </span>
                  <IconChevronRight size={16} className="faint" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
