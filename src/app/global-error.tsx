"use client";

// Último recurso: falha no próprio layout do sistema. Precisa ter o seu <html> e estilo próprio (o CSS do sistema pode não ter carregado).
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="pt-BR">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#f5f6fa", color: "#0f0d11" }}>
        <main style={{ maxWidth: 440, margin: "20vh auto", padding: 24 }} role="alert">
          <h1 style={{ fontSize: 26, margin: 0 }}>Algo deu errado</h1>
          <p style={{ color: "#4a4a55" }}>O sistema não conseguiu abrir. Nada foi perdido. Tente de novo.</p>
          <button type="button" onClick={reset} style={{ padding: "10px 18px", border: 0, borderRadius: 12, background: "#3e5bd7", color: "#fff", fontWeight: 600, cursor: "pointer" }}>
            Tentar de novo
          </button>
          {error.digest && <p style={{ color: "#6b7188", fontSize: 12 }}>Código do erro: {error.digest}</p>}
        </main>
      </body>
    </html>
  );
}
