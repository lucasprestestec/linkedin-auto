"use client";

import { useEffect, useState } from "react";
import { PROSPECT_GO, type ProspectGoDetail } from "./prospectEvents";
import { IconFlame, IconSearch } from "@/components/Icons";

type Tab = "warm" | "search";

// Dois caminhos pra achar gente: quem já demonstrou interesse (quente) ou uma
// busca montada com filtros. As duas abas ficam montadas pra não perder o que
// foi digitado ao trocar.
export function ProspectTabs({ warm, search }: { warm: React.ReactNode; search: React.ReactNode }) {
  const [tab, setTab] = useState<Tab>("warm");

  // Atalhos do topo: troca de aba e rola até o passo certo.
  useEffect(() => {
    function onGo(e: Event) {
      const { target } = (e as CustomEvent<ProspectGoDetail>).detail;
      setTab(target === "warm" ? "warm" : "search");
      requestAnimationFrame(() => {
        const el = document.getElementById(target === "paste" ? "paste-step" : target === "builder" ? "search-step" : "prospect-tabs");
        el?.scrollIntoView({ behavior: "smooth", block: "start" });
        if (target === "paste") (document.querySelector("#paste-step textarea") as HTMLTextAreaElement | null)?.focus({ preventScroll: true });
      });
    }
    window.addEventListener(PROSPECT_GO, onGo);
    return () => window.removeEventListener(PROSPECT_GO, onGo);
  }, []);

  return (
    <div id="prospect-tabs" className="stack" style={{ gap: 16, scrollMarginTop: 16 }}>
      <div className="seg-tabs" role="tablist" aria-label="Como encontrar pessoas">
        <button type="button" role="tab" id="tab-warm" aria-controls="panel-warm" aria-selected={tab === "warm"} onClick={() => setTab("warm")}>
          <IconFlame size={16} />
          <span>
            <b>Sugestões quentes</b>
            <small>Quem já te notou</small>
          </span>
        </button>
        <button type="button" role="tab" id="tab-search" aria-controls="panel-search" aria-selected={tab === "search"} onClick={() => setTab("search")}>
          <IconSearch size={16} />
          <span>
            <b>Buscar no LinkedIn</b>
            <small>Monte sua busca com filtros</small>
          </span>
        </button>
      </div>
      <div role="tabpanel" id="panel-warm" aria-labelledby="tab-warm" hidden={tab !== "warm"} className="stack" style={{ gap: 16 }}>
        {warm}
      </div>
      <div role="tabpanel" id="panel-search" aria-labelledby="tab-search" hidden={tab !== "search"} className="stack" style={{ gap: 16 }}>
        {search}
      </div>
    </div>
  );
}
