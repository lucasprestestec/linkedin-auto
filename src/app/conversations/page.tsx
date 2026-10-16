import { getConversationItems } from "@/lib/conversations";
import { ConversationBoard } from "@/components/ConversationList";
import { ConversationsFrame, ConversationsHead } from "@/components/ConversationsFrame";
import { MobileHeader } from "@/components/MobileHeader";
import { IconMessages } from "@/components/Icons";

export const dynamic = "force-dynamic";

// Área Conversas: a lista (com busca e grupos) e, no computador, o espaço da conversa aberta ao lado.
// ?view=quadro mostra o quadro (kanban). Links antigos com ?status= ou ?q= continuam abrindo o filtro certo.
export default async function ConversationsPage({ searchParams }: PageProps<"/conversations">) {
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q : "";
  const status = typeof params.status === "string" ? params.status : "";
  const items = await getConversationItems();

  if (params.view === "quadro") {
    return (
      <main className="page page-wide" style={{ "--c": "var(--a-conv)" } as React.CSSProperties}>
        <MobileHeader />
        <ConversationsHead view="board" />
        <ConversationBoard items={items} />
      </main>
    );
  }

  return (
    <ConversationsFrame key={`${q}|${status}`} items={items} initialQuery={q} initialGroup={status}>
      <div className="c-pick">
        <IconMessages size={28} />
        <p>Escolha uma conversa na lista para ler e responder.</p>
      </div>
    </ConversationsFrame>
  );
}
