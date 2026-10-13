"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { parseEmail, parsePhone } from "@/lib/contactFields";
import { noticeToMember } from "@/lib/team";
import { parseLeadKind } from "@/lib/leadKind";
import type { LeadKind } from "@prisma/client";

// Lembretes da reunião: liga/desliga e os textos (vazio = o padrão).
export async function updateMeetingReminders(data: { enabled: boolean; day: string; h5: string; h1: string; noShow: string }): Promise<{ error?: string }> {
  await requireSession();
  const clean = (t: string) => t.trim().slice(0, 1000) || null;
  await prisma.settings.update({
    where: { id: "singleton" },
    data: {
      meetingRemindersEnabled: data.enabled,
      reminderDayText: clean(data.day),
      reminder5hText: clean(data.h5),
      reminder1hText: clean(data.h1),
      noShowText: clean(data.noShow),
    },
  });
  revalidatePath("/settings");
  return {};
}

export interface MemberInput {
  name: string;
  email: string;
  phone: string;
  notifyUrgent: boolean;
  notifyMeetings: boolean;
  notifyHandoffs: boolean;
  role: string;
  // Tipos de contato de que a pessoa cuida (PERSON, BUSINESS, CANDIDATE, PARTNER).
  handles: string[];
  viaEmail: boolean;
  viaWhatsapp: boolean;
}

export async function saveTeamMember(id: string | null, data: MemberInput): Promise<{ error?: string }> {
  await requireSession();
  const name = data.name.trim().slice(0, 80);
  if (!name) return { error: "Escreva o nome." };
  const e = parseEmail(data.email);
  if ("error" in e) return { error: e.error };
  const p = parsePhone(data.phone);
  if ("error" in p) return { error: p.error };
  if (!e.email && !p.phone) return { error: "Informe o e-mail ou o WhatsApp para os avisos chegarem." };
  if (!(e.email && data.viaEmail) && !(p.phone && data.viaWhatsapp)) return { error: "Escolha por onde os avisos chegam: ligue o e-mail ou o WhatsApp que a pessoa tem." };
  const handles = [...new Set(data.handles.map(parseLeadKind).filter((k): k is LeadKind => k !== null))];
  const fields = {
    name,
    email: e.email,
    phone: p.phone,
    notifyUrgent: data.notifyUrgent,
    notifyMeetings: data.notifyMeetings,
    notifyHandoffs: data.notifyHandoffs,
    role: data.role.trim().slice(0, 60) || null,
    handles,
    viaEmail: data.viaEmail,
    viaWhatsapp: data.viaWhatsapp,
  };
  if (id) {
    const current = await prisma.teamMember.findUnique({ where: { id }, select: { phone: true } });
    // Trocou o número: a conversa antiga no Deskcomm não serve mais.
    await prisma.teamMember.update({ where: { id }, data: { ...fields, ...(current?.phone !== p.phone ? { whatsappConversationId: null } : {}) } });
  } else {
    await prisma.teamMember.create({ data: fields });
  }
  revalidatePath("/settings");
  return {};
}

export async function removeTeamMember(id: string) {
  await requireSession();
  await prisma.teamMember.delete({ where: { id } });
  revalidatePath("/settings");
}

// Aviso de teste: confere se o e-mail e o WhatsApp da pessoa chegam.
export async function testTeamMember(id: string): Promise<{ channels?: string[]; error?: string }> {
  await requireSession();
  const member = await prisma.teamMember.findUnique({ where: { id } });
  if (!member) return { error: "Pessoa não encontrada." };
  const channels = await noticeToMember(member, {
    title: "Teste de aviso",
    body: "Este é um aviso de teste do assistente. Quando algo precisar de você, a mensagem chega assim.",
  });
  return channels.length ? { channels } : { error: "Nenhum aviso saiu: confira o e-mail/WhatsApp da pessoa e se os canais estão conectados em Canais." };
}
