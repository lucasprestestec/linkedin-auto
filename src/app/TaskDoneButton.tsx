"use client";

import { useTransition } from "react";
import { setLeadTaskDone } from "./leads/[id]/actions";

// "Feito" num lembrete da tela Hoje.
export function TaskDoneButton({ taskId }: { taskId: string }) {
  const [pending, start] = useTransition();
  return (
    <button type="button" className="btn-line" disabled={pending} onClick={() => start(async () => void (await setLeadTaskDone(taskId, true)))}>
      {pending ? "Salvando…" : "Feito"}
    </button>
  );
}
