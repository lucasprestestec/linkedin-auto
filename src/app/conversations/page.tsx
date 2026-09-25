import Link from "next/link";
import { getConversationItems } from "@/lib/conversations";
import { MobileHeader } from "@/components/MobileHeader";
import { ConversationList } from "@/components/ConversationList";
import { IconMessages, IconPlus } from "@/components/Icons";

export const dynamic = "force-dynamic";

export default async function ConversationsPage({ searchParams }: PageProps<"/conversations">) {
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q : "";
  const status = typeof params.status === "string" ? params.status : "";
  const items = await getConversationItems();

  return (
    <div className="conv-layout">
      {/* Celular: página com título; computador: coluna da lista + área do chat vazia. */}
      <main className="page conv-page">
        <MobileHeader />
        <header className="only-mobile">
          <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-end", gap: 12 }}>
            <h1 className="display page-title">Conversas</h1>
            <Link href="/prospect" className="btn btn-primary btn-sm" style={{ marginBottom: 6 }}>
              <IconPlus size={16} /> Adicionar
            </Link>
          </div>
          <p className="hero-sub">Todas as pessoas que a automação convidou ou com quem conversou.</p>
        </header>
        <ConversationList key={`${q}|${status}`} items={items} initialQuery={q} initialGroup={status} pane />
      </main>
      <section className="conv-empty only-desktop" aria-hidden="true">
        <span className="conv-empty-icon">
          <IconMessages size={28} />
        </span>
        <p>Escolha uma conversa na lista</p>
      </section>
    </div>
  );
}
