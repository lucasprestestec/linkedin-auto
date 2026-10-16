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
    <main className="page page-wide" style={{ "--c": "var(--a-camp)" } as React.CSSProperties}>
      <MobileHeader />
      <Link href="/campaigns" className="backlink">
        ← Campanhas
      </Link>
      <header className="area-head">
        <h1 className="area-title">
          <i className="area-sq" aria-hidden="true" />
          Nova campanha</h1>
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
