import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { remainingDailyInviteQuota } from "@/lib/prospect";
import { MobileHeader } from "@/components/MobileHeader";
import { Help } from "@/components/Help";
import { AddPeople } from "./AddPeople";
import { searchesLeftThisMonth, webSearchEnabled } from "@/lib/websearch";

export const dynamic = "force-dynamic";

export default async function AddPeoplePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const searchEnabled = webSearchEnabled();
  const [campaigns, remaining, settings, searchesLeft] = await Promise.all([
    prisma.campaign.findMany({ where: { status: "ACTIVE" }, orderBy: { name: "asc" }, select: { id: true, name: true, description: true, audience: true } }),
    remainingDailyInviteQuota(),
    prisma.settings.findUniqueOrThrow({ where: { id: "singleton" }, select: { dailyInviteLimit: true } }),
    searchEnabled ? searchesLeftThisMonth() : Promise.resolve(0),
  ]);
  const wanted = typeof params.campaign === "string" ? params.campaign : "";
  const initialCampaignId = campaigns.some((c) => c.id === wanted) ? wanted : "";
  const left = Math.max(0, remaining);

  return (
    <main className="page">
      <MobileHeader />
      {initialCampaignId && (
        <Link href={`/campaigns/${initialCampaignId}`} className="btn-text" style={{ alignSelf: "flex-start" }}>
          ← Campanha
        </Link>
      )}
      <header className="p-head">
        <div>
          <h1 className="t-title">Prospectar</h1>
          <p className="t-sub">
            Busque, marque quem te interessa e convide. Quando aceitarem, o assistente começa a conversa.{" "}
            <Help>O LinkedIn limita quantos convites uma conta pode mandar por dia. O sistema respeita esse limite para proteger sua conta.</Help>
          </p>
        </div>
      </header>

      <section className="sec">
        <div className="setting" style={{ padding: 0 }}>
          <span className="setting-text">
            <b>{left > 0 ? `Hoje ainda dá para convidar ${left} pessoas` : "Limite de convites de hoje atingido"}</b>
            <small>No máximo {settings.dailyInviteLimit} por dia</small>
          </span>
          <Link href="/contacts/new" className="btn-line btn-sm">
            Adicionar contato
          </Link>
        </div>
      </section>

      <AddPeople
        campaigns={campaigns.map(({ id, name, description }) => ({ id, name, description }))}
        initialCampaignId={initialCampaignId}
        initialKeywords={campaigns.find((c) => c.id === initialCampaignId)?.audience ?? []}
        invitesLeft={left}
        searchEnabled={searchEnabled}
        searchesLeft={searchesLeft}
      />
    </main>
  );
}
