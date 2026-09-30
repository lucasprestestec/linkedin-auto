import Link from "next/link";
import { getConversationItems } from "@/lib/conversations";
import { MobileHeader } from "@/components/MobileHeader";
import { ConversationList } from "@/components/ConversationList";

export const dynamic = "force-dynamic";

export default async function ConversationsPage({ searchParams }: PageProps<"/conversations">) {
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q : "";
  const status = typeof params.status === "string" ? params.status : "";
  const items = await getConversationItems();

  return (
    <main className="page">
      <MobileHeader />
      <header className="p-head">
        <h1 className="t-title">Conversas</h1>
        <Link href="/contacts/new" className="btn-line btn-sm">
          Adicionar contato
        </Link>
      </header>
      <ConversationList key={`${q}|${status}`} items={items} initialQuery={q} initialGroup={status} />
    </main>
  );
}
