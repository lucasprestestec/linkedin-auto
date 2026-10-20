"use client";

import { useState, useTransition } from "react";
import { Help } from "@/components/Help";
import type { MessageChannel } from "@prisma/client";
import { CHANNEL_NAME } from "@/lib/channelPrefs";
import { setChannelPrefs } from "./actions";

const CHANNELS: MessageChannel[] = ["LINKEDIN", "EMAIL", "WHATSAPP"];

// Por onde esta pessoa quer ser chamada. O assistente tenta o canal preferido primeiro e nunca puxa conversa pelos bloqueados.
export function LeadChannels({ leadId, preferred, blocked }: { leadId: string; preferred: MessageChannel | null; blocked: MessageChannel[] }) {
  const [prefs, setPrefs] = useState({ preferred: preferred ?? "", blocked });
  const [pending, start] = useTransition();

  function save(next: { preferred: string; blocked: MessageChannel[] }) {
    setPrefs(next);
    start(async () => {
      const r = await setChannelPrefs(leadId, next.preferred, next.blocked);
      setPrefs({ preferred: r.preferredChannel ?? "", blocked: r.blockedChannels });
    });
  }

  return (
    <section className="sec">
      <h2 className="t-label">
        Canais
        <Help>Ex.: &ldquo;prefere e-mail; não abordar pelo WhatsApp&rdquo;. O assistente tenta o preferido primeiro. Nos bloqueados ele não começa conversa, mas ainda responde se a pessoa escrever por lá.</Help>
      </h2>
      <div className="form" style={{ gap: 10 }}>
        <select className="field" value={prefs.preferred} disabled={pending} aria-label="Canal preferido" onChange={(e) => save({ ...prefs, preferred: e.target.value })}>
          <option value="">Sem preferência</option>
          {CHANNELS.filter((c) => !prefs.blocked.includes(c)).map((c) => (
            <option key={c} value={c}>
              Prefere {CHANNEL_NAME[c]}
            </option>
          ))}
        </select>
        <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
          {CHANNELS.map((c) => (
            <label key={c} className="row" style={{ gap: 6 }}>
              <input
                type="checkbox"
                checked={prefs.blocked.includes(c)}
                disabled={pending}
                onChange={(e) => save({ preferred: prefs.preferred === c ? "" : prefs.preferred, blocked: e.target.checked ? [...prefs.blocked, c] : prefs.blocked.filter((x) => x !== c) })}
              />
              Não abordar pelo {CHANNEL_NAME[c]}
            </label>
          ))}
        </div>
      </div>
    </section>
  );
}
