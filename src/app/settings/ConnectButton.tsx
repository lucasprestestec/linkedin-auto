"use client";

import { useState, useTransition } from "react";
import { getOrCreateIdentityLoginLink } from "./actions";

export function ConnectButton() {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleClick() {
    setError(null);
    startTransition(async () => {
      try {
        const link = await getOrCreateIdentityLoginLink();
        window.location.href = link;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Falha ao gerar link de conexão.");
      }
    });
  }

  return (
    <div>
      <button
        onClick={handleClick}
        disabled={pending}
        style={{
          padding: "10px 16px",
          borderRadius: 8,
          border: "none",
          background: "var(--primary)",
          color: "#fff",
          fontSize: 14,
          fontWeight: 600,
          cursor: "pointer",
          opacity: pending ? 0.7 : 1,
        }}
      >
        {pending ? "Gerando link..." : "Conectar minha conta do LinkedIn"}
      </button>
      {error && (
        <p style={{ color: "var(--danger)", fontSize: 12.5, marginTop: 8 }}>{error}</p>
      )}
    </div>
  );
}
