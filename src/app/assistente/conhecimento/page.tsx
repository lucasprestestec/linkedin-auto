import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { approxTokens } from "@/lib/knowledge";
import { KnowledgeImport } from "./KnowledgeImport";
import { KnowledgeList } from "./KnowledgeList";
import { PickTester } from "./PickTester";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function KnowledgePage() {
  if (!(await getSession())) redirect("/login");

  const [sections, settings] = await Promise.all([
    prisma.knowledgeSection.findMany({ orderBy: { position: "asc" } }),
    prisma.settings.findUnique({ where: { id: "singleton" }, select: { assistantName: true } }),
  ]);
  const assistant = settings?.assistantName?.trim() || "";
  // "a Helena" / "a assistente": o nome entra sempre com artigo.
  const who = assistant ? `a ${assistant}` : "a assistente";
  const Who = assistant ? `A ${assistant}` : "A assistente";
  const alwaysChars = sections.filter((s) => s.mode === "ALWAYS").reduce((n, s) => n + s.content.length, 0);

  return (
    <main className="page">
      <Link href="/assistente" className="btn-text" style={{ alignSelf: "flex-start" }}>
        ← Assistente
      </Link>
      <header className="p-head">
        <div>
          <h1 className="t-title">O que {who} sabe</h1>
          <p className="t-sub">
            Tudo o que {who} diz sobre produtos, regras e textos aprovados vem destes temas. Se algo não estiver aqui, ela não afirma. Corrigiu um
            texto? Vale já na próxima mensagem.
          </p>
        </div>
      </header>

      {sections.length > 0 ? (
        <section className="sec">
          <KnowledgeList sections={sections.map((s) => ({ id: s.id, title: s.title, content: s.content, mode: s.mode }))} assistantName={assistant} />
        </section>
      ) : (
        <section className="sec">
          <h2 className="t-label">Nenhum tema ainda</h2>
          <p className="hint" style={{ margin: 0 }}>
            Importe o arquivo com o manual d{who} (em &quot;Opções avançadas&quot;, abaixo).
          </p>
        </section>
      )}

      <details className="sec know-adv-sec">
        <summary className="t-label">Opções avançadas</summary>
        <div className="stack" style={{ gap: 18, marginTop: 14 }}>
          <div className="stack" style={{ gap: 8 }}>
            <h2 className="t-label">Baixar uma cópia</h2>
            <p className="hint" style={{ margin: 0 }}>
              Guarda todos os temas num arquivo de texto. Faça isso antes de substituir tudo.
            </p>
            <a className="btn-line btn-sm" href="/api/export/knowledge" style={{ alignSelf: "flex-start" }}>
              Baixar cópia (.md)
            </a>
          </div>

          <div className="stack" style={{ gap: 8 }}>
            <h2 className="t-label">{sections.length ? "Substituir tudo por um arquivo" : "Importar o manual"}</h2>
            {sections.length > 0 && (
              <p className="note note-warn" style={{ margin: 0 }}>
                Isto apaga todos os temas de hoje, inclusive os que você corrigiu ou criou, e coloca os do arquivo. Baixe uma cópia antes.
              </p>
            )}
            <KnowledgeImport hasSections={sections.length > 0} />
          </div>

          {sections.length > 0 && (
            <div className="stack" style={{ gap: 8 }}>
              <h2 className="t-label">Testar uma pergunta</h2>
              <p className="hint" style={{ margin: 0 }}>
                Escreva uma pergunta de cliente e veja quais temas {who} usaria para responder, além dos que ela sempre considera.
              </p>
              <PickTester />
            </div>
          )}

          <p className="hint" style={{ margin: 0 }}>
            Os temas que {who} sempre considera somam {(alwaysChars / 1000).toFixed(1)} mil caracteres
            {approxTokens(alwaysChars) > 15000 ? `. Está grande: ${Who} fica mais lenta e se perde mais. Deixe os textos longos em "Só quando o assunto aparecer".` : "."}
          </p>
        </div>
      </details>
    </main>
  );
}
