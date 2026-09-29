import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { remainingDailyInviteQuota } from "@/lib/prospect";
import { MobileHeader } from "@/components/MobileHeader";
import { IconArrowLeft, IconShield } from "@/components/Icons";
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
        <Link href={`/campaigns/${initialCampaignId}`} className="back-link">
          <IconArrowLeft size={18} /> Campanha
        </Link>
      )}
      <header>
        <h1 className="display page-title">Prospectar</h1>
        <p className="hero-sub">Busque, marque quem te interessa e convide. Quando aceitarem, a IA começa a conversa.</p>
        <p className="quota-note" style={{ marginTop: 10 }}>
          <IconShield size={14} /> {left > 0 ? `Hoje ainda dá pra convidar ${left} pessoas` : "Limite de convites de hoje atingido"}
          <span className="faint"> · máx. {settings.dailyInviteLimit}/dia</span>
        </p>
        <p className="small muted" style={{ marginTop: 6 }}>
          Já conhece a pessoa (indicação, evento, cliente)?{" "}
          <Link href="/contacts/new" className="link-btn brand">
            Adicionar contato
          </Link>
        </p>
      </header>
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
