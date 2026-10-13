import { IconCalendar, IconCheck, IconLayers, IconMegaphone, IconMessages, IconUser, IconUserSearch } from "./Icons";

// As telas do painel. No celular o menu de baixo mostra só as principais
// (mobile: true); as outras abrem pela tela Conta. No computador aparecem todas.
export const NAV_ITEMS = [
  { href: "/", label: "Conversas", Icon: IconMessages, badge: "attention" as const, mobile: true },
  { href: "/prospect", label: "Prospectar", Icon: IconUserSearch, mobile: true },
  { href: "/approvals", label: "Aprovações", Icon: IconCheck, badge: "drafts" as const, mobile: true },
  { href: "/agenda", label: "Agenda", Icon: IconCalendar, mobile: true },
  { href: "/campaigns", label: "Campanhas", Icon: IconMegaphone, mobile: false },
  { href: "/channels", label: "Canais", Icon: IconLayers, mobile: false },
  { href: "/settings", label: "Conta", Icon: IconUser, mobile: true },
];

export function isActive(pathname: string, href: string) {
  // A tela principal (Conversas) também vale para o chat de uma conversa aberta.
  if (href === "/") return pathname === "/" || pathname.startsWith("/conversations") || pathname.startsWith("/leads/");
  return pathname.startsWith(href);
}
