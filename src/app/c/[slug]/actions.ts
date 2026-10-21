"use server";

import { prisma } from "@/lib/prisma";
import { isCaptureSlug, readCapture } from "@/lib/capture";
import { checkEmailDomain, domainOf, noMailMessage } from "@/lib/emailDomain";
import { appendNote } from "@/lib/leadUpdate";

export type CaptureState = { done?: boolean; error?: string } | undefined;

// Limites contra abuso: a página é pública e escreve no banco.
const MAX_PER_HOUR = 30;

// Quem preenche o formulário público entra na campanha, com origem e consentimento registrados. O sistema não
// confirma se a pessoa já estava na base (a resposta é sempre "recebido"), para o formulário não revelar quem é contato.
export async function submitCapture(slug: string, _prev: CaptureState, form: FormData): Promise<CaptureState> {
  if (!isCaptureSlug(slug)) return { error: "Link inválido." };
  const campaign = await prisma.campaign.findFirst({
    where: { captureSlug: slug, captureOn: true, status: "ACTIVE" },
    select: { id: true, name: true, captureTitle: true, captureChannel: true, maxLeads: true },
  });
  if (!campaign) return { error: "Este formulário não está recebendo respostas agora." };

  const read = readCapture(form);
  if (!read.ok) return "ignore" in read ? { done: true } : { error: read.error };
  const { data } = read;

  if ((await prisma.lead.count({ where: { campaignId: campaign.id, source: "FORMULARIO", createdAt: { gte: new Date(Date.now() - 3_600_000) } } })) >= MAX_PER_HOUR) {
    return { error: "Recebemos muitas respostas em pouco tempo. Tente de novo daqui a alguns minutos." };
  }
  if (campaign.maxLeads != null && (await prisma.lead.count({ where: { campaignId: campaign.id } })) >= campaign.maxLeads) {
    return { error: "Este formulário atingiu o limite de pessoas." };
  }
  if (data.email && (await checkEmailDomain(domainOf(data.email))) === "sem_servidor") return { error: noMailMessage(domainOf(data.email)) };

  const title = campaign.captureTitle || campaign.name;
  const same = [data.email ? { email: { equals: data.email, mode: "insensitive" as const } } : null, data.phone ? { phone: data.phone } : null].filter((c) => c !== null);
  const existing = await prisma.lead.findFirst({ where: { OR: same }, select: { id: true, notes: true, consentAt: true } });
  if (existing) {
    // Já era contato: só registra que preencheu (e o consentimento, se ainda não havia). Quem pediu para não ser contatado continua assim.
    await prisma.lead.update({
      where: { id: existing.id },
      data: { notes: appendNote(existing.notes, `Preencheu o formulário "${title}".`), consentAt: existing.consentAt ?? new Date() },
    });
    return { done: true };
  }

  const channel = campaign.captureChannel === "EMAIL" && data.email ? "EMAIL" : campaign.captureChannel === "WHATSAPP" && data.phone ? "WHATSAPP" : null;
  await prisma.lead.create({
    data: {
      ...data,
      campaignId: campaign.id,
      status: "NEW",
      source: "FORMULARIO",
      consentAt: new Date(),
      firstContactChannel: channel,
      nextStep: channel
        ? `Veio pelo formulário "${title}". O assistente se apresenta por ${channel === "EMAIL" ? "e-mail" : "WhatsApp"} no próximo horário de trabalho.`
        : `Veio pelo formulário "${title}". Você começa a conversa quando quiser.`,
    },
  });
  return { done: true };
}
