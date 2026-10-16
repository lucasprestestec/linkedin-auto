import Link from "next/link";
import { buildAgenda, type AgendaDay } from "@/lib/agendaBuild";
import type { AgendaPayload } from "@/lib/agendaView";
import { addDays, longDayLabel } from "@/lib/dateKeys";
import { Avatar } from "@/components/Avatar";
import { IconArrowRight } from "@/components/Icons";

// Quantos dias a lista mostra a partir de hoje (o assistente oferece horários nos próximos 10).
const DAYS = 14;
const WEEKDAY_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function relativeLabel(key: string, todayKey: string): string {
  if (key === todayKey) return "hoje";
  if (key === addDays(todayKey, 1)) return "amanhã";
  return longDayLabel(key).split(",")[0].toLowerCase();
}

// A agenda em lista, como a tela aprovada: os próximos dias com as reuniões de cada um e, ao lado,
// os horários que o assistente oferece. O calendário completo (dia, semana, mês) continua em ?v=semana.
export function AgendaList({ payload }: { payload: AgendaPayload }) {
  const now = new Date(payload.nowIso);
  const events = payload.events.map((e) => ({ ...e, start: new Date(e.start), end: new Date(e.end) }));
  const todayKey = payload.focusKey;
  // Três semanas montadas pelo mesmo cálculo do calendário; a lista fica só com os próximos 14 dias.
  const built = [0, 7, 14].map((offset) =>
    buildAgenda({ events, leads: payload.leads, settings: payload.settings, now, view: "semana", focusKey: addDays(todayKey, offset) }),
  );
  const seen = new Set<string>();
  const days: AgendaDay[] = built
    .flatMap((b) => b.days)
    .filter((d) => d.key >= todayKey && d.key < addDays(todayKey, DAYS) && !seen.has(d.key) && seen.add(d.key));
  const shown = days.filter((d) => d.events.length > 0 || !d.offDay);
  const offered = days.filter((d) => d.offerable && d.freeLabels.length > 0);
  const info = built[0];

  return (
    <div className="split">
      <section aria-label="Próximos dias">
        <ol className="tt">
          {shown.map((d) => (
            <li key={d.key} className="tt-day">
              <h2>
                {WEEKDAY_SHORT[d.weekday]} {d.dayNumber}
                <small>{relativeLabel(d.key, todayKey)}</small>
              </h2>
              <div>
                {d.events.length === 0 ? (
                  <p className="empty-day">Nenhuma reunião.</p>
                ) : (
                  d.events.map((e) => (
                    <div key={e.id} className="slot">
                      <time>{e.allDay ? "Dia" : e.time.split("-")[0]}</time>
                      <div className="row" style={{ gap: 12, minWidth: 0 }}>
                        {e.lead && <Avatar firstName={e.lead.name.split(" ")[0]} lastName={e.lead.name.split(" ").at(-1)} size={32} />}
                        <span style={{ minWidth: 0 }}>
                          {e.lead ? (
                            <Link href={`/leads/${e.lead.id}`} className="slot-name">
                              {e.lead.name}
                            </Link>
                          ) : (
                            <b className="slot-name">{e.title || "Compromisso"}</b>
                          )}
                          <small>
                            {e.allDay ? "Dia inteiro" : e.time}
                            {e.lead && e.title ? ` · ${e.title}` : ""}
                            {e.meetLink && (
                              <>
                                {" · "}
                                <a href={e.meetLink} target="_blank" rel="noreferrer">
                                  Abrir videochamada
                                </a>
                              </>
                            )}
                          </small>
                        </span>
                      </div>
                      <span className={`tg ${e.lead ? "tg-ok" : "tg-q"}`}>{e.lead ? "Reunião" : e.busy ? "Ocupado" : "Livre no Google"}</span>
                    </div>
                  ))
                )}
              </div>
            </li>
          ))}
        </ol>
      </section>

      <aside className="side-col" aria-label="Horários oferecidos">
        <section className="panel">
          <h2 className="panel-h">Horários que o assistente oferece</h2>
          <p className="small muted" style={{ marginBottom: 12 }}>
            Dentro do seu expediente ({info.workHours}), reuniões de {info.minutes} minutos, {info.notice}, só nos próximos 10 dias.
          </p>
          {offered.length === 0 ? (
            <p className="small">Nenhum horário livre para oferecer agora.</p>
          ) : (
            offered.map((d) => (
              <div key={d.key} className="slots-day">
                <b>
                  {WEEKDAY_SHORT[d.weekday]} {d.dayNumber}
                </b>
                <span className="slots">
                  {d.freeLabels.map((w) => (
                    <span key={w} className="sl">
                      {w.replace("-", " – ")}
                    </span>
                  ))}
                </span>
              </div>
            ))
          )}
          <Link href="/settings" className="link-arrow" style={{ marginTop: 6 }}>
            Mudar expediente e duração <IconArrowRight size={16} />
          </Link>
        </section>
        {payload.upcomingMeetings > 0 && (
          <p className="cap-note">
            {payload.upcomingMeetings} {payload.upcomingMeetings === 1 ? "reunião marcada" : "reuniões marcadas"} daqui para frente.
          </p>
        )}
      </aside>
    </div>
  );
}
