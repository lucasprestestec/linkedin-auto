"use client";

import { useState } from "react";

// Celular: duas abas. Computador: sem abas — a conversa fica no centro e o
// "Sobre" já está no painel lateral.
const TABS = [
  { key: "chat", label: "Conversa" },
  { key: "about", label: "Sobre" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

// Cada aba vem como prop separada (não num array): elementos em array exigiriam key.
export function LeadTabs({ composer, ...panels }: Record<TabKey, React.ReactNode> & { composer: React.ReactNode }) {
  const [active, setActive] = useState<TabKey>("chat");
  const tabs = TABS.map((t) => ({ ...t, content: panels[t.key] }));

  return (
    <>
      <div className="lead-tabs" role="tablist" aria-label="Seções do lead">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            id={`tab-${t.key}`}
            aria-controls={`panel-${t.key}`}
            aria-selected={active === t.key}
            onClick={() => setActive(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tabs.map((t) => (
        <div
          key={t.key}
          role="tabpanel"
          id={`panel-${t.key}`}
          aria-labelledby={`tab-${t.key}`}
          hidden={active !== t.key}
          className={`lead-panel${t.key === "chat" ? " lead-panel-chat" : ""}`}
        >
          {t.content}
        </div>
      ))}
      <div className={active === "chat" ? "composer-slot" : "composer-slot composer-off"}>{composer}</div>
    </>
  );
}
