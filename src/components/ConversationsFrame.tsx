import Link from "next/link";
import type { ConvItem } from "@/lib/conversations";
import { ConversationList } from "./ConversationList";
import { MobileHeader } from "./MobileHeader";

// Moldura da área Conversas: título, Lista/Quadro e a caixa com a lista à esquerda e a conversa aberta à direita.
// No celular aparece uma coisa de cada vez: a lista, ou (com `activeId`) só a conversa.
export function ConversationsFrame({ items, activeId, initialQuery, initialGroup, children }: { items: ConvItem[]; activeId?: string; initialQuery?: string; initialGroup?: string; children: React.ReactNode }) {
  return (
    <main className={`page page-wide conv-page${activeId ? " has-open" : ""}`} style={{ "--c": "var(--a-conv)" } as React.CSSProperties}>
      <div className="conv-intro">
        <MobileHeader />
        <ConversationsHead view="list" />
      </div>
      <div className="conv">
        <aside className="c-list" aria-label="Lista de conversas">
          <ConversationList items={items} activeId={activeId} initialQuery={initialQuery} initialGroup={initialGroup} />
        </aside>
        <section className="c-main">{children}</section>
      </div>
    </main>
  );
}

export function ConversationsHead({ view }: { view: "list" | "board" }) {
  return (
    <header className="area-head">
      <div className="grow">
        <h1 className="area-title">
          <i className="area-sq" aria-hidden="true" />
          Conversas
        </h1>
        <p className="area-sub">Tudo o que o assistente conversou, em LinkedIn, e-mail e WhatsApp.</p>
      </div>
      <div className="seg" role="group" aria-label="Como ver">
        <Link href="/conversations" className="tab2" aria-current={view === "list" ? "page" : undefined}>
          Lista
        </Link>
        <Link href="/conversations?view=quadro" className="tab2" aria-current={view === "board" ? "page" : undefined}>
          Quadro
        </Link>
      </div>
    </header>
  );
}
