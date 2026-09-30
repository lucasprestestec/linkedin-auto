import { MobileHeader } from "@/components/MobileHeader";
import { IconAlert, IconCalendar } from "@/components/Icons";
import { googleConfigured } from "@/lib/gmail";
import { loadAgenda } from "@/lib/agendaView";
import { parseView } from "@/lib/agendaBuild";
import { AgendaClient } from "./AgendaClient";
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
        // `key` = a janela lida: ao buscar outra janela no servidor, o calendário recomeça dela.
        <AgendaClient key={`${data.fromKey}|${data.view}|${data.focusKey}`} payload={data} />
      )}
    </main>
  );
}
