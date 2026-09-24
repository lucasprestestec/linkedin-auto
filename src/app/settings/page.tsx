import { prisma } from "@/lib/prisma";
import { getIdentity } from "@/lib/edges";
import { logout } from "../actions";
import { ConnectButton } from "./ConnectButton";
import { RefreshStatusButton } from "./RefreshStatusButton";
import { LimitsForm } from "./LimitsForm";
import { AgentInstructionsForm } from "./AgentInstructionsForm";

export const dynamic = "force-dynamic";

async function getConnectionStatus(identityId: string | null) {
  if (!identityId) return { connected: false };
  try {
    const identity = await getIdentity(identityId);
    return { connected: identity.integrations.includes("linkedin"), name: identity.name };
  } catch {
    return { connected: false, error: true };
  }
}

const card: React.CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
  padding: 18,
};

export default async function SettingsPage() {
  const settings = await prisma.settings.findUniqueOrThrow({ where: { id: "singleton" } });
  const status = await getConnectionStatus(settings.linkedinIdentityId);

  return (
    <>
      <header
        style={{
          position: "sticky",
          top: 0,
          background: "var(--bg)",
          borderBottom: "1px solid var(--border)",
          padding: "16px",
          zIndex: 10,
        }}
      >
        <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0, letterSpacing: -0.2 }}>Configurações</h1>
      </header>

      <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 16 }}>
        <section style={card}>
          <h2 style={{ fontSize: 14, fontWeight: 700, margin: "0 0 4px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.4 }}>
            Conta do LinkedIn
          </h2>

          {status.connected ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
              <span style={{ width: 8, height: 8, borderRadius: 999, background: "var(--accent-open)", flexShrink: 0 }} />
              <span style={{ fontSize: 14.5 }}>Conectado{status.name ? ` — ${status.name}` : ""}</span>
            </div>
          ) : (
            <div style={{ marginTop: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <span style={{ width: 8, height: 8, borderRadius: 999, background: "var(--accent-urgent)", flexShrink: 0 }} />
                <span style={{ fontSize: 14.5, color: "var(--text-muted)" }}>Não conectado</span>
              </div>
              <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "0 0 14px" }}>
                Conecte a conta pessoal do LinkedIn para o sistema começar a operar.
              </p>
              <ConnectButton />
              <div style={{ marginTop: 10 }}>
                <RefreshStatusButton />
              </div>
            </div>
          )}
        </section>

        <section style={card}>
          <h2 style={{ fontSize: 14, fontWeight: 700, margin: "0 0 4px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.4 }}>
            Limite diário
          </h2>
          <p style={{ fontSize: 12.5, color: "var(--text-muted)", margin: "0 0 12px" }}>
            Isso protege a conta do LinkedIn: mandar convite ou mensagem demais por dia é o principal motivo de conta ser restringida. O próprio LinkedIn permite no máximo ~25-30 convites por dia numa conta sem Sales Navigator — não adianta colocar um número maior aqui, ele vai ser recusado de qualquer forma.
          </p>
          <LimitsForm dailyInviteLimit={settings.dailyInviteLimit} dailyMessageLimit={settings.dailyMessageLimit} />
        </section>

        <section style={card}>
          <h2 style={{ fontSize: 14, fontWeight: 700, margin: "0 0 4px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.4 }}>
            Agente de IA
          </h2>
          <p style={{ fontSize: 12.5, color: "var(--text-muted)", margin: "0 0 12px" }}>
            O que o agente sabe pra responder: produtos, público, objeções, quando parar e chamar você.
          </p>
          <AgentInstructionsForm value={settings.agentInstructions ?? ""} />
        </section>

        <form action={logout}>
          <button
            type="submit"
            style={{
              width: "100%",
              padding: "10px 16px",
              borderRadius: 8,
              border: "1px solid var(--border)",
              background: "var(--surface)",
              color: "var(--text-muted)",
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            Sair
          </button>
        </form>
      </div>
    </>
  );
}
