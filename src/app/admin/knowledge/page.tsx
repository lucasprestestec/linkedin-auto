import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { adminEnabled, isAdmin } from "@/lib/admin";
import { approxTokens } from "@/lib/knowledge";
import { IconArrowLeft } from "@/components/Icons";
import { KnowledgeImport } from "./KnowledgeImport";
import { KnowledgeList } from "./KnowledgeList";
import { PickTester } from "./PickTester";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function KnowledgePage() {
  if (!adminEnabled()) notFound();
  if (!(await isAdmin())) redirect("/admin");

  const sections = await prisma.knowledgeSection.findMany({ orderBy: { position: "asc" } });
  const size = (mode: string) => sections.filter((s) => s.mode === mode).reduce((n, s) => n + s.content.length, 0);
  const always = size("ALWAYS");
  const onDemand = size("ON_DEMAND");
  const off = sections.filter((s) => s.mode === "OFF").length;

  return (
    <main className="page">
      <Link href="/admin" className="back-link">
        <IconArrowLeft size={18} /> Admin
      </Link>
      <header className="page-hero">
        <h1 className="display page-title">
          Base de <span className="name-grad">conhecimento.</span>
        </h1>
        <p className="hero-sub">
          O manual da assistente, dividido em seções. &quot;Sempre&quot; entra em toda mensagem; &quot;Sob demanda&quot; entra só quando o assunto aparece na
          conversa (um modelo rápido escolhe até 4); &quot;Desligada&quot; fica guardada.
        </p>
      </header>

      {sections.length > 0 && (
        <section className="kb-summary card card-pad">
          <div>
            <b>{sections.length}</b>
            <span className="tiny faint">seções</span>
          </div>
          <div>
            <b>~{approxTokens(always).toLocaleString("pt-BR")}</b>
            <span className="tiny faint">tokens sempre ({(always / 1000).toFixed(1)} mil caracteres)</span>
          </div>
          <div>
            <b>{(onDemand / 1000).toFixed(1)} mil</b>
            <span className="tiny faint">caracteres sob demanda</span>
          </div>
          <div>
            <b>{off}</b>
            <span className="tiny faint">desligadas</span>
          </div>
          {approxTokens(always) > 15000 && (
            <p className="tiny" style={{ gridColumn: "1 / -1", color: "var(--warn-ink, #b7791f)" }}>
              O núcleo está grande: cada mensagem fica mais cara e o modelo se perde mais. Passe seções longas para &quot;Sob demanda&quot;.
            </p>
          )}
        </section>
      )}

      <div className="settings-grid" style={{ marginTop: 16 }}>
        <div className="settings-col">
          <section className="group">
            <h2 className="group-title">{sections.length ? "Seções" : "Nenhuma seção ainda"}</h2>
            {sections.length > 0 ? (
              <KnowledgeList sections={sections.map((s) => ({ id: s.id, title: s.title, content: s.content, mode: s.mode }))} />
            ) : (
              <p className="tiny faint" style={{ padding: "0 4px" }}>
                Importe o arquivo da base (.md). Cada título &quot;# &quot; vira uma seção; seções longas são divididas pelos &quot;## &quot;.
              </p>
            )}
          </section>
        </div>
        <div className="settings-col">
          <section className="group">
            <h2 className="group-title">{sections.length ? "Substituir a base" : "Importar a base"}</h2>
            <KnowledgeImport hasSections={sections.length > 0} />
          </section>
          {sections.length > 0 && (
            <section className="group">
              <h2 className="group-title">Testar a escolha</h2>
              <PickTester />
            </section>
          )}
        </div>
      </div>
    </main>
  );
}
