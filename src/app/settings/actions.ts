"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { createIdentity, deleteIdentity, getIdentity } from "@/lib/edges";
import { FOLLOW_UP_DELAY_HOURS_RANGE, FOLLOW_UP_MAX_COUNT_RANGE } from "@/lib/settings-ranges";
import { sendPush } from "@/lib/push";

export async function getOrCreateIdentityLoginLink(): Promise<string> {
  const settings = await prisma.settings.findUniqueOrThrow({ where: { id: "singleton" } });

  if (settings.linkedinIdentityId) {
    // A Edges só devolve o link de login no momento da criação. Se já existe
    // uma identidade mas ela nunca chegou a conectar (usuário fechou a aba,
    // por exemplo), apaga essa e cria outra para gerar um link novo — evita
    // acumular identidades órfãs (cada uma tem custo mensal).
    const existing = await getIdentity(settings.linkedinIdentityId).catch(() => null);
    if (existing?.integrations.includes("linkedin")) {
      throw new Error("Essa conta já está conectada.");
    }
    await deleteIdentity(settings.linkedinIdentityId).catch(() => {});
  }

  const identity = await createIdentity("Cliente", "America/Sao_Paulo");
  await prisma.settings.update({
    where: { id: "singleton" },
    data: { linkedinIdentityId: identity.uid },
  });

  const link = identity.identity_login_links?.linkedin;
  if (!link) throw new Error("A Edges não retornou o link de conexão.");

  revalidatePath("/settings");
  return link;
}

export async function updateLimits(_prevState: unknown, formData: FormData) {
  const dailyInviteLimit = Number(formData.get("dailyInviteLimit"));
  const dailyMessageLimit = Number(formData.get("dailyMessageLimit"));

  if (!Number.isFinite(dailyInviteLimit) || !Number.isFinite(dailyMessageLimit) || dailyInviteLimit < 1 || dailyMessageLimit < 1) {
    return { error: "Valores inválidos." };
  }

  await prisma.settings.update({
    where: { id: "singleton" },
    data: { dailyInviteLimit, dailyMessageLimit },
  });

  revalidatePath("/settings");
  return { error: undefined, saved: true };
}

export async function updateFollowUp(_prevState: unknown, formData: FormData) {
  const followUpMaxCount = Number(formData.get("followUpMaxCount"));
  const followUpDelayHours = Number(formData.get("followUpDelayHours"));
  const [minCount, maxCount] = FOLLOW_UP_MAX_COUNT_RANGE;
  const [minHours, maxHours] = FOLLOW_UP_DELAY_HOURS_RANGE;

  if (
    !Number.isInteger(followUpMaxCount) ||
    !Number.isInteger(followUpDelayHours) ||
    followUpMaxCount < minCount ||
    followUpMaxCount > maxCount ||
    followUpDelayHours < minHours ||
    followUpDelayHours > maxHours
  ) {
    return { error: "Valores inválidos." };
  }

  await prisma.settings.update({
    where: { id: "singleton" },
    data: { followUpMaxCount, followUpDelayHours },
  });

  revalidatePath("/settings");
  return { error: undefined, saved: true };
}

export async function updateAgentInstructions(_prevState: unknown, formData: FormData) {
  const agentInstructions = String(formData.get("agentInstructions") ?? "").trim();

  await prisma.settings.update({
    where: { id: "singleton" },
    data: { agentInstructions: agentInstructions || null },
  });

  revalidatePath("/settings");
  return { saved: true };
}

export async function updateWorkHours(_prevState: unknown, formData: FormData) {
  const workStartHour = Number(formData.get("workStartHour"));
  const workEndHour = Number(formData.get("workEndHour"));
  const workWeekdaysOnly = formData.get("workWeekdaysOnly") === "on";
  if (!Number.isInteger(workStartHour) || !Number.isInteger(workEndHour) || workStartHour < 0 || workEndHour > 24 || workStartHour >= workEndHour) {
    return { error: "O início precisa ser antes do fim." };
  }
  await prisma.settings.update({ where: { id: "singleton" }, data: { workStartHour, workEndHour, workWeekdaysOnly } });
  revalidatePath("/settings");
  return { error: undefined, saved: true };
}

export async function updateTargetAudience(_prevState: unknown, formData: FormData) {
  const targetAudience = String(formData.get("targetAudience") ?? "").trim();
  await prisma.settings.update({ where: { id: "singleton" }, data: { targetAudience: targetAudience || null } });
  revalidatePath("/settings");
  return { saved: true };
}

export async function updateExclusionList(_prevState: unknown, formData: FormData) {
  const exclusionList = String(formData.get("exclusionList") ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .join("\n");
  await prisma.settings.update({ where: { id: "singleton" }, data: { exclusionList: exclusionList || null } });
  revalidatePath("/settings");
  return { saved: true };
}

const ENGAGEMENT_FLAGS = ["acceptInvitesEnabled", "withdrawInvitesEnabled", "warmupEnabled", "archiveLostEnabled"] as const;
export type EngagementFlag = (typeof ENGAGEMENT_FLAGS)[number];

export async function setEngagementFlag(flag: EngagementFlag, enabled: boolean) {
  if (!ENGAGEMENT_FLAGS.includes(flag)) throw new Error("Opção inválida.");
  await prisma.settings.update({ where: { id: "singleton" }, data: { [flag]: enabled } });
  revalidatePath("/settings");
}

export async function setWithdrawAfterDays(days: number) {
  if (!Number.isInteger(days) || days < 7 || days > 90) throw new Error("Entre 7 e 90 dias.");
  await prisma.settings.update({ where: { id: "singleton" }, data: { withdrawAfterDays: days } });
  revalidatePath("/settings");
}

// ---------------------------------------------------------------------------
// Campanhas
// ---------------------------------------------------------------------------

export async function saveCampaign(id: string | null, name: string, instructions: string) {
  const cleanName = name.trim().slice(0, 60);
  if (!cleanName) return { error: "Dê um nome à campanha." };
  const data = { name: cleanName, instructions: instructions.trim() || null };
  const campaign = id ? await prisma.campaign.update({ where: { id }, data }) : await prisma.campaign.create({ data });
  revalidatePath("/settings");
  revalidatePath("/prospect");
  return { error: undefined, id: campaign.id };
}

// Os leads da campanha continuam; passam a usar as instruções gerais.
export async function deleteCampaign(id: string) {
  await prisma.campaign.delete({ where: { id } });
  revalidatePath("/settings");
  revalidatePath("/prospect");
}

// ---------------------------------------------------------------------------
// Notificações (Web Push)
// ---------------------------------------------------------------------------

export async function savePushSubscription(sub: { endpoint: string; keys: { p256dh: string; auth: string } }) {
  if (!sub?.endpoint?.startsWith("https://") || !sub.keys?.p256dh || !sub.keys?.auth) throw new Error("Inscrição inválida.");
  await prisma.pushSubscription.upsert({
    where: { endpoint: sub.endpoint },
    update: { p256dh: sub.keys.p256dh, auth: sub.keys.auth },
    create: { endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth },
  });
}

export async function removePushSubscription(endpoint: string) {
  await prisma.pushSubscription.deleteMany({ where: { endpoint } });
}

export async function sendTestPush() {
  const delivered = await sendPush({ title: "Notificações ativadas", body: "É assim que você vai saber quando um lead precisar de você.", url: "/" });
  return { delivered };
}
