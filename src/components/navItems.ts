import { IconHome, IconLayers, IconMegaphone, IconMessages, IconUser, IconUserSearch } from "./Icons";

// As telas do painel — iguais no celular (menu inferior) e no computador
// (barra lateral). "Canais" fica só na barra lateral; no celular abre pela Conta.
export const NAV_ITEMS = [
  { href: "/", label: "Início", Icon: IconHome },
  { href: "/prospect", label: "Prospectar", Icon: IconUserSearch },
  { href: "/campaigns", label: "Campanhas", Icon: IconMegaphone },
  { href: "/conversations", label: "Conversas", Icon: IconMessages, badge: "attention" as const },
  { href: "/channels", label: "Canais", Icon: IconLayers, desktopOnly: true },
  { href: "/settings", label: "Conta", Icon: IconUser },
];

export function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  if (href === "/conversations") return pathname.startsWith("/conversations") || pathname.startsWith("/leads/");
  return pathname.startsWith(href);
}
