import { parseUserToken } from "@/lib/auth";
import { fingerprint } from "@/lib/panelUsers";
import { prisma } from "@/lib/prisma";

// Confere no banco se o cookie ainda vale (pessoa existe, ativa, senha não trocada). Usado pelo proxy,
// que protege TODAS as páginas e rotas de uma vez. A resposta fica 15 s em memória para não pesar
// no banco a cada clique; ponytail: pessoa desativada pode navegar até 15 s depois do clique em "desativar".
const TTL_MS = 15_000;
const cache = new Map<string, { ok: boolean; at: number }>();

export async function sessionStillValid(token: string): Promise<boolean> {
  const now = Date.now();
  const hit = cache.get(token);
  if (hit && now - hit.at < TTL_MS) return hit.ok;
  let ok: boolean;
  const parsed = parseUserToken(token);
  if (parsed) {
    const user = await prisma.panelUser.findUnique({ where: { id: parsed.id }, select: { active: true, passwordHash: true } });
    ok = Boolean(user && user.active && fingerprint(user.passwordHash) === parsed.fp);
  } else {
    // Cookie da senha única: só vale enquanto ninguém tem acesso individual.
    ok = (await prisma.panelUser.count({ where: { passwordHash: { not: null } } })) === 0;
  }
  if (cache.size > 500) cache.clear();
  cache.set(token, { ok, at: now });
  return ok;
}
