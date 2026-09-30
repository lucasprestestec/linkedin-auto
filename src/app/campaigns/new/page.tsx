import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { describeRule } from "@/lib/followupPolicy";
import { MobileHeader } from "@/components/MobileHeader";
import { CampaignWizard } from "../CampaignWizard";
import { createCampaign } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewCampaignPage() {
  const settings = await prisma.settings.findUniqueOrThrow({ where: { id: "singleton" }, select: { followUpMaxCount: true, followUpDelayHours: true } });
  return (
    <main className="page">
      <MobileHeader />
      <Link href="/campaigns" className="btn-text" style={{ alignSelf: "flex-start" }}>
        ← Campanhas
      </Link>
      <header className="p-head">
        <h1 className="t-title">Nova campanha</h1>
      </header>
      <CampaignWizard
        action={createCampaign}
        cancelHref="/campaigns"
        submitLabel="Criar campanha"
        accountFollowUp={describeRule(settings.followUpMaxCount, settings.followUpDelayHours)}
      />
    </main>
  );
}
