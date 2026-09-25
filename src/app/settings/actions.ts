"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { createIdentity, deleteIdentity, getIdentity } from "@/lib/edges";
import { sendPush } from "@/lib/push";
import { validFollowUp } from "@/lib/settings-ranges";

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

export async function updateOwnerName(_prevState: unknown, formData: FormData) {
  const ownerName = String(formData.get("ownerName") ?? "").trim().slice(0, 60);
  await prisma.settings.update({ where: { id: "singleton" }, data: { ownerName: ownerName || null } });
  revalidatePath("/", "layout");
  return { saved: true };
}

// Follow-up padrão da conta: vale pra toda conversa sem regra própria (nem da
// campanha, nem da conversa).
export async function updateFollowUpDefault(count: number, days: number) {
  const delayHours = days * 24;
  if (!validFollowUp(count, delayHours)) return { error: "Valores fora do permitido." };
  await prisma.settings.update({ where: { id: "singleton" }, data: { followUpMaxCount: count, followUpDelayHours: delayHours } });
  revalidatePath("/", "layout");
  return { saved: true };
}
