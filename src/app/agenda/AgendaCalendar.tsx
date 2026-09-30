import Link from "next/link";
import { IconChevronRight, IconExternal } from "@/components/Icons";
import { WEEKDAYS_SHORT, longDayLabel } from "@/lib/dateKeys";
import type { AgendaData, AgendaDay, AgendaEvent } from "@/lib/agendaView";

// Só apresentação: recebe os dados prontos (AgendaData) e desenha o calendário.
// Navegação por links (a tela é renderizada no servidor a cada clique).

const href = (view: "mes" | "semana", d: string) => `/agenda?v=${view}&d=${d}`;

export function Toolbar({ data }: { data: AgendaData }) {
  const { view, focusKey, todayKey } = data;
  return (
    <div className="cal-toolbar">
      <div className="cal-nav">
        <Link className="cal-btn" href={href(view, data.prevKey)} aria-label={view === "mes" ? "Mês anterior" : "Semana anterior"}>
          <IconChevronRight size={16} style={{ transform: "rotate(180deg)" }} />
        </Link>
        <Link className="cal-btn" href={href(view, data.nextKey)} aria-label={view === "mes" ? "Próximo mês" : "Próxima semana"}>
          <IconChevronRight size={16} />
        </Link>
        <h2 className="cal-title">{data.title}</h2>
        <Link className="cal-btn" href={href(view, todayKey)}>
          Hoje
        </Link>
      </div>
      <div className="cal-seg" role="tablist" aria-label="Visão">
        <Link href={href("mes", focusKey)} aria-current={view === "mes" ? "page" : undefined}>
          Mês
        </Link>
        <Link href={href("semana", focusKey)} aria-current={view === "semana" ? "page" : undefined}>
          Semana
        </Link>
      </div>
    </div>
  );
}

export function Legend() {
  return (
    <div className="cal-legend" aria-label="Legenda">
      <span>
        <i className="cal-swatch sec" /> Marcada pela secretária
      </span>
      <span>
        <i className="cal-swatch ev" /> Seus compromissos
      </span>
      <span>
        <i className="cal-swatch free" /> Livre para reunião
      </span>
    </div>
  );
}

function chipClass(e: AgendaEvent) {
  return `cal-chip${e.lead ? " sec" : e.busy ? "" : " soft"}`;
}

// ---------------------------------------------------------------------------
// Mês
// ---------------------------------------------------------------------------

const MAX_CHIPS = 3;

