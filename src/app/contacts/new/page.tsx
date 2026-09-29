import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { MobileHeader } from "@/components/MobileHeader";
import { IconArrowLeft, IconUserSearch } from "@/components/Icons";
import { emailEnabled } from "@/lib/email";
import { deskcommConfigOf } from "@/lib/deskcomm";
import { activeIdentityIdOrNull } from "@/lib/identity";
import { ContactForm } from "./ContactForm";

export const dynamic = "force-dynamic";

// Adicionar alguém que o corretor já conhece — indicação, evento, cliente
// antigo —, com ou sem LinkedIn. Buscar gente nova continua em Prospectar.
export default async function NewContactPage() {
  const [settings, campaigns, email, identity] = await Promise.all([
    prisma.settings.findUniqueOrThrow({ where: { id: "singleton" } }),
    prisma.campaign.findMany({ where: { status: "ACTIVE" }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    emailEnabled(),
    activeIdentityIdOrNull(),
  ]);

  return (
    <main className="page account">
      <MobileHeader />
      <Link href="/conversations" className="back-link">
        <IconArrowLeft size={18} /> Conversas
      </Link>
      <header className="page-hero rise">
        <h1 className="display page-title">
          Adicionar <span className="name-grad">contato.</span>
        </h1>
        <p className="hero-sub">Alguém que você já conhece ou que chegou por indicação. Precisa só do nome e de um jeito de falar com a pessoa.</p>
        <p className="small muted" style={{ marginTop: 8 }}>
          <IconUserSearch size={15} /> Quer encontrar gente nova no LinkedIn?{" "}
          <Link href="/prospect" className="link-btn brand">
            Prospectar
          </Link>
        </p>
      </header>
      <div className="account-col">
        <ContactForm
          campaigns={campaigns}
          ready={{ LINKEDIN: Boolean(identity) && !settings.linkedinNeedsReconnect, EMAIL: email, WHATSAPP: deskcommConfigOf(settings) !== null }}
        />
      </div>
    </main>
  );
}
