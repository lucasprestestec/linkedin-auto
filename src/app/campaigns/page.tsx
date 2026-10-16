import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { campaignNumbers } from "@/lib/campaignStats";
import { MobileHeader } from "@/components/MobileHeader";
import { CampaignsView } from "./CampaignsView";

export const dynamic = "force-dynamic";

export default async function CampaignsPage() {
  const campaigns = await prisma.campaign.findMany({
    orderBy: { createdAt: "desc" },
    include: { leads: { select: { status: true, messages: { select: { sender: true } } } } },
  });

  return (
    <main className="page page-wide" style={{ "--c": "var(--a-camp)" } as React.CSSProperties}>
      <MobileHeader />
      <header className="area-head">
        <div className="grow">
          <h1 className="area-title">
            <i className="area-sq" aria-hidden="true" />
            Campanhas
          </h1>
          <p className="area-sub">Cada campanha é um grupo de pessoas com uma oferta. O assistente usa a oferta de cada uma na conversa.</p>
        </div>
        <Link href="/campaigns/new" className="btn-solid">
          Nova campanha
        </Link>
      </header>

      {campaigns.length === 0 ? (
        <p className="done-note">Nenhuma campanha ainda. Crie a primeira quando quiser separar ofertas diferentes.</p>
      ) : (
        <CampaignsView
          campaigns={campaigns.map((c) => ({
            id: c.id,
            name: c.name,
            description: c.description,
            status: c.status,
            createdTs: c.createdAt.getTime(),
            since: c.createdAt.toLocaleDateString("pt-BR", { day: "numeric", month: "long", timeZone: "America/Sao_Paulo" }),
            numbers: campaignNumbers(c.leads),
          }))}
        />
      )}
    </main>
  );
}
