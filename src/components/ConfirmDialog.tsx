"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  // Ação que apaga ou perde algo: o botão de confirmar fica vermelho.
  danger?: boolean;
}

// Confirmação no estilo do sistema (no lugar da caixa cinza do navegador). Usa o <dialog> nativo: o foco fica preso
// dentro, Esc cancela e o leitor de tela anuncia o título. Uso: const { ask, dialog } = useConfirm(); if (!(await ask({...}))) return; ... {dialog}
export function useConfirm() {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((ok: boolean) => void) | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  const ask = useCallback(
    (o: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        resolver.current = resolve;
        setOpts(o);
      }),
    [],
  );

  useEffect(() => {
    if (opts) dialogRef.current?.showModal();
  }, [opts]);

  function close(ok: boolean) {
    dialogRef.current?.close();
    setOpts(null);
    resolver.current?.(ok);
    resolver.current = null;
  }

  const dialog = opts ? (
    <dialog
      ref={dialogRef}
      className="confirm"
      aria-labelledby="confirm-title"
      onCancel={(e) => {
        e.preventDefault();
        close(false);
      }}
      onClick={(e) => {
        if (e.target === dialogRef.current) close(false);
      }}
    >
      <h2 id="confirm-title" className="confirm-title">
        {opts.title}
      </h2>
      {opts.message && <p className="confirm-text">{opts.message}</p>}
      <div className="confirm-actions">
        <button type="button" className="btn-line" onClick={() => close(false)} autoFocus>
          {opts.cancelLabel ?? "Cancelar"}
        </button>
        <button type="button" className={opts.danger ? "btn-danger" : "btn-solid"} onClick={() => close(true)}>
          {opts.confirmLabel ?? "Confirmar"}
        </button>
      </div>
    </dialog>
  ) : null;

  return { ask, dialog };
}
