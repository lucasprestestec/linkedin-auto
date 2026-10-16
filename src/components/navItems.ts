import { IconCalendar, IconCheck, IconLayers, IconMegaphone, IconMessages, IconUser, IconUserSearch } from "./Icons";

// As telas do painel. No celular o menu de baixo mostra só as principais
// (mobile: true); as outras abrem pela tela Conta. No computador aparecem todas.
// `color` é a cor da placa da área no menu (variáveis --a-* do CSS).
export const NAV_ITEMS = [
  { href: "/", label: "Conversas", Icon: IconMessages, color: "var(--a-conv)", badge: "attention" as const, mobile: true },
  { href: "/prospect", label: "Prospectar", Icon: IconUserSearch, color: "var(--a-cont)", mobile: true },
  { href: "/approvals", label: "Aprovações", Icon: IconCheck, color: "var(--a-hoje)", badge: "drafts" as const, mobile: true },
  { href: "/agenda", label: "Agenda", Icon: IconCalendar, color: "var(--a-agen)", mobile: true },
  { href: "/campaigns", label: "Campanhas", Icon: IconMegaphone, color: "var(--a-camp)", mobile: false },
  { href: "/channels", label: "Canais", Icon: IconLayers, color: "var(--a-ajus)", mobile: false },
  { href: "/settings", label: "Conta", Icon: IconUser, color: "var(--a-ajus)", mobile: true },
];

export function isActive(pathname: string, href: string) {
  // A tela principal (Conversas) também vale para o chat de uma conversa aberta.
  if (href === "/") return pathname === "/" || pathname.startsWith("/conversations") || pathname.startsWith("/leads/");
  return pathname.startsWith(href);
}
