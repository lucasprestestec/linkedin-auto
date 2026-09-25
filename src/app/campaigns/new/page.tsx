import Link from "next/link";
import { IconArrowLeft } from "@/components/Icons";
import { CampaignWizard } from "../CampaignWizard";
import { createCampaign } from "../actions";

export default function NewCampaignPage() {
  return (
    <main className="page wizard-page">
      <header className="wizard-head">
        <Link href="/campaigns" className="chat-back" aria-label="Voltar para Campanhas">
          <IconArrowLeft size={20} />
        </Link>
        <h1>Nova campanha</h1>
      </header>
      <CampaignWizard action={createCampaign} cancelHref="/campaigns" submitLabel="Criar campanha" />
    </main>
  );
}
