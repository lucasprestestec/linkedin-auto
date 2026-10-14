import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { MobileHeader } from "@/components/MobileHeader";
import { ImportForm } from "./ImportForm";

export const dynamic = "force-dynamic";

// Vários contatos de uma vez, a partir de uma planilha. Contato avulso continua em "Adicionar contato".
export default async function ImportContactsPage() {
  const campaigns = await prisma.campaign.findMany({ where: { status: "ACTIVE" }, orderBy: { name: "asc" }, select: { id: true, name: true } });
  return (
    <main className="page">
      <MobileHeader />
      <Link href="/contacts/new" className="btn-text" style={{ alignSelf: "flex-start" }}>
        ← Adicionar contato
      </Link>
      <header className="p-head">
        <div>
          <h1 className="t-title">Importar planilha</h1>
          <p className="t-sub">Vários contatos de uma vez. O sistema confere a planilha antes de salvar e não duplica quem já está nele.</p>
        </div>
      </header>
      <ImportForm campaigns={campaigns} />
    </main>
  );
}
