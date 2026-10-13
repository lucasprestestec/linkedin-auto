"use client";

import { useState, useTransition } from "react";
import { Help } from "@/components/Help";
import { updateLeadAssignee } from "./actions";

// Quem da equipe atende esta pessoa: os avisos de reunião marcada e "precisa de você" vão pra ela.
export function LeadAssignee({ leadId, assigneeId, team }: { leadId: string; assigneeId: string | null; team: { id: string; name: string; role: string | null }[] }) {
  const [value, setValue] = useState(assigneeId ?? "");
  const [, startTransition] = useTransition();

  if (team.length === 0) return null;

  return (
    <section className="sec">
      <h2 className="t-label">
        Responsável
        <Help>Quem da equipe atende esta pessoa. Os avisos de reunião marcada e de &ldquo;precisa de você&rdquo; vão para ela. Sem responsável, vão para quem cuida desse tipo de contato (Conta → Equipe).</Help>
      </h2>
      <select
        className="field"
        value={value}
        aria-label="Responsável"
        onChange={(e) => {
          setValue(e.target.value);
          startTransition(async () => {
            await updateLeadAssignee(leadId, e.target.value || null);
          });
        }}
      >
        <option value="">Sem responsável</option>
        {team.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
            {m.role ? ` · ${m.role}` : ""}
          </option>
        ))}
      </select>
    </section>
  );
}
