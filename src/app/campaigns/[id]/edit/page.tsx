import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { describeRule } from "@/lib/followupPolicy";
import { IconArrowLeft } from "@/components/Icons";
import { CampaignWizard } from "../../CampaignWizard";
import { updateCampaign } from "../../actions";

export default async function EditCampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [c, settings] = await Promise.all([
    prisma.campaign.findUnique({ where: { id } }),
    prisma.settings.findUniqueOrThrow({ where: { id: "singleton" }, select: { followUpMaxCount: true, followUpDelayHours: true } }),
  ]);
  if (!c) notFound();
  return (
    <main className="page wizard-page">
      <header className="wizard-head">
        <Link href={`/campaigns/${id}`} className="chat-back" aria-label="Voltar para a campanha">
          <IconArrowLeft size={20} />
        </Link>
        <h1>Editar campanha</h1>
      </header>
      <CampaignWizard
        action={updateCampaign.bind(null, id)}
        cancelHref={`/campaigns/${id}`}
        submitLabel="Salvar alterações"
        accountFollowUp={describeRule(settings.followUpMaxCount, settings.followUpDelayHours)}
        initial={{
          name: c.name,
          description: c.description ?? "",
          audience: c.audience,
          instructions: c.instructions ?? "",
          maxLeads: c.maxLeads ? String(c.maxLeads) : "",
          followUp:
            c.followUpMaxCount != null && c.followUpDelayHours != null
              ? { count: c.followUpMaxCount, days: Math.max(1, Math.round(c.followUpDelayHours / 24)) }
              : null,
        }}
      />
    </main>
  );
}
