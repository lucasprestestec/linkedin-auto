"use client";

import Link from "next/link";
import { useEffect } from "react";

// Tela de erro do sistema: em vez da página preta genérica, uma mensagem clara e um jeito de tentar de novo.
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Erro na tela", error);
  }, [error]);

  return (
    <main className="page" style={{ paddingTop: 24 }}>
      <section className="sec err-box" role="alert">
        <h1 className="t-title" style={{ fontSize: 30 }}>
          Algo deu errado
        </h1>
        <p className="t-sub">Esta tela não carregou. Nada foi perdido: tente de novo e, se continuar, volte para as conversas.</p>
        <div className="row wrap" style={{ gap: 8 }}>
          <button type="button" className="btn-solid" onClick={reset}>
            Tentar de novo
          </button>
          <Link href="/" className="btn-line">
            Voltar para Conversas
          </Link>
        </div>
        {error.digest && <span className="err-code">Código do erro: {error.digest}</span>}
      </section>
    </main>
  );
}
