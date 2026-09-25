import { IconHome, IconMegaphone, IconMessages, IconUser } from "./Icons";

// As quatro telas do painel — iguais no celular (menu inferior) e no
// computador (barra lateral).
export const NAV_ITEMS = [
  { href: "/", label: "Início", Icon: IconHome },
  { href: "/campaigns", label: "Campanhas", Icon: IconMegaphone },
  { href: "/conversations", label: "Conversas", Icon: IconMessages, badge: "attention" as const },
  { href: "/settings", label: "Conta", Icon: IconUser },
];

export function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  if (href === "/conversations") return pathname.startsWith("/conversations") || pathname.startsWith("/leads/");
  return pathname.startsWith(href);
}
