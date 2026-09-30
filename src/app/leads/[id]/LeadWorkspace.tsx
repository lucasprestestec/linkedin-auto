"use client";

import { createContext, useContext, useState } from "react";

// Computador: o painel de detalhes fica fechado e abre pelo botão no topo da conversa.
const DetailsContext = createContext<{ open: boolean; toggle: () => void }>({ open: false, toggle: () => {} });

export function LeadWorkspace({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <DetailsContext.Provider value={{ open, toggle: () => setOpen((o) => !o) }}>
      <div className={`lead-shell${open ? " open" : ""}`}>{children}</div>
    </DetailsContext.Provider>
  );
}

export function DetailsToggle() {
  const { open, toggle } = useContext(DetailsContext);
  return (
    <button type="button" className="btn-line btn-sm only-desktop" aria-expanded={open} onClick={toggle}>
      {open ? "Fechar" : "Detalhes"}
    </button>
  );
}
