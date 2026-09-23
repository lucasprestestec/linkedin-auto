export function initials(firstName?: string | null, lastName?: string | null): string {
  const a = firstName?.[0] ?? "";
  const b = lastName?.[0] ?? "";
  return (a + b).toUpperCase() || "?";
}

// Cor determinística por pessoa, gerada do nome — sem depender de dado novo.
const AVATAR_HUES = [205, 165, 25, 285, 340, 45];

export function avatarColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  const hue = AVATAR_HUES[hash % AVATAR_HUES.length];
  return `hsl(${hue} 35% 32%)`;
}

export function relativeTime(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.round(diffMs / 60000);

  if (diffMin < 1) return "agora";
  if (diffMin < 60) return `há ${diffMin} min`;

  const diffHours = Math.round(diffMin / 60);
  if (diffHours < 24) return `há ${diffHours}h`;

  const diffDays = Math.round(diffHours / 24);
  if (diffDays === 1) return "ontem";
  if (diffDays < 7) return `há ${diffDays} dias`;

  const diffWeeks = Math.round(diffDays / 7);
  if (diffWeeks < 5) return `há ${diffWeeks} sem`;

  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}
