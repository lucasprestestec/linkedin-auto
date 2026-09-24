// Tudo é exibido no fuso do corretor — o servidor (Vercel) roda em UTC.
const TIME_ZONE = "America/Sao_Paulo";

export function initials(firstName?: string | null, lastName?: string | null): string {
  const a = firstName?.[0] ?? "";
  const b = lastName?.[0] ?? "";
  return (a + b).toUpperCase() || "?";
}

// Gradiente determinístico por pessoa, gerado do nome — sem depender de dado novo.
const AVATAR_GRADIENTS = [
  ["#6a5cff", "#9b7bff"],
  ["#2d6bff", "#5fb2ff"],
  ["#ff6b4a", "#ffa15c"],
  ["#12a567", "#56d39b"],
  ["#e0447d", "#ff8aa8"],
  ["#0e9ab8", "#4fd1d9"],
  ["#c2410c", "#f59e0b"],
  ["#7c3aed", "#e879f9"],
];

export function avatarGradient(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  const [from, to] = AVATAR_GRADIENTS[hash % AVATAR_GRADIENTS.length];
  return `linear-gradient(135deg, ${from}, ${to})`;
}

export function relativeTime(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.round(diffMs / 60000);

  if (diffMin < 1) return "agora";
  if (diffMin < 60) return `${diffMin} min`;

  const diffHours = Math.round(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h`;

  const diffDays = Math.round(diffHours / 24);
  if (diffDays === 1) return "ontem";
  if (diffDays < 7) return `${diffDays} dias`;

  const diffWeeks = Math.round(diffDays / 7);
  if (diffWeeks < 5) return `${diffWeeks} sem`;

  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", timeZone: TIME_ZONE });
}

export function shortDate(date: Date): string {
  return date.toLocaleDateString("pt-BR", { day: "numeric", month: "short", timeZone: TIME_ZONE });
}

export function clockTime(date: Date): string {
  return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: TIME_ZONE });
}

function dayKey(date: Date): string {
  return date.toLocaleDateString("en-CA", { timeZone: TIME_ZONE });
}

// Rótulo do separador de dia no chat: "Hoje", "Ontem" ou "12 de set.".
export function dayLabel(date: Date): string {
  const today = new Date();
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  const key = dayKey(date);
  if (key === dayKey(today)) return "Hoje";
  if (key === dayKey(yesterday)) return "Ontem";
  return date.toLocaleDateString("pt-BR", { day: "numeric", month: "short", timeZone: TIME_ZONE });
}

export function sameDay(a: Date, b: Date): boolean {
  return dayKey(a) === dayKey(b);
}

export function greeting(): string {
  const hour = Number(new Date().toLocaleString("en-US", { hour: "numeric", hour12: false, timeZone: TIME_ZONE }));
  if (hour < 5 || hour >= 18) return "Boa noite";
  if (hour < 12) return "Bom dia";
  return "Boa tarde";
}

export function todayLabel(): string {
  const label = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", timeZone: TIME_ZONE });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

// "mariana-costa-4b2a91" → "Mariana Costa": nome legível a partir do slug do
// perfil, para a lista da prospecção não ser só um monte de URL.
export function nameFromProfileUrl(url: string): { firstName: string; lastName: string; slug: string } {
  const slug = decodeURIComponent(url.replace(/^https?:\/\/(www\.)?linkedin\.com\/in\//i, "").replace(/\/$/, ""));
  const words = slug
    .split(/[-_]+/)
    .filter((w) => w && !/\d/.test(w))
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
  return { firstName: words[0] ?? slug, lastName: words.slice(1).join(" "), slug };
}
