"use client";

import { useState } from "react";

// Duas abas, no computador e no celular: a conversa (com a caixa de resposta) e a ficha da pessoa.
// À direita das abas fica a troca de canal, que só vale para a conversa.
const TABS = [
  { key: "chat", label: "Conversa" },
  { key: "about", label: "Ficha" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

// Cada aba vem como prop separada (não num array): elementos em array exigiriam key.
export function LeadTabs({ composer, channels, ...panels }: Record<TabKey, React.ReactNode> & { composer: React.ReactNode; channels: React.ReactNode }) {
  const [active, setActive] = useState<TabKey>("chat");

  return (
    <>
      <div className="tabs-line">
        <div role="tablist" aria-label="Seções" className="row" style={{ gap: 4 }}>
          {TABS.map((t) => (
            <button key={t.key} type="button" role="tab" className="tab2" aria-selected={active === t.key} onClick={() => setActive(t.key)}>
              {t.label}
            </button>
          ))}
        </div>
        <span className="grow-sp" />
        {active === "chat" && channels}
      </div>
      <div className="chat-body" hidden={active !== "chat"}>
        {panels.chat}
      </div>
      {active === "chat" && <div className="composer-slot">{composer}</div>}
      <div className="ficha" hidden={active !== "about"}>
        {panels.about}
      </div>
    </>
  );
}
