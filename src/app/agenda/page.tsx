import { MobileHeader } from "@/components/MobileHeader";
import { googleConfigured } from "@/lib/gmail";
import { loadAgenda } from "@/lib/agendaView";
import { parseView } from "@/lib/agendaBuild";
import { AgendaClient } from "./AgendaClient";
import "./agenda.css";

// A agenda é lida do Google a cada abertura da tela: sempre o que está lá agora.
export const dynamic = "force-dynamic";

export default async function AgendaPage({ searchParams }: PageProps<"/agenda">) {
  const params = await searchParams;
  const data = await loadAgenda(googleConfigured(), parseView(params.v), params.d, typeof params.v === "string");

  return (
    <main className="page">
      <MobileHeader />
      <header className="p-head">
        <div>
          <h1 className="t-title">Agenda</h1>
          <p className="t-sub">
            {data.connected && data.googleEmail
              ? `Agenda da conta Google conectada (${data.googleEmail}). As reuniões que o assistente marcar entram aqui.`
              : "Sua agenda do Google: o que já está marcado e os horários que o assistente pode oferecer."}
          </p>
        </div>
      </header>

      {!data.connected ? (
        <section className="sec">
          <p>
            {data.needsReconnect
              ? "O Google está conectado, mas sem a permissão da agenda. Reconecte e marque a permissão de agenda."
              : "Conecte o seu Google para ver a agenda aqui e para o assistente marcar as reuniões."}
          </p>
          {data.configured ? (
            <div>
              <a href="/api/email/google/start" className="btn-solid btn-sm">
                {data.needsReconnect ? "Reconectar o Google" : "Conectar o Google"}
              </a>
            </div>
          ) : (
            <p className="hint">O login do Google ainda não foi ativado neste sistema.</p>
          )}
        </section>
      ) : data.error ? (
        <section className="sec" role="alert">
          <p className="field-error">Não consegui ler a sua agenda: {data.error}</p>
          {data.configured && (
            <div>
              <a href="/api/email/google/start" className="btn-line btn-sm">
                Reconectar o Google
              </a>
            </div>
          )}
        </section>
      ) : (
        // `key` = a janela lida: ao buscar outra janela no servidor, o calendário recomeça dela.
        <AgendaClient key={`${data.fromKey}|${data.view}|${data.focusKey}`} payload={data} />
      )}
    </main>
  );
}
