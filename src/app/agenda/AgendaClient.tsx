"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { IconChevronRight, IconExternal } from "@/components/Icons";
import { WEEKDAYS_SHORT, addDays, addMonths, longDayLabel } from "@/lib/dateKeys";
import { buildAgenda, insideWindow, visibleKeys, type AgendaDay, type AgendaEvent, type AgendaViewMode, type BuiltAgenda } from "@/lib/agendaBuild";
import type { AgendaPayload } from "@/lib/agendaView";
import { minutesOfDay } from "@/lib/slots";

// O calendário. Todos os compromissos já vieram do servidor (mês em foco + vizinhos):
// escolher um dia, trocar Mês/Semana e andar para o mês seguinte não volta ao servidor,
// então é instantâneo e a tela não pula. Só sair da janela carregada busca de novo.

const urlFor = (view: AgendaViewMode, key: string) => `/agenda?v=${view}&d=${key}`;

function chipClass(e: AgendaEvent) {
  return `cal-chip${e.lead ? " sec" : e.busy ? "" : " soft"}`;
}

export function AgendaClient({ payload }: { payload: AgendaPayload }) {
  const router = useRouter();
  const [loading, startLoad] = useTransition();
  const [view, setView] = useState<AgendaViewMode>(payload.view);
  // `anchor` decide o mês (ou a semana) mostrado; `selected` é o dia aberto no painel.
  const [anchor, setAnchor] = useState(payload.focusKey);
  const [selected, setSelected] = useState(payload.focusKey);

  const now = useMemo(() => new Date(payload.nowIso), [payload.nowIso]);
  const events = useMemo(() => payload.events.map((e) => ({ ...e, start: new Date(e.start), end: new Date(e.end) })), [payload.events]);
  const loaded = useMemo(() => ({ fromKey: payload.fromKey, toKey: payload.toKey }), [payload.fromKey, payload.toKey]);

  const built: BuiltAgenda = useMemo(
    () => buildAgenda({ events, leads: payload.leads, settings: payload.settings, now, view, focusKey: anchor }),
    [events, payload.leads, payload.settings, now, view, anchor],
  );
  const day = built.days.find((d) => d.key === selected) ?? built.days.find((d) => d.key === anchor) ?? built.days[0];

  // Mantém o endereço da tela igual ao que se vê (dá pra atualizar a página ou mandar o link).
  useEffect(() => {
    window.history.replaceState(window.history.state, "", urlFor(view, selected));
  }, [view, selected]);

  // Vai para outra visão/data: dentro da janela carregada é só trocar o estado; fora dela busca no servidor.
  function go(nextView: AgendaViewMode, nextAnchor: string, nextSelected: string) {
    if (insideWindow(visibleKeys(nextView, nextAnchor), loaded)) {
      setView(nextView);
      setAnchor(nextAnchor);
      setSelected(nextSelected);
    } else {
      startLoad(() => router.push(urlFor(nextView, nextSelected)));
    }
  }

  const today = built.todayKey;
  const goPrevNext = (dir: 1 | -1) => {
    const nextAnchor = view === "semana" ? addDays(anchor, 7 * dir) : addMonths(anchor, dir);
    // No mês, abre o dia de hoje se ele estiver lá; senão o dia 1. Na semana, o mesmo dia da semana.
    const inThatMonth = view === "mes" && nextAnchor.slice(0, 7) === today.slice(0, 7);
    go(view, nextAnchor, view === "semana" ? addDays(selected, 7 * dir) : inThatMonth ? today : nextAnchor);
  };

  return (
    <div className={`cal${loading ? " cal-loading" : ""}`} aria-busy={loading}>
      <div className="cal-toolbar">
        <div className="cal-nav">
          <button type="button" className="cal-btn" onClick={() => goPrevNext(-1)} aria-label={view === "mes" ? "Mês anterior" : "Semana anterior"}>
            <IconChevronRight size={16} style={{ transform: "rotate(180deg)" }} />
          </button>
          <button type="button" className="cal-btn" onClick={() => goPrevNext(1)} aria-label={view === "mes" ? "Próximo mês" : "Próxima semana"}>
            <IconChevronRight size={16} />
          </button>
          <h2 className="cal-title">{built.title}</h2>
          <button type="button" className="cal-btn" onClick={() => go(view, today, today)}>
            Hoje
          </button>
          {loading && <span className="small muted">Carregando…</span>}
        </div>
        <div className="cal-seg" role="group" aria-label="Visão">
          <button type="button" aria-pressed={view === "mes"} onClick={() => go("mes", selected, selected)}>
            Mês
          </button>
          <button type="button" aria-pressed={view === "semana"} onClick={() => go("semana", selected, selected)}>
            Semana
          </button>
        </div>
      </div>

      <Legend view={view} />

      <div className="cal-layout">
        <div className="cal-main">
          {view === "mes" ? (
            <MonthGrid built={built} selected={day?.key ?? selected} onSelect={setSelected} />
          ) : (
            <WeekGrid built={built} selected={day?.key ?? selected} onSelect={setSelected} nowMin={minutesOfDay(now)} />
          )}
        </div>
        {day && <DayPanel day={day} minutes={built.minutes} />}
      </div>

      <p className="small muted cal-foot">
        {payload.upcomingMeetings > 0
          ? `${payload.upcomingMeetings} reunião${payload.upcomingMeetings > 1 ? "ões" : ""} marcada${payload.upcomingMeetings > 1 ? "s" : ""} pela frente. `
          : ""}
        Horário livre = expediente de {built.workHours}, reuniões de {built.minutes} minutos, com 4 horas de antecedência, só nos próximos 10 dias. <Link href="/settings">Ajustar</Link>
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Legenda: cada item mostra o mesmo desenho que aparece no calendário.
// ---------------------------------------------------------------------------

function Legend({ view }: { view: AgendaViewMode }) {
  return (
    <ul className="cal-legend" aria-label="Como ler o calendário">
      <li>
        <span className="cal-chip sec cal-sample">10:00 Ana</span> Reunião que a secretária marcou
      </li>
      <li>
        <span className="cal-chip cal-sample">14:00 Almoço</span> Seus outros compromissos
      </li>
      <li>
        {view === "mes" ? <i className="cal-free-dot cal-sample-dot" /> : <span className="cal-freeblk cal-sample-blk" />} {view === "mes" ? "Dia com horário livre para novas reuniões" : "Horário livre para novas reuniões"}
      </li>
    </ul>
  );
}

// ---------------------------------------------------------------------------
// Mês
// ---------------------------------------------------------------------------

const MAX_CHIPS = 3;

function MonthGrid({ built, selected, onSelect }: { built: BuiltAgenda; selected: string; onSelect: (key: string) => void }) {
  return (
    <div className="cal-month">
      <div className="cal-weekdays" aria-hidden="true">
        {WEEKDAYS_SHORT.map((w) => (
          <span key={w}>{w}</span>
        ))}
      </div>
      <div className="cal-weeks">
        {built.days.map((d) => {
          const shown = d.events.slice(0, MAX_CHIPS);
          const more = d.events.length - shown.length;
          const cls = ["cal-cell", d.inMonth ? "" : "out", d.offDay ? "off" : "", d.isToday ? "today" : "", d.key === selected ? "sel" : ""].filter(Boolean).join(" ");
          return (
            <button key={d.key} type="button" className={cls} onClick={() => onSelect(d.key)} aria-pressed={d.key === selected} aria-label={`${longDayLabel(d.key)}: ${d.events.length} compromisso(s)`}>
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
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Painel do dia (fica ao lado do calendário; no celular, embaixo)
// ---------------------------------------------------------------------------

function EventRow({ e }: { e: AgendaEvent }) {
  return (
    <li className={`cal-ev${e.lead ? " sec" : ""}${e.busy ? "" : " soft"}`}>
      <span className="cal-ev-time">{e.time}</span>
      <span className="cal-ev-body">
        <strong>{e.title}</strong>
        {!e.busy && <span className="tiny faint"> (marcado como livre)</span>}
        {e.lead && (
          <span className="cal-ev-lead">
            Marcada pela secretária · <Link href={`/leads/${e.lead.id}`}>{e.lead.name}</Link>
          </span>
        )}
      </span>
      {e.meetLink && (
        <a href={e.meetLink} target="_blank" rel="noreferrer" className="small cal-ev-meet">
          <IconExternal size={13} /> Meet
        </a>
      )}
    </li>
  );
}

function DayPanel({ day, minutes }: { day: AgendaDay; minutes: number }) {
  return (
    <aside className="cal-side" aria-label={`Detalhes de ${longDayLabel(day.key)}`}>
      <header className="cal-side-head">
        <h3>{longDayLabel(day.key)}</h3>
        {day.isToday && <span className="count-pill">hoje</span>}
      </header>

      <section>
        <h4>
          Compromissos <span className="cal-count">{day.events.length}</span>
        </h4>
        {day.events.length > 0 ? (
          <ul className="cal-list">
            {day.events.map((e) => (
              <EventRow key={e.id + day.key} e={e} />
            ))}
          </ul>
        ) : (
          <p className="cal-empty">Nada marcado neste dia.</p>
        )}
      </section>

      <section>
        <h4>Horários livres para reunião de {minutes} min</h4>
        {day.offDay ? (
          <p className="cal-empty">Fora do expediente.</p>
        ) : day.isPast ? (
          <p className="cal-empty">Dia que já passou.</p>
        ) : !day.offerable ? (
          <p className="cal-empty">A secretária só oferece horários dos próximos 10 dias.</p>
        ) : day.freeLabels.length > 0 ? (
          <ul className="cal-free-list">
            {day.freeLabels.map((w) => (
              <li key={w}>{w.replace("-", " às ")}</li>
            ))}
          </ul>
        ) : (
          <p className="cal-empty">Nenhum horário livre neste dia.</p>
        )}
      </section>
    </aside>
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

function WeekGrid({ built, selected, onSelect, nowMin }: { built: BuiltAgenda; selected: string; onSelect: (key: string) => void; nowMin: number }) {
  const timed = built.days.flatMap((d) => d.events.filter((e) => !e.allDay));
  const first = Math.min(built.workStartHour - 1, ...timed.map((e) => Math.floor(e.startMin / 60)), 24);
  const last = Math.max(built.workEndHour + 1, ...timed.map((e) => Math.ceil(e.endMin / 60)), 0);
  const startHour = Math.max(0, Math.min(first, built.workStartHour - 1));
  const endHour = Math.min(24, Math.max(last, built.workEndHour + 1));
  const HPX = 46;
  const height = (endHour - startHour) * HPX;
  const top = (min: number) => ((min - startHour * 60) / 60) * HPX;
  const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i);
  const hasAllDay = built.days.some((d) => d.events.some((e) => e.allDay));

  return (
    <div className="cal-week">
      <div className="cal-week-inner" style={{ ["--hpx" as string]: `${HPX}px` }}>
        <div className="cal-wh" aria-hidden="true" />
        {built.days.map((d) => (
          <button key={d.key} type="button" onClick={() => onSelect(d.key)} aria-pressed={d.key === selected} className={`cal-wh${d.isToday ? " today" : ""}${d.key === selected ? " sel" : ""}`}>
            {WEEKDAYS_SHORT[d.weekday]}
            <b>{d.dayNumber}</b>
          </button>
        ))}

        {hasAllDay && (
          <>
            <div className="cal-allday-label">dia todo</div>
            {built.days.map((d) => (
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
        {built.days.map((d) => (
          <div key={d.key} className={`cal-col${d.offDay ? " off" : ""}${d.key === selected ? " sel" : ""}`} style={{ height }}>
            {d.offerable &&
              !d.offDay &&
              d.free.map((r, i) => (
                <div key={i} className="cal-freeblk" style={{ top: top(r.startMin), height: ((r.endMin - r.startMin) / 60) * HPX }} title="Livre para reunião" />
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
