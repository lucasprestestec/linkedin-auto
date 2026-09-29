// Validação e formato dos canais de uma pessoa (ficha pessoal e "Adicionar
// contato" usam as mesmas regras).

export function parseEmail(raw: string): { email: string | null } | { error: string } {
  const email = raw.trim().toLowerCase();
  if (!email) return { email: null };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "E-mail inválido." };
  return { email };
}

// Guarda só dígitos com DDI: (51) 99999-0000 → 5551999990000.
export function parsePhone(raw: string): { phone: string | null } | { error: string } {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return { phone: null };
  if (digits.length < 10 || digits.length > 13) return { error: "WhatsApp inválido. Use DDD + número (ex.: 51 99999-0000)." };
  return { phone: digits.length <= 11 ? `55${digits}` : digits };
}