export function MonthGrid({ data }: { data: AgendaData }) {
  return (
    <div className="cal-month">
      <div className="cal-weekdays" aria-hidden="true">
        {WEEKDAYS_SHORT.map((w) => (
          <span key={w}>{w}</span>
        ))}
      </div>
      <div className="cal-weeks">
        {data.days.map((d) => {
          const shown = d.events.slice(0, MAX_CHIPS);
          const more = d.events.length - shown.length;
          const cls = ["cal-cell", d.inMonth ? "" : "out", d.offDay ? "off" : "", d.isToday ? "today" : "", d.key === data.focusKey ? "sel" : ""].filter(Boolean).join(" ");
          return (
            <Link key={d.key} href={href("mes", d.key)} className={cls} aria-label={`${longDayLabel(d.key)}: ${d.events.length} compromisso(s)`}>
              <span className="cal-daynum">{d.dayNumber}</span>
              {d.offerable && !d.offDay && d.free.length > 0 && <i className="cal-free-dot" title="Tem horário livre" />}
              {shown.map((e) => (
                <span key={e.id + d.key} className={chipClass(e)} title={`${e.time} ${e.title}`}>
                  {e.allDay ? "" : `${e.time.slice(0, 5)} `}
                  {e.title}
                </span>
              ))}
              {more > 0 && <span className="cal-more">+{more} mais</span>}
              {d.events.length > 0 && (
                <span className="cal-dots" aria-hidden="true">
                  {d.events.slice(0, 4).map((e) => (
                    <i key={e.id + d.key} className={`cal-dot${e.lead ? " sec" : ""}`} />
                  ))}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function EventRow({ e }: { e: AgendaEvent }) {
  return (
    <li className={`cal-ev${e.lead ? " sec" : ""}${e.busy ? "" : " soft"}`}>
      <span className="cal-ev-time">{e.time}</span>
      <span className="cal-ev-body">
        {e.title}
        {!e.busy && <span className="tiny faint"> (marcado como livre)</span>}
        {e.lead && (
          <>
            <br />
            <span className="small">
              Marcada pela secretária · <Link href={`/leads/${e.lead.id}`}>{e.lead.name}</Link>
            </span>
          </>
        )}
      </span>
      {e.meetLink && (
        <a href={e.meetLink} target="_blank" rel="noreferrer" className="small">
          <IconExternal size={13} /> Meet
        </a>
      )}
    </li>
  );
}

export function DayPanel({ day, minutes }: { day: AgendaDay; minutes: number }) {
  return (
    <section className="cal-panel" aria-label={longDayLabel(day.key)}>
      <h2>
        {longDayLabel(day.key)}
        {day.isToday && <span className="count-pill" style={{ marginLeft: 8 }}>hoje</span>}
      </h2>
      {day.events.length > 0 ? (
        <ul className="cal-list">
          {day.events.map((e) => (
            <EventRow key={e.id} e={e} />
          ))}
        </ul>
      ) : (
        <p className="cal-empty">Nenhum compromisso neste dia.</p>
      )}
      {day.offDay ? (
        <p className="cal-empty">Fora do expediente.</p>
      ) : day.offerable ? (
        day.freeLabels.length > 0 ? (
          <div className="cal-free">
            <strong>Livre para reunião de {minutes} min:</strong> {day.freeLabels.join("  ·  ")}
          </div>
        ) : (
          <p className="cal-empty">{day.isPast ? "" : "Nenhum horário livre neste dia."}</p>
        )
      ) : day.isPast ? null : (
        <p className="cal-empty">A secretária só oferece horários dos próximos dias.</p>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Semana
// ---------------------------------------------------------------------------

interface Placed {
  e: AgendaEvent;
  lane: number;
  lanes: number;
}

// Eventos que se sobrepõem ficam lado a lado (cada grupo divide a largura).
function place(events: AgendaEvent[]): Placed[] {
  const sorted = [...events].sort((a, b) => a.startMin - b.startMin || b.endMin - a.endMin);
  const out: Placed[] = [];
  let cluster: Placed[] = [];
  let clusterEnd = -1;
  let laneEnds: number[] = [];
  const flush = () => {
    for (const p of cluster) p.lanes = laneEnds.length;
    out.push(...cluster);
    cluster = [];
    laneEnds = [];
  };
  for (const e of sorted) {
    if (cluster.length && e.startMin >= clusterEnd) flush();
    let lane = laneEnds.findIndex((end) => end <= e.startMin);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(0);
    }
    laneEnds[lane] = e.endMin;
    clusterEnd = Math.max(clusterEnd, e.endMin);
    cluster.push({ e, lane, lanes: 1 });
  }
  flush();
  return out;
}

export function WeekGrid({ data, nowMin }: { data: AgendaData; nowMin: number }) {
  const timed = data.days.flatMap((d) => d.events.filter((e) => !e.allDay));
  const first = Math.min(data.workStartHour - 1, ...timed.map((e) => Math.floor(e.startMin / 60)), 24);
  const last = Math.max(data.workEndHour + 1, ...timed.map((e) => Math.ceil(e.endMin / 60)), 0);
  const startHour = Math.max(0, Math.min(first, data.workStartHour - 1));
  const endHour = Math.min(24, Math.max(last, data.workEndHour + 1));
  const HPX = 46;
  const height = (endHour - startHour) * HPX;
  const top = (min: number) => ((min - startHour * 60) / 60) * HPX;
  const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i);
  const hasAllDay = data.days.some((d) => d.events.some((e) => e.allDay));

  return (
    <div className="cal-week">
      <div className="cal-week-inner" style={{ ["--hpx" as string]: `${HPX}px` }}>
        <div className="cal-wh" aria-hidden="true" />
        {data.days.map((d) => (
          <Link key={d.key} href={href("mes", d.key)} className={`cal-wh${d.isToday ? " today" : ""}`}>
            {WEEKDAYS_SHORT[d.weekday]}
            <b>{d.dayNumber}</b>
          </Link>
        ))}

        {hasAllDay && (
          <>
            <div className="cal-allday-label">dia todo</div>
            {data.days.map((d) => (
              <div key={d.key} className="cal-allday">
                {d.events
                  .filter((e) => e.allDay)
                  .map((e) => (
                    <span key={e.id} className={chipClass(e)} title={e.title}>
                      {e.title}
                    </span>
                  ))}
              </div>
            ))}
          </>
        )}

        <div className="cal-hours" style={{ height }}>
          {hours.map((h) => (
            <span key={h} className="cal-hour-label" style={{ top: (h - startHour) * HPX }}>
              {h === startHour ? "" : `${String(h).padStart(2, "0")}:00`}
            </span>
          ))}
        </div>
        {data.days.map((d) => (
          <div key={d.key} className={`cal-col${d.offDay ? " off" : ""}`} style={{ height }}>
            {d.offerable &&
              !d.offDay &&
              d.free.map((r, i) => (
                <div key={i} className="cal-freeblk" style={{ top: top(r.startMin), height: ((r.endMin - r.startMin) / 60) * HPX }} title={`Livre ${String(Math.floor(r.startMin / 60)).padStart(2, "0")}:${String(r.startMin % 60).padStart(2, "0")}`} />
              ))}
            {place(d.events.filter((e) => !e.allDay)).map(({ e, lane, lanes }) => {
              const style = {
                top: top(e.startMin),
                height: Math.max(20, ((e.endMin - e.startMin) / 60) * HPX - 2),
                left: `calc(${(lane / lanes) * 100}% + 2px)`,
                width: `calc(${100 / lanes}% - 4px)`,
              };
              const cls = `cal-evblk${e.lead ? " sec" : e.busy ? "" : " soft"}`;
              const inner = (
                <>
                  <b>{e.title}</b>
                  {e.time}
                </>
              );
              return e.lead ? (
                <Link key={e.id} href={`/leads/${e.lead.id}`} className={cls} style={style} title={`${e.time} ${e.title} (marcada pela secretária)`}>
                  {inner}
                </Link>
              ) : (
                <div key={e.id} className={cls} style={style} title={`${e.time} ${e.title}`}>
                  {inner}
                </div>
              );
            })}
            {d.isToday && nowMin >= startHour * 60 && nowMin <= endHour * 60 && <div className="cal-now" style={{ top: top(nowMin) }} />}
          </div>
        ))}
      </div>
    </div>
  );
}
