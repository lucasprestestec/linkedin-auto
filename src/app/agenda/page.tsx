import Link from "next/link";
import { MobileHeader } from "@/components/MobileHeader";
import { IconAlert, IconCalendar, IconExternal } from "@/components/Icons";
import { googleConfigured } from "@/lib/gmail";
import { loadAgenda, type AgendaDay } from "@/lib/agendaView";

// A agenda é lida do Google a cada abertura da tela: sempre o que está lá agora.
export const dynamic = "force-dynamic";

function DayCard({ day, minutes }: { day: AgendaDay; minutes: number }) {
  return (
    <section className="panel" style={{ padding: 16, display: "grid", gap: 10 }} aria-label={day.label}>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
        <h2 style={{ margin: 0, fontSize: 17, textTransform: "capitalize" }}>
          {day.label}
          {day.isToday && <span className="count-pill" style={{ marginLeft: 8 }}>hoje</span>}
        </h2>
        <span className="small muted">{day.events.length ? `${day.events.length} compromisso${day.events.length > 1 ? "s" : ""}` : "sem compromissos"}</span>
      </div>

      {day.events.length > 0 && (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 }}>
          {day.events.map((e) => (
            <li key={e.id} className="row" style={{ gap: 10, alignItems: "flex-start", flexWrap: "wrap", opacity: e.busy ? 1 : 0.6 }}>
              <strong style={{ minWidth: 92, fontVariantNumeric: "tabular-nums" }}>{e.time}</strong>
              <span style={{ flex: 1, minWidth: 0 }}>
                {e.title}
                {!e.busy && <span className="tiny faint"> (marcado como livre)</span>}
              </span>
              {e.lead && (
                <Link href={`/leads/${e.lead.id}`} className="soft-badge pill-qualified" title="Reunião marcada pela secretária">
                  <i className="dot" /> Marcada pela secretária · {e.lead.name}
                </Link>
              )}
              {e.meetLink && (
                <a href={e.meetLink} target="_blank" rel="noreferrer" className="small">
                  <IconExternal size={13} /> Meet
                </a>
              )}
            </li>
          ))}
        </ul>
      )}

      <p className="small" style={{ margin: 0 }}>
        {day.offDay ? (
          <span className="muted">Fora do expediente.</span>
        ) : day.free.length ? (
          <>
            <strong>Livre para reunião de {minutes} min:</strong> {day.free.join("  ·  ")}
          </>
        ) : (
          <span className="muted">Nenhum horário livre {day.isToday ? "hoje" : "neste dia"}.</span>
        )}
      </p>
    </section>
  );
}

export default async function AgendaPage() {
  const data = await loadAgenda(googleConfigured());

  return (
    <main className="page">
      <MobileHeader />
      <header>
        <h1 className="display page-title">Agenda</h1>
        <p className="hero-sub">
          Sua agenda do Google: o que já está marcado e os horários que a secretária pode oferecer aos leads
          {data.connected && data.googleEmail ? ` (${data.googleEmail})` : ""}.
        </p>
      </header>

      {!data.connected ? (
        <section className="panel" style={{ padding: 20, display: "grid", gap: 12 }}>
          <p style={{ margin: 0 }}>
            <IconCalendar size={16} />{" "}
            {data.needsReconnect
              ? "O Google está conectado, mas sem a permissão da agenda. Reconecte e marque a permissão de agenda."
              : "Conecte o seu Google para ver a agenda aqui e para a secretária marcar as reuniões."}
          </p>
          {data.configured ? (
            <a href="/api/email/google/start" className="btn btn-primary btn-sm" style={{ justifySelf: "start" }}>
              {data.needsReconnect ? "Reconectar o Google" : "Conectar o Google"}
            </a>
          ) : (
            <p className="tiny faint" style={{ margin: 0 }}>
              O login do Google ainda não foi configurado neste sistema.
            </p>
          )}
        </section>
      ) : data.error ? (
        <section className="panel" style={{ padding: 20, display: "grid", gap: 12 }} role="alert">
          <p className="error-text" style={{ margin: 0 }}>
            <IconAlert size={15} /> Não consegui ler a sua agenda: {data.error}
          </p>
          {data.configured && (
            <a href="/api/email/google/start" className="btn btn-secondary btn-sm" style={{ justifySelf: "start" }}>
              Reconectar o Google
            </a>
          )}
        </section>
      ) : (
        <>
          <section className="panel" style={{ padding: 16, display: "grid", gap: 6 }}>
            <strong>
              {data.secretaryMeetings === 0
                ? "Nenhuma reunião marcada pela secretária nos próximos dias."
                : `${data.secretaryMeetings} reunião${data.secretaryMeetings > 1 ? "ões" : ""} marcada${data.secretaryMeetings > 1 ? "s" : ""} pela secretária nos próximos dias.`}
            </strong>
            <span className="small muted">
              Horários livres: expediente de {data.workHours}, reuniões de {data.minutes} minutos, com 4 horas de antecedência. Mostrando os próximos 10 dias.{" "}
              <Link href="/settings">Ajustar</Link>
            </span>
          </section>
          <div style={{ display: "grid", gap: 14 }}>
            {data.days.map((d) => (
              <DayCard key={d.key} day={d} minutes={data.minutes} />
            ))}
          </div>
        </>
      )}
    </main>
  );
}
