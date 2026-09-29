"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { MessageChannel } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { parseEmail, parsePhone } from "@/lib/contactFields";
import { normalizeLinkedinUrl } from "@/lib/linkedin";
import { findLeadByProfileUrl } from "@/lib/leads";
import { isExcluded, loadExclusionRules } from "@/lib/exclusion";
import { emailEnabled } from "@/lib/email";
import { deskcommConfig } from "@/lib/deskcomm";
import { activeIdentityIdOrNull } from "@/lib/identity";
import { inviteProspects } from "@/lib/prospect";

export type ContactFormState = { error?: string; existingLeadId?: string } | undefined;

type FirstContact = "ME" | "LINKEDIN" | "EMAIL" | "WHATSAPP";

const field = (formData: FormData, name: string) => String(formData.get(name) ?? "").trim();

// "Adicionar contato": alguém que o corretor já conhece (indicação, evento,
// cliente antigo). Nada sai na hora — a primeira mensagem, quando pedida, é da
// secretária dentro do horário; o convite do LinkedIn segue o fluxo de sempre.
export async function createContact(_prev: ContactFormState, formData: FormData): Promise<ContactFormState> {
  const firstName = field(formData, "firstName").slice(0, 80);
  const lastName = field(formData, "lastName").slice(0, 80);
  const jobTitle = field(formData, "jobTitle").slice(0, 200);
  const personal = field(formData, "personal").slice(0, 2000);
  const campaignId = field(formData, "campaignId") || null;
  const firstContact = (field(formData, "firstContact") || "ME") as FirstContact;

  if (!firstName) return { error: "Informe pelo menos o nome." };
  const e = parseEmail(field(formData, "email"));
  if ("error" in e) return { error: e.error };
  const p = parsePhone(field(formData, "phone"));
  if ("error" in p) return { error: p.error };
  const rawLinkedin = field(formData, "linkedin");
  const linkedinProfileUrl = rawLinkedin ? normalizeLinkedinUrl(rawLinkedin) : null;
  if (rawLinkedin && !linkedinProfileUrl) return { error: "Link do LinkedIn inválido. Ex.: https://www.linkedin.com/in/nome" };
  if (!e.email && !p.phone && !linkedinProfileUrl) return { error: "Informe pelo menos um jeito de falar com a pessoa: WhatsApp, e-mail ou LinkedIn." };

  // Já está no sistema? Leva pra conversa existente em vez de duplicar.
  const existing =
    (linkedinProfileUrl && (await findLeadByProfileUrl(linkedinProfileUrl))) ||
    (e.email && (await prisma.lead.findFirst({ where: { email: { equals: e.email, mode: "insensitive" } } }))) ||
    (p.phone && (await prisma.lead.findFirst({ where: { phone: p.phone } }))) ||
    null;
  if (existing) return { error: "Essa pessoa já está no sistema.", existingLeadId: existing.id };

  const rules = await loadExclusionRules();
  if (isExcluded({ linkedinProfileUrl, firstName, lastName, headline: jobTitle }, rules)) {
    return { error: "Essa pessoa está na lista de quem nunca contatar (Conta → Quem nunca contatar)." };
  }

  if (campaignId) {
    const campaign = await prisma.campaign.findUnique({ where: { id: campaignId }, select: { status: true } });
    if (!campaign) return { error: "Campanha não encontrada." };
    if (campaign.status !== "ACTIVE") return { error: "Essa campanha está pausada ou finalizada." };
  }

  // O primeiro contato escolhido precisa do canal pronto.
  if (firstContact === "LINKEDIN") {
    if (!linkedinProfileUrl) return { error: "Pra convidar no LinkedIn, informe o link do perfil." };
    if (!(await activeIdentityIdOrNull())) return { error: "Conecte o LinkedIn em Canais pra enviar o convite." };
  }
  if (firstContact === "EMAIL") {
    if (!e.email) return { error: "Pra a secretária se apresentar por e-mail, informe o e-mail." };
    if (!(await emailEnabled())) return { error: "Conecte o e-mail em Canais pra a secretária mandar a primeira mensagem." };
  }
  if (firstContact === "WHATSAPP") {
    if (!p.phone) return { error: "Pra a secretária falar pelo WhatsApp, informe o número." };
    if (!(await deskcommConfig())) return { error: "Conecte o WhatsApp (Deskcomm) em Canais pra a secretária mandar a primeira mensagem." };
  }

  const channel: MessageChannel | null = firstContact === "EMAIL" || firstContact === "WHATSAPP" ? firstContact : null;
  const lead = await prisma.lead.create({
    data: {
      firstName,
      lastName: lastName || null,
      jobTitle: jobTitle || null,
      email: e.email,
      phone: p.phone,
      personal: personal || null,
      linkedinProfileUrl,
      campaignId,
      status: firstContact === "LINKEDIN" ? "INVITE_SENT" : "NEW",
      invitedAt: firstContact === "LINKEDIN" ? new Date() : null,
      firstContactChannel: channel,
      tags: ["adicionado à mão"],
      nextStep:
        firstContact === "LINKEDIN"
          ? "Convite do LinkedIn a caminho."
          : channel
            ? `A secretária vai se apresentar por ${channel === "EMAIL" ? "e-mail" : "WhatsApp"} no próximo horário de trabalho.`
            : "Você começa a conversa quando quiser; depois a secretária acompanha.",
    },
  });

  if (firstContact === "LINKEDIN") {
    try {
      const r = await inviteProspects([{ linkedinProfileUrl: linkedinProfileUrl!, fullName: [firstName, lastName].filter(Boolean).join(" "), jobTitle, campaignId: campaignId ?? undefined }]);
      if (r.scheduled === 0) {
        // Limite de convites do dia: fica como contato novo, pra convidar depois.
        await prisma.lead.update({
          where: { id: lead.id },
          data: { status: "NEW", invitedAt: null, nextStep: "Limite de convites de hoje atingido; convide pelo LinkedIn amanhã ou escreva você." },
        });
      }
    } catch (err) {
      await prisma.lead.update({
        where: { id: lead.id },
        data: { status: "NEW", invitedAt: null, nextStep: `O convite não saiu (${err instanceof Error ? err.message : "erro"}).` },
      });
    }
  }

  revalidatePath("/conversations");
  revalidatePath("/");
  redirect(`/leads/${lead.id}`);
}
