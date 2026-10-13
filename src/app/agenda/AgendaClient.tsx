"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useSyncExternalStore, useTransition } from "react";
import { IconChevronRight, IconExternal } from "@/components/Icons";
import { WEEKDAYS_SHORT, addDays, addMonths, longDayLabel } from "@/lib/dateKeys";
import { buildAgenda, insideWindow, visibleKeys, type AgendaDay, type AgendaEvent, type AgendaViewMode, type BuiltAgenda } from "@/lib/agendaBuild";
import type { AgendaPayload } from "@/lib/agendaView";
import { minutesOfDay } from "@/lib/slots";

// A agenda. O padrão é uma GRADE DE HORÁRIOS (horas na vertical, dias na horizontal): cada
// compromisso é um bloco no seu horário e os horários livres aparecem escritos "Livre".
// Todos os compromissos já vieram do servidor (mês em foco + vizinhos): trocar de dia,
// de visão ou de semana não volta ao servidor, então é instantâneo e a tela não pula.

const urlFor = (view: AgendaViewMode, key: string) => `/agenda?v=${view}&d=${key}`;

const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

// Tela de celular? (no servidor, e na primeira pintura, é "não": evita divergência na hidratação)
const MOBILE = "(max-width: 720px)";
function subscribeMobile(onChange: () => void) {
  const media = window.matchMedia(MOBILE);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

export function AgendaClient({ payload }: { payload: AgendaPayload }) {
  const router = useRouter();
  const [loading, startLoad] = useTransition();
  const [pickedView, setView] = useState<AgendaViewMode>(payload.view);
  // A pessoa já escolheu a visão (na URL ou clicando)? Se não, o celular abre em "Dia":
  // uma coluna só, legível.
  const [chosen, setChosen] = useState(payload.viewExplicit);
  const isMobile = useSyncExternalStore(subscribeMobile, () => window.matchMedia(MOBILE).matches, () => false);
  const view: AgendaViewMode = !chosen && isMobile ? "dia" : pickedView;
  // `anchor` decide o período mostrado; `selected` é o dia em foco (painel do mês, destaque).
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
  const today = built.todayKey;

  // Mantém o endereço da tela igual ao que se vê (dá pra atualizar a página ou mandar o link).
  useEffect(() => {
    window.history.replaceState(window.history.state, "", urlFor(view, selected));
  }, [view, selected]);

  // Vai para outra visão/data: dentro da janela carregada é só trocar o estado; fora dela busca no servidor.
  function go(nextView: AgendaViewMode, nextAnchor: string, nextSelected: string) {
    if (insideWindow(visibleKeys(nextView, nextAnchor), loaded)) {
      setView(nextView);
      if (nextView !== view) setChosen(true);
      setAnchor(nextAnchor);
      setSelected(nextSelected);
    } else {
      startLoad(() => router.push(urlFor(nextView, nextSelected)));
    }
  }

  function step(dir: 1 | -1) {
    if (view === "dia") return go(view, addDays(anchor, dir), addDays(anchor, dir));
    if (view === "semana") return go(view, addDays(anchor, 7 * dir), addDays(selected, 7 * dir));
    const next = addMonths(anchor, dir);
    return go(view, next, next.slice(0, 7) === today.slice(0, 7) ? today : next);
  }

  const noun = view === "dia" ? "dia" : view === "semana" ? "semana" : "mês";
  const empty = built.days.every((d) => d.events.length === 0);

  return (
    <div className={`cal cal-${view}${loading ? " cal-loading" : ""}`} aria-busy={loading}>
      <div className="cal-toolbar">
        <div className="cal-nav">
          <button type="button" className="cal-btn" onClick={() => step(-1)} aria-label={`Voltar um ${noun}`}>
            <IconChevronRight size={16} style={{ transform: "rotate(180deg)" }} />
          </button>
          <button type="button" className="cal-btn" onClick={() => step(1)} aria-label={`Avançar um ${noun}`}>
            <IconChevronRight size={16} />
          </button>
          <h2 className="cal-title">{built.title}</h2>
          <button type="button" className="cal-btn" onClick={() => go(view, today, today)}>
            Hoje
          </button>
          {loading && <span className="small muted">Carregando…</span>}
        </div>
        <div className="cal-seg" role="group" aria-label="Visão">
          {(["dia", "semana", "mes"] as const).map((v) => (
            <button key={v} type="button" aria-pressed={view === v} onClick={() => go(v, selected, selected)}>
              {v === "dia" ? "Dia" : v === "semana" ? "Semana" : "Mês"}
            </button>
          ))}
        </div>
      </div>

      {view !== "mes" && (
        <p className="cal-hint">
          Os blocos <b className="cal-hint-free">verdes</b> são horários <b>livres</b>, onde o assistente pode marcar reunião. Os outros blocos são compromissos que já estão na agenda.
          {empty && " Nada marcado neste período: tudo o que está em verde está livre."}
        </p>
      )}

      {view === "mes" ? (
        <div className="cal-layout">
          <div className="cal-main">
            <MonthGrid built={built} selected={day?.key ?? selected} onSelect={setSelected} />
          </div>
          {day && <DayPanel day={day} minutes={built.minutes} />}
        </div>
      ) : (
        <TimeGrid built={built} selected={day?.key ?? selected} onSelect={setSelected} nowMin={minutesOfDay(now)} single={view === "dia"} />
      )}

      <p className="small muted cal-foot">
        {payload.upcomingMeetings > 0
          ? `${payload.upcomingMeetings} reunião${payload.upcomingMeetings > 1 ? "ões" : ""} marcada${payload.upcomingMeetings > 1 ? "s" : ""} pela frente. `
          : ""}
        O assistente oferece horários dentro do seu expediente ({built.workHours}), para reuniões de {built.minutes} minutos, com 4 horas de antecedência e só nos próximos 10 dias. <Link href="/settings">Ajustar</Link>
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Grade de horários (dia e semana)
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

const HPX = 56;

function TimeGrid({ built, selected, onSelect, nowMin, single }: { built: BuiltAgenda; selected: string; onSelect: (key: string) => void; nowMin: number; single: boolean }) {
  const timed = built.days.flatMap((d) => d.events.filter((e) => !e.allDay));
  const first = Math.min(built.workStartHour - 1, ...timed.map((e) => Math.floor(e.startMin / 60)), 24);
  const last = Math.max(built.workEndHour + 1, ...timed.map((e) => Math.ceil(e.endMin / 60)), 0);
  const startHour = Math.max(0, Math.min(first, built.workStartHour - 1));
  const endHour = Math.min(24, Math.max(last, built.workEndHour + 1));
  const height = (endHour - startHour) * HPX;
  const top = (min: number) => ((min - startHour * 60) / 60) * HPX;
  const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i);
  const hasAllDay = built.days.some((d) => d.events.some((e) => e.allDay));

  return (
    <div className={`cal-week${single ? " single" : ""}`}>
      <div className="cal-week-inner" style={{ ["--hpx" as string]: `${HPX}px` }}>
        <div className="cal-wh" aria-hidden="true" />
        {built.days.map((d) => (
          <button key={d.key} type="button" onClick={() => onSelect(d.key)} aria-pressed={d.key === selected} className={`cal-wh${d.isToday ? " today" : ""}${d.key === selected ? " sel" : ""}`}>
            {WEEKDAYS_SHORT[d.weekday]}
            <b>{d.dayNumber}</b>
            {d.isToday && <span className="cal-wh-today">hoje</span>}
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
                    <span key={e.id} className={`cal-chip${e.lead ? " sec" : e.busy ? "" : " soft"}`} title={e.title}>
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
            {/* fora do expediente: mais escuro */}
            <div className="cal-offhours" style={{ top: 0, height: Math.max(0, top(built.workStartHour * 60)) }} />
            <div className="cal-offhours" style={{ top: top(built.workEndHour * 60), height: Math.max(0, height - top(built.workEndHour * 60)) }} />

            {/* horários livres: verde, com a palavra "Livre" */}
            {d.offerable &&
              !d.offDay &&
              d.free.map((r, i) => {
                const h = ((r.endMin - r.startMin) / 60) * HPX;
                return (
                  <div key={i} className="cal-freeblk" style={{ top: top(r.startMin), height: h }}>
                    <b>Livre</b>
                    {h >= 44 && <span>{hhmm(r.startMin)} às {hhmm(r.endMin)}</span>}
                  </div>
                );
              })}

            {/* compromissos */}
            {place(d.events.filter((e) => !e.allDay)).map(({ e, lane, lanes }) => {
              const h = Math.max(26, ((e.endMin - e.startMin) / 60) * HPX - 2);
              const style = {
                top: top(e.startMin),
                height: h,
                left: `calc(${(lane / lanes) * 100}% + 3px)`,
                width: `calc(${100 / lanes}% - 6px)`,
              };
              // Compromisso curto (30 min): nome e horário na mesma linha, senão o horário é cortado.
              const cls = `cal-evblk${e.lead ? " sec" : e.busy ? "" : " soft"}${h < 46 ? " short" : ""}${h < 46 && lanes > 1 ? " narrow" : ""}`;
              const inner = (
                <>
                  <b>{e.title}</b>
                  <span>{e.time.replace("-", " às ")}</span>
                  {e.lead && <em>Reunião marcada pelo assistente com {e.lead.name}</em>}
                </>
              );
              return e.lead ? (
                <Link key={e.id} href={`/leads/${e.lead.id}`} className={cls} style={style} title={`${e.time} ${e.title}`}>
                  {inner}
                </Link>
              ) : (
                <div key={e.id} className={cls} style={style} title={`${e.time} ${e.title}`}>
                  {inner}
                </div>
              );
            })}

            {/* o que já passou fica esmaecido; a linha vermelha é "agora" */}
            {d.isPast && <div className="cal-past" style={{ top: 0, height }} />}
            {d.isToday && nowMin > startHour * 60 && <div className="cal-past" style={{ top: 0, height: Math.min(height, top(nowMin)) }} />}
            {d.isToday && nowMin >= startHour * 60 && nowMin <= endHour * 60 && <div className="cal-now" style={{ top: top(nowMin) }} />}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mês (panorama) + painel do dia
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
              {shown.map((e) => (
                <span key={e.id + d.key} className={`cal-chip${e.lead ? " sec" : e.busy ? "" : " soft"}`} title={`${e.time} ${e.title}`}>
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

function EventRow({ e }: { e: AgendaEvent }) {
  return (
    <li className={`cal-ev${e.lead ? " sec" : ""}${e.busy ? "" : " soft"}`}>
      <span className="cal-ev-time">{e.time}</span>
      <span className="cal-ev-body">
        <strong>{e.title}</strong>
        {!e.busy && <span className="tiny faint"> (marcado como livre)</span>}
        {e.lead && (
          <span className="cal-ev-lead">
            Marcada pelo assistente · <Link href={`/leads/${e.lead.id}`}>{e.lead.name}</Link>
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
        {day.isToday && <span className="pill pill-accent">hoje</span>}
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
          <p className="cal-empty">O assistente só oferece horários dos próximos 10 dias.</p>
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
