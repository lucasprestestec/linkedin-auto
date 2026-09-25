import { prisma } from "@/lib/prisma";
import { relativeTime, splitHeadline } from "@/lib/format";
import { MobileHeader } from "@/components/MobileHeader";
import { LeadList, type LeadItem } from "../LeadList";

export const dynamic = "force-dynamic";

// Todas as pessoas com quem a automação já falou (ou convidou), com a conversa
// mais recente primeiro.
export default async function ConversationsPage({ searchParams }: PageProps<"/conversations">) {
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q : "";
  const status = typeof params.status === "string" ? params.status : "";

  const [settings, leads] = await Promise.all([
    prisma.settings.findUniqueOrThrow({ where: { id: "singleton" }, select: { followUpMaxCount: true } }),
    prisma.lead.findMany({
      include: { messages: { orderBy: { deliveredAt: "desc" }, take: 1 }, campaign: { select: { name: true } } },
    }),
  ]);

  const items: LeadItem[] = leads
    .map((lead) => {
      const last = lead.messages[0];
      const when = last?.deliveredAt ?? lead.updatedAt;
      const { role, company } = splitHeadline(lead.jobTitle);
      return {
        id: lead.id,
        firstName: lead.firstName,
        lastName: lead.lastName,
        jobTitle: lead.jobTitle,
        role,
        company,
        linkedinProfileUrl: lead.linkedinProfileUrl,
        status: lead.status,
        needsHumanReason: lead.needsHumanReason,
        followUpsSent: lead.followUpsSent,
        tags: lead.tags,
        campaignName: lead.campaign?.name ?? null,
        icpScore: lead.icpScore,
        lastMessage: last ? { content: last.content, sender: last.sender } : null,
        when: relativeTime(when),
        whenTs: when.getTime(),
      };
    })
    .sort((a, b) => b.whenTs - a.whenTs);

  return (
    <main className="page">
      <MobileHeader />
      <header className="page-hero rise">
        <h1 className="display page-title">
          Conver<span className="name-grad">sas.</span>
        </h1>
        <p className="hero-sub">Todas as pessoas que a automação convidou ou com quem conversou. Toque em uma pra abrir a conversa.</p>
      </header>
      <LeadList key={`${q}|${status}`} leads={items} followUpMax={settings.followUpMaxCount} initialQuery={q} initialSection={status} />
    </main>
  );
}
