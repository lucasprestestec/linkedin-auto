import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { campaignNumbers } from "@/lib/campaignStats";
import { shortDate } from "@/lib/format";
import { MobileHeader } from "@/components/MobileHeader";
import { IconArrowRight, IconMegaphone, IconPlus } from "@/components/Icons";
import { CampaignNumbers } from "./CampaignNumbers";

export const dynamic = "force-dynamic";

export default async function CampaignsPage() {
  const campaigns = await prisma.campaign.findMany({
    orderBy: { createdAt: "desc" },
    include: { leads: { select: { status: true, messages: { select: { sender: true } } } } },
  });

  return (
    <main className="page">
      <MobileHeader />
      <header className="page-hero rise row" style={{ justifyContent: "space-between", alignItems: "flex-end", gap: 16, flexWrap: "wrap" }}>
        <div>
          <h1 className="display page-title">
            Campa<span className="name-grad">nhas.</span>
          </h1>
          <p className="hero-sub">Cada campanha é um grupo de pessoas que você quer alcançar com uma oferta. A IA convida e conversa por você.</p>
        </div>
        {campaigns.length > 0 && (
          <Link href="/campaigns/new" className="btn btn-primary btn-pill">
            <IconPlus size={18} strokeWidth={2.4} /> Nova campanha
          </Link>
        )}
      </header>

      {campaigns.length === 0 ? (
        <section className="card empty-hero rise">
          <span className="empty-hero-icon">
            <IconMegaphone size={30} />
          </span>
          <h2 className="title-lg">Crie sua primeira campanha</h2>
          <p className="muted" style={{ maxWidth: 420 }}>
            Você diz o que quer oferecer e escolhe quem convidar. A partir daí, a IA manda os convites, abre a conversa e te chama quando
            alguém se interessar.
          </p>
          <ol className="how-steps">
            <li>
              <b>1</b> Dê um nome e diga o que oferecer
            </li>
            <li>
              <b>2</b> Escolha as pessoas no LinkedIn
            </li>
            <li>
              <b>3</b> Pronto — a IA cuida do resto
            </li>
          </ol>
          <Link href="/campaigns/new" className="btn btn-primary btn-lg">
            <IconPlus size={18} strokeWidth={2.4} /> Criar campanha
          </Link>
        </section>
      ) : (
        <div className="camp-grid">
          {campaigns.map((c, i) => (
            <Link key={c.id} href={`/campaigns/${c.id}`} className="card camp-card rise" style={{ "--i": i } as React.CSSProperties}>
              <div className="row" style={{ gap: 12, alignItems: "flex-start" }}>
                <span className={`camp-icon tone-${["lav", "peach", "cream", "pink"][i % 4]}`}>
                  <IconMegaphone size={20} />
                </span>
                <div className="stack" style={{ flex: 1, minWidth: 0, gap: 2 }}>
                  <h2 className="camp-name">{c.name}</h2>
                  <span className="tiny faint">Criada em {shortDate(c.createdAt)}</span>
                </div>
                <IconArrowRight size={18} className="faint" />
              </div>
              {c.instructions && <p className="camp-offer">{c.instructions}</p>}
              <CampaignNumbers numbers={campaignNumbers(c.leads)} />
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
