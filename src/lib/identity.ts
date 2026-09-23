import { prisma } from "@/lib/prisma";

// Identidade ativa: a que o cliente conectou (Settings.linkedinIdentityId).
// Enquanto ele não conecta, cai na identidade de teste do .env (dev/demo).
export async function getActiveIdentityId(): Promise<string> {
  const settings = await prisma.settings.findUnique({ where: { id: "singleton" } });
  const id = settings?.linkedinIdentityId ?? process.env.EDGES_IDENTITY_ID;
  if (!id) throw new Error("Nenhuma identidade do LinkedIn conectada.");
  return id;
}
