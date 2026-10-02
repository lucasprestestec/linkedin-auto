"use client";

import { THEME_KEY } from "@/lib/prefs";
import { useRootAttr } from "./useRootAttr";
import { IconMoon, IconSun } from "./Icons";

// Alterna entre claro e escuro; a escolha fica guardada neste navegador. Sem escolha, segue o aparelho.
export function ThemeToggle({ className = "icon-btn" }: { className?: string }) {
  const dark = useRootAttr("theme") === "dark";

  function toggle() {
    const next = dark ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {}
  }

  return (
    <button type="button" className={className} onClick={toggle} aria-label={dark ? "Usar tema claro" : "Usar tema escuro"} title={dark ? "Tema claro" : "Tema escuro"}>
      {dark ? <IconSun size={18} /> : <IconMoon size={18} />}
    </button>
  );
}
