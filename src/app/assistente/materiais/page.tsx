import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { MAX_TOTAL_BYTES, formatSize, materialUrl } from "@/lib/materials";
import { MaterialForm } from "./MaterialForm";
import { MaterialList } from "./MaterialList";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function MaterialsPage() {
  if (!(await getSession())) redirect("/login");
  // O arquivo em si (data) fica de fora: a lista só precisa dos dados.
  const items = await prisma.material.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true, whenToUse: true, kind: true, url: true, fileName: true, size: true, token: true, active: true, opens: true, lastOpenAt: true },
  });
  const base = process.env.APP_URL?.replace(/\/$/, "") ?? "";
  const used = items.reduce((n, m) => n + m.size, 0);

  return (
    <main className="page">
      <Link href="/settings" className="btn-text" style={{ alignSelf: "flex-start" }}>
        ← Ajustes
      </Link>
      <header className="p-head">
        <div>
          <h1 className="t-title">Materiais</h1>
          <p className="t-sub">
            Apresentações, tabelas, folders e links que você manda aos clientes. Na conversa, escolha o material e o endereço entra na mensagem. Você vê quantas vezes foi aberto.
          </p>
        </div>
      </header>

      {!base && <p className="field-error">O endereço do sistema (APP_URL) não está configurado: não dá para montar os links dos materiais.</p>}

      <section className="sec">
        <h2 className="t-label">Novo material</h2>
        <MaterialForm />
      </section>

      <section className="sec">
        <h2 className="t-label">Seus materiais ({items.length})</h2>
        {items.length === 0 ? (
          <p className="hint" style={{ margin: 0 }}>
            Nenhum ainda.
          </p>
        ) : (
          <MaterialList
            items={items.map((m) => ({
              id: m.id,
              title: m.title,
              whenToUse: m.whenToUse ?? "",
              kind: m.kind as "FILE" | "LINK",
              detail: m.kind === "LINK" ? (m.url ?? "") : `${m.fileName ?? "arquivo"} · ${formatSize(m.size)}`,
              link: base ? materialUrl(base, m.token) : null,
              active: m.active,
              opens: m.opens,
              lastOpenAt: m.lastOpenAt ? m.lastOpenAt.toISOString() : null,
            }))}
          />
        )}
        {used > 0 && (
          <p className="hint" style={{ margin: 0 }}>
            Espaço usado pelos arquivos: {formatSize(used)} de {formatSize(MAX_TOTAL_BYTES)}.
          </p>
        )}
      </section>
    </main>
  );
}
