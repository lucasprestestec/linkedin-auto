"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { createIdentity, deleteIdentity, getIdentity } from "@/lib/edges";
import { sendPush } from "@/lib/push";
import { validFollowUp } from "@/lib/settings-ranges";
import { disconnectGoogle } from "@/lib/gmail";

// Quanto tempo um link de login ainda não usado é reaproveitado. Depois disso
// (ou se a pessoa pedir um link novo), a identidade pendente é trocada.
const LOGIN_LINK_REUSE_MS = 12 * 60 * 60 * 1000;

// Link pra conectar o LinkedIn. A edges.run só entrega o link ao CRIAR a
// identidade, e cada identidade criada entra na cobrança do mês. Por isso:
// enquanto a identidade pendente existir e o link for recente, devolve o
// MESMO link; só cria outra se o link expirou ou se pediram um novo (fresh).
export async function getOrCreateIdentityLoginLink(fresh = false): Promise<string> {
  const settings = await prisma.settings.findUniqueOrThrow({ where: { id: "singleton" } });

  if (settings.linkedinIdentityId) {
    const existing = await getIdentity(settings.linkedinIdentityId).catch(() => null);
    if (existing?.integrations.includes("linkedin")) {
      throw new Error("Essa conta já está conectada.");
    }
    if (existing && !fresh) {
      const recent = settings.linkedinLoginLinkAt && Date.now() - settings.linkedinLoginLinkAt.getTime() < LOGIN_LINK_REUSE_MS;
      const link = existing.identity_login_links?.linkedin || (recent ? settings.linkedinLoginLink : null);
      if (link) return link;
    }
    // Pendente sem link aproveitável (ou link novo pedido): troca por outra,
    // sem deixar identidade órfã sendo cobrada.
    await deleteIdentity(settings.linkedinIdentityId).catch(() => {});
  }

  const identity = await createIdentity("Cliente", "America/Sao_Paulo");
  const link = identity.identity_login_links?.linkedin;
  await prisma.settings.update({
    where: { id: "singleton" },
    data: { linkedinIdentityId: identity.uid, linkedinLoginLink: link ?? null, linkedinLoginLinkAt: link ? new Date() : null },
  });
  if (!link) throw new Error("A Edges não retornou o link de conexão.");

  revalidatePath("/settings");
  revalidatePath("/channels");
  return link;
}

export async function updateTargetAudience(_prevState: unknown, formData: FormData) {
  const targetAudience = String(formData.get("targetAudience") ?? "").trim();
  await prisma.settings.update({ where: { id: "singleton" }, data: { targetAudience: targetAudience || null } });
  revalidatePath("/settings");
  revalidatePath("/channels");
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
  revalidatePath("/channels");
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

// Duração da reunião que o assistente marca na agenda.
export async function updateMeetingMinutes(minutes: number) {
  if (![15, 20, 30, 45, 60].includes(minutes)) return { error: "Duração fora do permitido." };
  await prisma.settings.update({ where: { id: "singleton" }, data: { meetingMinutes: minutes } });
  revalidatePath("/settings");
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

// Desconecta o LinkedIn: apaga a identidade na edges.run (a mesma chamada que
// já é usada ao gerar um link novo) e limpa o vínculo. Depois disso o botão
// "Conectar" volta e dá pra entrar com outra conta — ou com a mesma de novo.
// Pessoas que vieram do LinkedIn. Quem tem reunião marcada pra frente fica: a
// reunião é real, mesmo que o LinkedIn saia.
function linkedinLeadsWhere() {
  return {
    AND: [
      { OR: [{ linkedinProfileUrl: { not: null } }, { linkedinThreadId: { not: null } }] },
      // Data vazia também conta como "sem reunião" (NOT sozinho descartaria os nulos).
      { OR: [{ meetingAt: null }, { meetingAt: { lt: new Date() } }] },
    ],
  };
}

export async function linkedinDataCount() {
  return prisma.lead.count({ where: linkedinLeadsWhere() });
}

// "Conectar" volta e dá pra entrar com outra conta — ou com a mesma de novo.
// Desconecta a conta. Com deleteData, apaga também as pessoas e conversas que
// vieram do LinkedIn (irreversível: a tela avisa antes).
export async function disconnectLinkedin(deleteData = false) {
  const settings = await prisma.settings.findUniqueOrThrow({ where: { id: "singleton" }, select: { linkedinIdentityId: true } });
  if (settings.linkedinIdentityId) await deleteIdentity(settings.linkedinIdentityId).catch(() => {});
  await prisma.settings.update({
    where: { id: "singleton" },
    data: { linkedinIdentityId: null, linkedinLoginLink: null, linkedinLoginLinkAt: null, linkedinNeedsReconnect: false, linkedinReconnectReason: null },
  });
  if (deleteData) await deleteLinkedinData();
  revalidatePath("/", "layout");
}

// Apaga as pessoas e conversas que vieram do LinkedIn (a conta já pode estar desconectada).
export async function deleteLinkedinData() {
  const ids = (await prisma.lead.findMany({ where: linkedinLeadsWhere(), select: { id: true } })).map((l) => l.id);
  // Mensagens primeiro: elas não apagam junto com a pessoa. Rascunhos sim.
  await prisma.$transaction([prisma.message.deleteMany({ where: { leadId: { in: ids } } }), prisma.lead.deleteMany({ where: { id: { in: ids } } })]);
  revalidatePath("/", "layout");
}

// E-mail do Google: revoga o acesso e para de enviar/ler por lá.
export async function disconnectEmail() {
  await disconnectGoogle();
  revalidatePath("/settings");
  revalidatePath("/channels");
}

export async function updateDailySummary(enabled: boolean) {
  await prisma.settings.update({ where: { id: "singleton" }, data: { dailySummaryEnabled: enabled } });
  revalidatePath("/settings");
}
