import { prisma } from "@/lib/prisma";
import { OWNER_LOGINS } from "@/lib/panelUsers";

// Plano do cliente: quem escolhe é o dono, na Central LP (ela grava os números em Settings). Daqui para frente o
// sistema só LÊ estes números; nada de variável na Vercel. Campo vazio = sem limite naquele item.
export interface Plan {
  name: string | null;
  conversations: number | null;
  mailboxes: number | null;
  users: number | null;
  aiBudgetUsd: number | null;
}

export async function loadPlan(): Promise<Plan> {
  const s = await prisma.settings.findUniqueOrThrow({
    where: { id: "singleton" },
    select: { planName: true, planConversations: true, planMailboxes: true, planUsers: true, planAiBudgetUsd: true },
  });
  return { name: s.planName, conversations: s.planConversations, mailboxes: s.planMailboxes, users: s.planUsers, aiBudgetUsd: s.planAiBudgetUsd };
}

// Caixas que contam no plano: as que não foram aposentadas.
export async function countedMailboxes(): Promise<number> {
  return prisma.mailbox.count({ where: { status: { not: "RETIRED" } } });
}

// Pessoas com acesso ao painel que contam no plano: ativas, sem as contas do suporte.
export async function countedUsers(): Promise<number> {
  return prisma.panelUser.count({ where: { active: true, login: { notIn: OWNER_LOGINS } } });
}

// null = pode; texto = motivo (já em português, para mostrar a quem tentou).
export async function mailboxBlockedByPlan(): Promise<string | null> {
  const plan = await loadPlan();
  if (plan.mailboxes === null) return null;
  if ((await countedMailboxes()) < plan.mailboxes) return null;
  return `O plano${plan.name ? ` ${plan.name}` : ""} inclui ${plan.mailboxes} caixa${plan.mailboxes === 1 ? "" : "s"} de e-mail e todas já estão cadastradas. Para ter mais, mude de plano.`;
}

export async function userBlockedByPlan(): Promise<string | null> {
  const plan = await loadPlan();
  if (plan.users === null) return null;
  if ((await countedUsers()) < plan.users) return null;
  return `O plano${plan.name ? ` ${plan.name}` : ""} inclui ${plan.users} acesso${plan.users === 1 ? "" : "s"} ao painel e todos já estão em uso. Desative um acesso ou mude de plano.`;
}
