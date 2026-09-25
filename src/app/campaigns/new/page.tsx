import Link from "next/link";
import { IconArrowLeft } from "@/components/Icons";
import { MobileHeader } from "@/components/MobileHeader";
import { CampaignForm } from "../CampaignForm";
import { createCampaign } from "../actions";

export default function NewCampaignPage() {
  return (
    <main className="page">
      <MobileHeader />
      <Link href="/campaigns" className="back-link">
        <IconArrowLeft size={18} /> Campanhas
      </Link>
      <header className="page-hero rise">
        <h1 className="display page-title">
          Nova <span className="name-grad">campanha.</span>
        </h1>
        <p className="hero-sub">Duas perguntas rápidas. Depois você escolhe quem convidar.</p>
      </header>
      <section className="card card-pad rise narrow">
        <CampaignForm action={createCampaign} submitLabel="Criar e escolher pessoas" />
      </section>
    </main>
  );
}
