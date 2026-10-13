"use client";

import { useState } from "react";

// Celular: duas abas (conversa e detalhes). Computador: a conversa ocupa a tela e
// os detalhes ficam num painel ao lado.
const TABS = [
  { key: "chat", label: "Conversa" },
  { key: "about", label: "Detalhes" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

// Cada aba vem como prop separada (não num array): elementos em array exigiriam key.
export function LeadTabs({ composer, ...panels }: Record<TabKey, React.ReactNode> & { composer: React.ReactNode }) {
  const [active, setActive] = useState<TabKey>("chat");

  return (
    <>
      <div className="tabs only-mobile" role="tablist" aria-label="Seções" style={{ padding: "8px 18px", background: "var(--card)" }}>
        {TABS.map((t) => (
          <button key={t.key} type="button" role="tab" aria-selected={active === t.key} onClick={() => setActive(t.key)}>
            {t.label}
          </button>
        ))}
      </div>
      <div className={`chat-body${active === "about" ? " about-open" : ""}`}>
        <div className="chat-pane">{panels.chat}</div>
        <div className="about-pane only-mobile">{panels.about}</div>
      </div>
      <div className="composer-slot">{composer}</div>
    </>
  );
}
