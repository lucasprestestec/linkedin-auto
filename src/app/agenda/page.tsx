import Link from "next/link";
import { MobileHeader } from "@/components/MobileHeader";
import { IconAlert, IconCalendar } from "@/components/Icons";
import { googleConfigured } from "@/lib/gmail";
import { loadAgenda, parseView } from "@/lib/agendaView";
import { minutesOfDay } from "@/lib/slots";
import { DayPanel, Legend, MonthGrid, Toolbar, WeekGrid } from "./AgendaCalendar";
import "./agenda.css";

// A agenda é lida do Google a cada abertura da tela: sempre o que está lá agora.
export const dynamic = "force-dynamic";

export default async function AgendaPage({ searchParams }: PageProps<"/agenda">) {
  const params = await searchParams;
  const data = await loadAgenda(googleConfigured(), parseView(params.v), params.d);

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
        <div className="cal">
          <Toolbar data={data} />
          <Legend />
          {data.view === "mes" ? (
            <>
              <MonthGrid data={data} />
              {data.selected && <DayPanel day={data.selected} minutes={data.minutes} />}
            </>
          ) : (
            <WeekGrid data={data} nowMin={minutesOfDay(new Date())} />
          )}
          <p className="small muted" style={{ margin: 0 }}>
            {data.upcomingMeetings > 0
              ? `${data.upcomingMeetings} reunião${data.upcomingMeetings > 1 ? "ões" : ""} marcada${data.upcomingMeetings > 1 ? "s" : ""} pela secretária ou por você pela frente. `
              : ""}
            Horários livres: expediente de {data.workHours}, reuniões de {data.minutes} minutos, com 4 horas de antecedência (só nos próximos 10 dias). <Link href="/settings">Ajustar</Link>
          </p>
        </div>
      )}
    </main>
  );
}
