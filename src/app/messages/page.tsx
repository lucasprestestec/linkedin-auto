import { prisma } from "@/lib/prisma";
import { relativeTime, splitHeadline } from "@/lib/format";
import { MobileHeader } from "@/components/MobileHeader";
import { Inbox, type InboxItem } from "./Inbox";

export const dynamic = "force-dynamic";

// Caixa de entrada: todas as conversas com mensagem, da mais recente pra trás.
export default async function MessagesPage() {
  const leads = await prisma.lead.findMany({
    where: { messages: { some: {} } },
    include: { messages: { orderBy: { deliveredAt: "desc" }, take: 1 } },
  });

  const items: InboxItem[] = leads
    .map((l) => {
      const last = l.messages[0];
      const { role, company } = splitHeadline(l.jobTitle);
      return {
        id: l.id,
        firstName: l.firstName,
        lastName: l.lastName,
        subtitle: company ? `${role} · ${company}` : (l.jobTitle ?? ""),
        status: l.status,
        needsHumanReason: l.needsHumanReason,
        last: { content: last.content, sender: last.sender },
        when: relativeTime(last.deliveredAt),
        ts: last.deliveredAt.getTime(),
      };
    })
    .sort((a, b) => b.ts - a.ts);

  return (
    <main className="page">
      <MobileHeader />
      <header className="page-hero rise">
        <h1 className="display page-title">
          Mensa<span className="name-grad">gens.</span>
        </h1>
        <p className="hero-sub">Todas as conversas do LinkedIn, da mais recente pra trás.</p>
      </header>
      <Inbox items={items} />
    </main>
  );
}
