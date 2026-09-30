"use client";

import { useOptimistic, useTransition } from "react";
import { setApprovalMode } from "./actions";

// Liga/desliga "aprovar antes de enviar". Desligado, a secretária envia sozinha.
export function ApprovalToggle({ on }: { on: boolean }) {
  const [optimistic, setOptimistic] = useOptimistic(on);
  const [, startTransition] = useTransition();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={optimistic}
      aria-label={optimistic ? "Desligar aprovação antes de enviar" : "Ligar aprovação antes de enviar"}
      className="switch"
      onClick={() =>
        startTransition(async () => {
          setOptimistic(!optimistic);
          await setApprovalMode(!optimistic);
        })
      }
    />
  );
}
