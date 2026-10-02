"use client";

import { useSyncExternalStore } from "react";

// LÃª um atributo data-* da <html> (tema, barra lateral) e atualiza quando ele muda.
export function useRootAttr(name: "theme" | "side"): string {
  return useSyncExternalStore(
    (notify) => {
      const observer = new MutationObserver(notify);
      observer.observe(document.documentElement, { attributes: true, attributeFilter: [`data-${name}`] });
      return () => observer.disconnect();
    },
    () => document.documentElement.dataset[name] ?? "",
    () => "",
  );
}
