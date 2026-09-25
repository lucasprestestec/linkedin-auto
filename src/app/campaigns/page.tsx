import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { campaignNumbers } from "@/lib/campaignStats";
import { MobileHeader } from "@/components/MobileHeader";
import { IconMegaphone, IconPlus } from "@/components/Icons";
import { CampaignsView } from "./CampaignsView";

export const dynamic = "force-dynamic";

export default async function CampaignsPage() {
  const campaigns = await prisma.campaign.findMany({
    orderBy: { createdAt: "desc" },
    include: { leads: { select: { status: true, messages: { select: { sender: true } } } } },
  });

  return (
    <main className="page">
      <MobileHeader />
      <header className="row page-head" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 320px" }}>
          <h1 className="display page-title">Campanhas</h1>
          <p className="hero-sub">Cada campanha é um grupo de pessoas que você quer alcançar com uma oferta. É opcional — você também pode adicionar pessoas sem campanha.</p>
        </div>
        <Link href="/campaigns/new" className="btn btn-primary new-camp-btn">
          <IconPlus size={17} strokeWidth={2.4} /> Nova campanha
        </Link>
      </header>

      {campaigns.length === 0 ? (
        <section className="empty-hero">
          <span className="empty-hero-icon">
            <IconMegaphone size={28} />
          </span>
          <h2 className="title-md">Nenhuma campanha ainda</h2>
          <p className="small muted" style={{ maxWidth: 380 }}>
            Use campanhas pra separar ofertas diferentes (ex.: saúde empresarial e seguro de vida). A IA usa a oferta de cada uma na conversa.
          </p>
        </section>
      ) : (
        <CampaignsView
          campaigns={campaigns.map((c) => ({
            id: c.id,
            name: c.name,
            description: c.description,
            status: c.status,
            createdTs: c.createdAt.getTime(),
            numbers: campaignNumbers(c.leads),
          }))}
        />
      )}
    </main>
  );
}
