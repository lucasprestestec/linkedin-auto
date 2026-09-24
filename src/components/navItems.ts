import { IconChat, IconRadar, IconSliders } from "./Icons";

// Itens de navegação, compartilhados pelo menu inferior (celular) e pela
// barra lateral (computador).
export const NAV_ITEMS = [
  { href: "/", label: "Leads", Icon: IconChat, hint: "Conversas e funil" },
  { href: "/prospect", label: "Prospecção", Icon: IconRadar, hint: "Encontrar e convidar" },
  { href: "/settings", label: "Ajustes", Icon: IconSliders, hint: "Automação e conta" },
];

export function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" || pathname.startsWith("/leads/") : pathname.startsWith(href);
}
