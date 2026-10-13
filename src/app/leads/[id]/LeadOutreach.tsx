"use client";

import { useState, useTransition } from "react";
import { Help } from "@/components/Help";
import { setLeadOutreach } from "./actions";

// Quando a secretária NÃO deve escrever pra pessoa: outra IA está conversando
// com ela (ex.: a Sofia) ou ela pediu pra não ser mais contatada.
export function LeadOutreach({ leadId, otherAiActive, doNotContact }: { leadId: string; otherAiActive: boolean; doNotContact: boolean }) {
  const [values, setValues] = useState({ otherAiActive, doNotContact });
  const [pending, start] = useTransition();

  function toggle(field: "otherAiActive" | "doNotContact") {
    const value = !values[field];
    setValues((v) => ({ ...v, [field]: value }));
    start(() => setLeadOutreach(leadId, field, value));
  }

  return (
    <section className="sec">
      <h2 className="t-label">
        Abordagem
        <Help>Com qualquer uma das duas ligada, o assistente não manda nada sozinho para esta pessoa, em nenhum canal.</Help>
      </h2>
      <div className="settings">
        <div className="setting" style={{ padding: "8px 0" }}>
          <span className="setting-text">
            <b>Em conversa com outra IA</b>
            <small>ex.: a Sofia. O assistente não aborda nem responde; se a pessoa escrever, passa pra você.</small>
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={values.otherAiActive}
            aria-label="Em conversa com outra IA"
            className="switch"
            disabled={pending}
            onClick={() => toggle("otherAiActive")}
          />
        </div>
        <div className="setting" style={{ padding: "8px 0" }}>
          <span className="setting-text">
            <b>Não quer mais contato</b>
            <small>recusou ou pediu pra parar. Liga sozinho quando o assistente encerra uma recusa.</small>
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={values.doNotContact}
            aria-label="Não quer mais contato"
            className="switch"
            disabled={pending}
            onClick={() => toggle("doNotContact")}
          />
        </div>
      </div>
    </section>
  );
}
