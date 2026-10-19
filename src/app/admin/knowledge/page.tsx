import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { adminVisible, isAdmin } from "@/lib/admin";
import { approxTokens } from "@/lib/knowledge";
import { KnowledgeImport } from "./KnowledgeImport";
import { KnowledgeList } from "./KnowledgeList";
import { PickTester } from "./PickTester";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function KnowledgePage() {
  if (!(await adminVisible())) notFound();
  if (!(await isAdmin())) redirect("/admin");

  const sections = await prisma.knowledgeSection.findMany({ orderBy: { position: "asc" } });
  const size = (mode: string) => sections.filter((s) => s.mode === mode).reduce((n, s) => n + s.content.length, 0);
  const always = size("ALWAYS");
  const onDemand = size("ON_DEMAND");
  const off = sections.filter((s) => s.mode === "OFF").length;

  return (
    <main className="page">
      <Link href="/admin" className="btn-text" style={{ alignSelf: "flex-start" }}>
        ← Admin
      </Link>
      <header className="p-head">
        <div>
          <h1 className="t-title">Base de conhecimento</h1>
          <p className="t-sub">
            O manual da assistente, dividido em seções. &quot;Sempre&quot; entra em toda mensagem; &quot;Sob demanda&quot; entra só quando o assunto aparece na
            conversa (um modelo rápido escolhe até 4); &quot;Desligada&quot; fica guardada.
          </p>
        </div>
      </header>

      {sections.length > 0 && (
        <section className="sec know-summary">
          <div>
            <b>{sections.length}</b>
            <small>seções</small>
          </div>
          <div>
            <b>~{approxTokens(always).toLocaleString("pt-BR")}</b>
            <small>tokens em toda mensagem ({(always / 1000).toFixed(1)} mil caracteres)</small>
          </div>
          <div>
            <b>{(onDemand / 1000).toFixed(1)} mil</b>
            <small>caracteres sob demanda</small>
          </div>
          <div>
            <b>{off}</b>
            <small>desligadas</small>
          </div>
          {approxTokens(always) > 15000 && (
            <p className="note note-warn" style={{ gridColumn: "1 / -1", margin: 0 }}>
              O núcleo está grande: cada mensagem fica mais cara e o modelo se perde mais. Passe seções longas para &quot;Sob demanda&quot;.
            </p>
          )}
        </section>
      )}

      <div className="know-layout">
        <section className="sec">
          <h2 className="t-label">{sections.length ? "Seções" : "Nenhuma seção ainda"}</h2>
          {sections.length > 0 ? (
            <KnowledgeList sections={sections.map((s) => ({ id: s.id, title: s.title, content: s.content, mode: s.mode }))} />
          ) : (
            <p className="hint" style={{ margin: 0 }}>
              Importe o arquivo da base (.md). Cada título &quot;# &quot; vira uma seção; seções longas são divididas pelos &quot;## &quot;.
            </p>
          )}
        </section>
        <div className="stack" style={{ gap: 16 }}>
          <section className="sec">
            <h2 className="t-label">{sections.length ? "Substituir a base" : "Importar a base"}</h2>
            <KnowledgeImport hasSections={sections.length > 0} />
          </section>
          {sections.length > 0 && (
            <section className="sec">
              <div className="setting-text">
                <h2 className="t-label">Testar a escolha</h2>
                <small>Quais seções &quot;sob demanda&quot; entrariam para uma mensagem de exemplo.</small>
              </div>
              <PickTester />
            </section>
          )}
        </div>
      </div>
    </main>
  );
}
