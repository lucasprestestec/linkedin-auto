"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { ADMIN_COOKIE, adminEnabled, checkAdminPassword, createAdminToken, requireAdmin } from "@/lib/admin";
import { testEmailConnection } from "@/lib/email";
import { fixedDeskcommUrl, inspectDeskcomm, saveDeskcommConnection } from "@/lib/deskcomm";

// Chave de acesso do CRM deste cliente (a do WhatsApp). Fica cifrada no banco dele: não passa pela Vercel.
// A chave vem da organização do cliente no CRM, com permissão de leitura, escrita e papel de gerente.
export async function saveWhatsappKey(_prev: { error?: string; saved?: boolean } | undefined, formData: FormData) {
  await requireAdmin();
  const token = String(formData.get("token") ?? "").trim();
  if (!token) return { error: "Cole a chave." };
  const url = fixedDeskcommUrl();
  try {
    const found = await inspectDeskcomm({ url, token });
    if (found.missingTools.length) return { error: "A chave não tem todas as permissões. Ela precisa de leitura, escrita e papel de gerente (mcp:read, mcp:write, role:manager)." };
    const current = await prisma.settings.findUniqueOrThrow({ where: { id: "singleton" }, select: { deskcommChannelId: true } });
    await saveDeskcommConnection(url, token, found.channelId ?? current.deskcommChannelId);
    revalidatePath("/admin");
    revalidatePath("/settings");
    return { saved: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Não foi possível testar a chave." };
  }
}

export async function removeWhatsappKey() {
  await requireAdmin();
  await prisma.settings.update({ where: { id: "singleton" }, data: { deskcommUrl: null, deskcommToken: null, deskcommChannelId: null } });
  revalidatePath("/admin");
  revalidatePath("/settings");
}

export async function adminLogin(_prev: { error?: string } | undefined, formData: FormData) {
  if (!adminEnabled()) return { error: "Admin desativado." };
  if (!checkAdminPassword(String(formData.get("password") ?? ""))) return { error: "Senha incorreta." };
  (await cookies()).set(ADMIN_COOKIE, createAdminToken(), {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
  revalidatePath("/admin");
  return { error: undefined };
}

export async function testEmail() {
  await requireAdmin();
  return testEmailConnection();
}

const PROACTIVE_LABELS: Record<string, string> = {
  acceptedInvites: "convites aceitos",
  repliesSent: "respostas enviadas",
  openingsSent: "aberturas enviadas",
  introEmailsSent: "apresentações por e-mail",
  firstContactsSent: "primeiros contatos",
  cadenceStepsSent: "passos da sequência",
  meetingRemindersSent: "lembretes de reunião",
  followUpsSent: "retomadas",
  markedLost: "contatos encerrados",
  bookingNudgesSent: "convites para marcar reunião",
};

// Roda agora o mesmo robô que o cron-job.org chama de 15 em 15 minutos, sem esperar a próxima passada.
export async function runRobotNow(): Promise<{ error?: string; lines?: string[] }> {
  await requireAdmin();
  const secret = process.env.CRON_SECRET;
  if (!secret) return { error: "CRON_SECRET não está definido no ambiente." };
  try {
    const { GET } = await import("@/app/api/cron/poll/route");
    const res = await GET(new Request("http://interno/api/cron/poll", { headers: { authorization: `Bearer ${secret}` } }));
    if (!res.ok) return { error: `O robô respondeu ${res.status}.` };
    const j = (await res.json()) as {
      email?: { read: number; saved: number; error?: string };
      proactive?: Record<string, unknown> & { skipped?: string; error?: string };
    };
    const lines: string[] = [];
    if (j.email) lines.push(j.email.error ? `E-mail: erro (${j.email.error})` : `E-mail: ${j.email.read} lidos, ${j.email.saved} novos.`);
    const p = j.proactive;
    if (p?.error) lines.push(`Envios: erro (${p.error})`);
    else if (p?.skipped) lines.push(`Envios parados: ${p.skipped}.`);
    else {
      const done = Object.entries(PROACTIVE_LABELS)
        .filter(([k]) => typeof p?.[k] === "number" && (p[k] as number) > 0)
        .map(([k, label]) => `${p![k]} ${label}`);
      lines.push(done.length ? `Envios: ${done.join(", ")}.` : "Envios: nada novo agora.");
    }
    revalidatePath("/", "layout");
    return { lines };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Falha ao rodar o robô." };
  }
}

export async function adminLogout() {
  (await cookies()).delete(ADMIN_COOKIE);
  revalidatePath("/admin");
}

export async function updateLimits(_prevState: unknown, formData: FormData) {
  await requireAdmin();
  const dailyInviteLimit = Number(formData.get("dailyInviteLimit"));
  const dailyMessageLimit = Number(formData.get("dailyMessageLimit"));

  if (!Number.isFinite(dailyInviteLimit) || !Number.isFinite(dailyMessageLimit) || dailyInviteLimit < 1 || dailyMessageLimit < 1) {
    return { error: "Valores inválidos." };
  }

  await prisma.settings.update({
    where: { id: "singleton" },
    data: { dailyInviteLimit, dailyMessageLimit },
  });

  revalidatePath("/admin");
  return { error: undefined, saved: true };
}

export async function updateAgentInstructions(_prevState: unknown, formData: FormData) {
  await requireAdmin();
  const agentInstructions = String(formData.get("agentInstructions") ?? "").trim();

  await prisma.settings.update({
    where: { id: "singleton" },
    data: { agentInstructions: agentInstructions || null },
  });

  revalidatePath("/admin");
  return { saved: true };
}

export async function updateWorkHours(_prevState: unknown, formData: FormData) {
  await requireAdmin();
  const workStartHour = Number(formData.get("workStartHour"));
  const workEndHour = Number(formData.get("workEndHour"));
  const workWeekdaysOnly = formData.get("workWeekdaysOnly") === "on";
  const replyAnytime = formData.get("replyAnytime") === "on";
  if (!Number.isInteger(workStartHour) || !Number.isInteger(workEndHour) || workStartHour < 0 || workEndHour > 24 || workStartHour >= workEndHour) {
    return { error: "O início precisa ser antes do fim." };
  }
  await prisma.settings.update({ where: { id: "singleton" }, data: { workStartHour, workEndHour, workWeekdaysOnly, replyAnytime } });
  revalidatePath("/admin");
  return { error: undefined, saved: true };
}

const ENGAGEMENT_FLAGS = ["acceptInvitesEnabled", "withdrawInvitesEnabled", "warmupEnabled", "archiveLostEnabled"] as const;
export type EngagementFlag = (typeof ENGAGEMENT_FLAGS)[number];

export async function setEngagementFlag(flag: EngagementFlag, enabled: boolean) {
  await requireAdmin();
  if (!ENGAGEMENT_FLAGS.includes(flag)) throw new Error("Opção inválida.");
  await prisma.settings.update({ where: { id: "singleton" }, data: { [flag]: enabled } });
  revalidatePath("/admin");
}

export async function setWithdrawAfterDays(days: number) {
  await requireAdmin();
  if (!Number.isInteger(days) || days < 7 || days > 90) throw new Error("Entre 7 e 90 dias.");
  await prisma.settings.update({ where: { id: "singleton" }, data: { withdrawAfterDays: days } });
  revalidatePath("/admin");
}

export async function updateAssistantIdentity(_prevState: unknown, formData: FormData) {
  await requireAdmin();
  const assistantName = String(formData.get("assistantName") ?? "").trim().slice(0, 40);
  const assistantDiscloseAi = formData.get("assistantDiscloseAi") === "on";
  await prisma.settings.update({ where: { id: "singleton" }, data: { assistantName: assistantName || null, assistantDiscloseAi } });
  revalidatePath("/admin");
  return { saved: true };
}
