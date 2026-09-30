import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { campaignNumbers } from "@/lib/campaignStats";
import { MobileHeader } from "@/components/MobileHeader";
import { Help } from "@/components/Help";
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
      <header className="p-head">
        <div>
          <h1 className="t-title">
            Campanhas{" "}
            <Help>
              Cada campanha é um grupo de pessoas que você quer alcançar com uma oferta. É opcional: você também pode adicionar pessoas sem campanha. Use campanhas para separar
              ofertas diferentes; a secretária usa a oferta de cada uma na conversa.
            </Help>
          </h1>
          <p className="t-sub">Grupos de pessoas com uma oferta.</p>
        </div>
        <Link href="/campaigns/new" className="btn-solid btn-sm">
          Nova campanha
        </Link>
      </header>

      {campaigns.length === 0 ? (
        <section className="sec">
          <p className="empty">Nenhuma campanha ainda. Crie a primeira quando quiser separar ofertas diferentes.</p>
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
