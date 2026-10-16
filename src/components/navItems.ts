import { IconCalendar, IconMegaphone, IconMessages, IconSliders, IconSparkles, IconSun, IconUserSearch } from "./Icons";

// As áreas do painel, como placas de aeroporto: cada uma com a sua cor (variáveis --a-* do CSS).
// `foot`: fica no pé do menu do computador. No celular o menu de baixo mostra só as de `mobile: true`;
// as outras abrem pela tela Ajustes. `match`: outros endereços que acendem a mesma placa.
export const NAV_ITEMS = [
  { href: "/", label: "Hoje", Icon: IconSun, color: "var(--a-hoje)", badge: "drafts" as const, mobile: true },
  { href: "/conversations", label: "Conversas", Icon: IconMessages, color: "var(--a-conv)", badge: "attention" as const, mobile: true, match: ["/leads/"] },
  { href: "/contacts", label: "Contatos", Icon: IconUserSearch, color: "var(--a-cont)", mobile: true, match: ["/prospect"] },
  { href: "/campaigns", label: "Campanhas", Icon: IconMegaphone, color: "var(--a-camp)", mobile: false },
  { href: "/agenda", label: "Agenda", Icon: IconCalendar, color: "var(--a-agen)", mobile: true },
  { href: "/assistente", label: "Assistente", Icon: IconSparkles, color: "var(--a-ia)", mobile: false, foot: true, match: ["/voz", "/calibrar"] },
  { href: "/settings", label: "Ajustes", Icon: IconSliders, color: "var(--a-ajus)", mobile: true, foot: true, match: ["/channels"] },
];

export function isActive(pathname: string, item: { href: string; match?: string[] }) {
  if (item.href === "/") return pathname === "/";
  if (item.href.includes("#")) return item.match?.some((m) => pathname.startsWith(m)) ?? false;
  return pathname.startsWith(item.href) || (item.match?.some((m) => pathname.startsWith(m)) ?? false);
}
