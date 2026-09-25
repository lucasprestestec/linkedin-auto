import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { describeRule } from "@/lib/followupPolicy";
import { IconArrowLeft } from "@/components/Icons";
import { CampaignWizard } from "../CampaignWizard";
import { createCampaign } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewCampaignPage() {
  const settings = await prisma.settings.findUniqueOrThrow({ where: { id: "singleton" }, select: { followUpMaxCount: true, followUpDelayHours: true } });
  return (
    <main className="page wizard-page">
      <header className="wizard-head">
        <Link href="/campaigns" className="chat-back" aria-label="Voltar para Campanhas">
          <IconArrowLeft size={20} />
        </Link>
        <h1>Nova campanha</h1>
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
