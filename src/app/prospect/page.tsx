import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { remainingDailyInviteQuota } from "@/lib/prospect";
import { MobileHeader } from "@/components/MobileHeader";
import { IconArrowLeft, IconShield } from "@/components/Icons";
import { AddPeople } from "./AddPeople";

export const dynamic = "force-dynamic";

export default async function AddPeoplePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const [campaigns, remaining, settings] = await Promise.all([
    prisma.campaign.findMany({ where: { status: "ACTIVE" }, orderBy: { name: "asc" }, select: { id: true, name: true, audience: true } }),
    remainingDailyInviteQuota(),
    prisma.settings.findUniqueOrThrow({ where: { id: "singleton" }, select: { dailyInviteLimit: true } }),
  ]);
  const wanted = typeof params.campaign === "string" ? params.campaign : "";
  const initialCampaignId = campaigns.some((c) => c.id === wanted) ? wanted : "";
  const left = Math.max(0, remaining);

  return (
    <main className="page">
      <MobileHeader />
      <Link href={initialCampaignId ? `/campaigns/${initialCampaignId}` : "/conversations"} className="back-link">
        <IconArrowLeft size={18} /> {initialCampaignId ? "Campanha" : "Conversas"}
      </Link>
      <header>
        <h1 className="display page-title">Adicionar pessoas</h1>
        <p className="hero-sub">Encontre pessoas no LinkedIn e convide. Quando aceitarem, a IA começa a conversa.</p>
        <p className="quota-note" style={{ marginTop: 10 }}>
          <IconShield size={14} /> {left > 0 ? `Hoje ainda dá pra convidar ${left} pessoas` : "Limite de convites de hoje atingido"}
          <span className="faint"> · máx. {settings.dailyInviteLimit}/dia</span>
        </p>
      </header>
      <AddPeople campaigns={campaigns} initialCampaignId={initialCampaignId} />
    </main>
  );
}
