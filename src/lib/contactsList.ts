import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { convInclude, toConvItem, type ConvItem } from "@/lib/conversations";

export const CONTACTS_PAGE_SIZE = 50;

export interface ContactsQuery {
  q?: string;
  campaign?: string; // id da campanha, "none" = sem campanha
  assignee?: string; // id do responsável, "none" = sem responsável
  page?: number;
}

// Cada palavra da busca precisa aparecer em nome, cargo/empresa, e-mail ou telefone (sem acento de máscara: só dígitos).
export function contactsWhere({ q, campaign, assignee }: ContactsQuery): Prisma.LeadWhereInput {
  const and: Prisma.LeadWhereInput[] = [];
  for (const word of (q ?? "").trim().split(/\s+/).filter(Boolean).slice(0, 6)) {
    const digits = word.replace(/\D/g, "");
    // "(51)" de um telefone digitado com máscara não acha nada sozinho: ignora pedaços sem letra e com menos de 3 dígitos.
    if (!/\p{L}/u.test(word) && digits.length < 3) continue;
    and.push({
      OR: [
        { firstName: { contains: word, mode: "insensitive" } },
        { lastName: { contains: word, mode: "insensitive" } },
        { jobTitle: { contains: word, mode: "insensitive" } },
        { email: { contains: word, mode: "insensitive" } },
        ...(digits.length >= 3 ? [{ phone: { contains: digits } }] : []),
      ],
    });
  }
  if (campaign) and.push({ campaignId: campaign === "none" ? null : campaign });
  if (assignee) and.push({ assigneeId: assignee === "none" ? null : assignee });
  return and.length ? { AND: and } : {};
}

export async function getContactsPage(query: ContactsQuery): Promise<{ items: ConvItem[]; total: number; page: number; pages: number }> {
  const where = contactsWhere(query);
  const total = await prisma.lead.count({ where });
  const pages = Math.max(1, Math.ceil(total / CONTACTS_PAGE_SIZE));
  const page = Math.min(Math.max(1, Math.floor(query.page ?? 1) || 1), pages);
  const leads = await prisma.lead.findMany({
    where,
    include: convInclude,
    orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
    skip: (page - 1) * CONTACTS_PAGE_SIZE,
    take: CONTACTS_PAGE_SIZE,
  });
  return { items: leads.map(toConvItem), total, page, pages };
}
