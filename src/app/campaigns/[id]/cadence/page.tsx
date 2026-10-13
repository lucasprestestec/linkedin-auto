import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { MobileHeader } from "@/components/MobileHeader";
import { CadenceEditor } from "./CadenceEditor";

export const dynamic = "force-dynamic";

export default async function CadencePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const campaign = await prisma.campaign.findUnique({ where: { id }, include: { steps: { orderBy: { position: "asc" } } } });
  if (!campaign) notFound();
  const initial = campaign.steps.find((s) => s.position === 0)?.text ?? "";
  const steps = campaign.steps.filter((s) => s.position > 0).map((s) => ({ day: s.day, channel: s.channel, text: s.text, notify: s.notify }));

  return (
    <main className="page">
      <MobileHeader />
      <Link href={`/campaigns/${id}`} className="btn-text" style={{ alignSelf: "flex-start" }}>
        ← {campaign.name}
      </Link>
      <header className="p-head">
        <div>
          <h1 className="t-title">Cadência</h1>
          <p className="t-sub">
            Textos aprovados que o assistente manda, no dia certo, pra quem ainda não respondeu. Saem exatamente como estão; quando a pessoa responde, a
            cadência para e o assistente conduz a conversa.
          </p>
        </div>
      </header>
      <CadenceEditor campaignId={id} initial={initial} steps={steps} />
    </main>
  );
}
