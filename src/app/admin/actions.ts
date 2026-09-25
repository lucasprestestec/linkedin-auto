"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { ADMIN_COOKIE, adminEnabled, checkAdminPassword, createAdminToken, requireAdmin } from "@/lib/admin";

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
  if (!Number.isInteger(workStartHour) || !Number.isInteger(workEndHour) || workStartHour < 0 || workEndHour > 24 || workStartHour >= workEndHour) {
    return { error: "O início precisa ser antes do fim." };
  }
  await prisma.settings.update({ where: { id: "singleton" }, data: { workStartHour, workEndHour, workWeekdaysOnly } });
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

