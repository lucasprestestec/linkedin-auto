import { prisma } from "@/lib/prisma";

// Identidade ativa: só a que o cliente conectou (Settings.linkedinIdentityId).
// Em produção não há reserva — "Desconectar" na Conta para tudo de verdade.
// Em desenvolvimento, sem conta conectada, usa a identidade de teste do .env.
export async function activeIdentityIdOrNull(): Promise<string | null> {
  const settings = await prisma.settings.findUnique({ where: { id: "singleton" }, select: { linkedinIdentityId: true } });
  if (settings?.linkedinIdentityId) return settings.linkedinIdentityId;
  return process.env.NODE_ENV === "production" ? null : (process.env.EDGES_IDENTITY_ID ?? null);
}

export async function getActiveIdentityId(): Promise<string> {
  const id = await activeIdentityIdOrNull();
  if (!id) throw new Error("Nenhuma conta do LinkedIn conectada. Conecte em Conta.");
  return id;
}
