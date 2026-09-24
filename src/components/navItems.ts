import { IconBars, IconHome, IconMegaphone, IconMessages, IconSettings, IconUserSearch } from "./Icons";

// Itens de navegação. A barra lateral (computador) mostra todos; o menu
// inferior (celular) mostra os de `mobile` e junta o resto em "Mais".
export const NAV_ITEMS = [
  { href: "/", label: "Leads", Icon: IconHome, mobile: true },
  { href: "/prospect", label: "Prospecção", Icon: IconUserSearch, mobile: true },
  { href: "/messages", label: "Mensagens", Icon: IconMessages, mobile: true, badge: "unanswered" as const },
  { href: "/settings#campanhas", label: "Campanhas", Icon: IconMegaphone, mobile: false },
  { href: "/stats", label: "Estatísticas", Icon: IconBars, mobile: true },
  { href: "/settings", label: "Configurações", Icon: IconSettings, mobile: false },
];

export function isActive(pathname: string, href: string) {
  if (href.includes("#")) return false;
  return href === "/" ? pathname === "/" || pathname.startsWith("/leads/") : pathname.startsWith(href);
}
