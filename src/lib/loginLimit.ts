// Limite de tentativas de login: 5 erros em 15 minutos bloqueiam aquele login + aparelho por 15 minutos.
// ponytail: memória de cada instância do servidor; quem tentar de várias instâncias ganha algumas
// tentativas a mais. Se virar problema, mover a contagem para o banco.
const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILS = 5;
const fails = new Map<string, number[]>();

function recent(key: string, now: number): number[] {
  const list = (fails.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (list.length) fails.set(key, list);
  else fails.delete(key);
  return list;
}

export function loginBlocked(key: string, now = Date.now()): boolean {
  return recent(key, now).length >= MAX_FAILS;
}

export function loginFailed(key: string, now = Date.now()): void {
  fails.set(key, [...recent(key, now), now]);
}

export function loginSucceeded(key: string): void {
  fails.delete(key);
}
