import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { MobileHeader } from "@/components/MobileHeader";
import { emailEnabled } from "@/lib/email";
import { deskcommConfigOf } from "@/lib/deskcomm";
import { activeIdentityIdOrNull } from "@/lib/identity";
import { ContactForm } from "./ContactForm";

export const dynamic = "force-dynamic";

// Adicionar alguém que o corretor já conhece (indicação, evento, cliente
// antigo), com ou sem LinkedIn. Buscar gente nova continua em Prospectar.
export default async function NewContactPage() {
  const [settings, campaigns, email, identity] = await Promise.all([
    prisma.settings.findUniqueOrThrow({ where: { id: "singleton" } }),
    prisma.campaign.findMany({ where: { status: "ACTIVE" }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    emailEnabled(),
    activeIdentityIdOrNull(),
  ]);

  return (
    <main className="page">
      <MobileHeader />
      <Link href="/conversations" className="btn-text" style={{ alignSelf: "flex-start" }}>
        ← Conversas
      </Link>
      <header className="p-head">
        <div>
          <h1 className="t-title">Adicionar contato</h1>
          <p className="t-sub">
            Alguém que você já conhece ou que chegou por indicação. Precisa só do nome e de um jeito de falar com a pessoa. Quer encontrar gente nova?{" "}
            <Link href="/prospect" className="btn-text">
              Prospectar
            </Link>
          </p>
        </div>
      </header>
      <ContactForm
        campaigns={campaigns}
        ready={{ LINKEDIN: Boolean(identity) && !settings.linkedinNeedsReconnect, EMAIL: email, WHATSAPP: deskcommConfigOf(settings) !== null }}
      />
    </main>
  );
}
