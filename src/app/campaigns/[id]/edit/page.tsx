import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { IconArrowLeft } from "@/components/Icons";
import { CampaignWizard } from "../../CampaignWizard";
import { updateCampaign } from "../../actions";

export default async function EditCampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await prisma.campaign.findUnique({ where: { id } });
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
        initial={{
          name: c.name,
          description: c.description ?? "",
          audience: c.audience,
          instructions: c.instructions ?? "",
          maxLeads: c.maxLeads ? String(c.maxLeads) : "",
        }}
      />
    </main>
  );
}
