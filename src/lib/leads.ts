import type { Lead } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { EdgesConversation } from "@/lib/edges";
import { linkedinProfileSlug, normalizeLinkedinUrl } from "@/lib/linkedin";

// Procura o lead pelo perfil, tolerando as variações de URL entre as fontes
// (e as linhas antigas gravadas antes da forma canônica). O filtro no banco é
// só um "contém" para achar candidatos; a igualdade exata do slug é conferida
// aqui, para "ana" não casar com "ana-souza".
export async function findLeadByProfileUrl(url: string) {
  const slug = linkedinProfileSlug(url);
  if (!slug) return null;

  const encoded = encodeURIComponent(slug);
  const candidates = await prisma.lead.findMany({
    where: {
      OR: [
        { linkedinProfileUrl: { contains: `/in/${slug}`, mode: "insensitive" } },
        { linkedinProfileUrl: { contains: `/in/${encoded}`, mode: "insensitive" } },
      ],
    },
  });
  return candidates.find((lead) => linkedinProfileSlug(lead.linkedinProfileUrl) === slug) ?? null;
}

// Acha o lead da conversa. Primeiro pela thread; se ainda não tem thread (lead
// criado pelo callback do convite, antes de existir conversa), pelo perfil —
// e aí vincula a thread a ele em vez de tentar criar um lead duplicado.
export async function syncLeadFromConversation(conv: EdgesConversation): Promise<Lead> {
  const profile = {
    firstName: conv.first_name,
    lastName: conv.last_name,
    jobTitle: conv.job_title,
  };

  const byThread = await prisma.lead.findUnique({ where: { linkedinThreadId: conv.linkedin_thread_id } });
  if (byThread) {
    return prisma.lead.update({ where: { id: byThread.id }, data: profile });
  }

  const byProfile = await findLeadByProfileUrl(conv.linkedin_profile_url);
  if (byProfile) {
    return prisma.lead.update({
      where: { id: byProfile.id },
      data: {
        ...profile,
        linkedinThreadId: conv.linkedin_thread_id,
        // Existe conversa, então o convite foi aceito. Só vira "Conversando"
        // quando o lead escrever (ver sync.ts) — até lá, aguardando resposta.
        status: byProfile.status === "INVITE_SENT" ? "WAITING_REPLY" : byProfile.status,
      },
    });
  }

  return prisma.lead.create({
    data: {
      ...profile,
      linkedinProfileUrl: normalizeLinkedinUrl(conv.linkedin_profile_url) ?? conv.linkedin_profile_url,
      linkedinThreadId: conv.linkedin_thread_id,
      status: "WAITING_REPLY",
    },
  });
}
