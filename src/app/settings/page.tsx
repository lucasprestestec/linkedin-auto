import { prisma } from "@/lib/prisma";
import { getIdentity } from "@/lib/edges";
import { logout } from "../actions";
import { ConnectButton } from "./ConnectButton";
import { RefreshStatusButton } from "./RefreshStatusButton";
import { LimitsForm } from "./LimitsForm";
import { AgentInstructionsForm } from "./AgentInstructionsForm";
import { IconChevronRight, IconLinkedin, IconLogout } from "@/components/Icons";

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

export default async function SettingsPage() {
  const settings = await prisma.settings.findUniqueOrThrow({ where: { id: "singleton" } });
  const status = await getConnectionStatus(settings.linkedinIdentityId);
  const connected = status.connected && !settings.linkedinNeedsReconnect;

  return (
    <main className="page">
      <header className="topbar">
        <div className="topbar-titles">
          <div className="eyebrow">Conta e automação</div>
          <h1 className="title-xl">Ajustes</h1>
        </div>
      </header>

      <section className="card card-pad connection rise" aria-label="Conta do LinkedIn">
        <div className="row" style={{ gap: 14 }}>
          <span className="li-mark">
            <IconLinkedin size={26} />
          </span>
          <div className="stack" style={{ gap: 3, flex: 1, minWidth: 0 }}>
            <span className="title-md">Conta do LinkedIn</span>
            {connected ? (
              <span className="row small" style={{ gap: 8, color: "var(--success-ink)", fontWeight: 700 }}>
                <span className="pulse" />
                Conectado{status.name ? ` · ${status.name}` : ""}
              </span>
            ) : (
              <span className="row small" style={{ gap: 8, color: "var(--urgent-ink)", fontWeight: 700 }}>
                <span className="pulse" />
                {settings.linkedinNeedsReconnect ? "Sessão expirou" : "Não conectado"}
              </span>
            )}
          </div>
        </div>

        {!connected && (
          <>
            <p className="small muted">
              {settings.linkedinNeedsReconnect
                ? `${settings.linkedinReconnectReason ?? "A sessão do LinkedIn caiu"}. Reconecte para a automação voltar a funcionar.`
                : "Conecte sua conta pessoal do LinkedIn para o sistema começar a convidar e responder por você."}
            </p>
            <ConnectButton />
            <RefreshStatusButton />
          </>
        )}
      </section>

      <section className="group rise" style={{ "--i": 1 } as React.CSSProperties}>
        <h2 className="group-title">Limites diários</h2>
        <LimitsForm dailyInviteLimit={settings.dailyInviteLimit} dailyMessageLimit={settings.dailyMessageLimit} />
      </section>

      <section className="group rise" style={{ "--i": 2 } as React.CSSProperties}>
        <h2 className="group-title">Agente de IA</h2>
        <AgentInstructionsForm value={settings.agentInstructions ?? ""} />
      </section>

      <section className="group rise" style={{ "--i": 3 } as React.CSSProperties}>
        <h2 className="group-title">Sessão</h2>
        <form action={logout} className="card" style={{ overflow: "hidden" }}>
          <button type="submit" className="setting-row" style={{ width: "100%", border: "none", background: "none", textAlign: "left" }}>
            <span className="setting-icon" style={{ background: "var(--urgent-soft)", color: "var(--urgent-ink)" }}>
              <IconLogout size={19} />
            </span>
            <span style={{ flex: 1, fontWeight: 700, color: "var(--urgent-ink)" }}>Sair da conta</span>
            <IconChevronRight size={18} className="chev" />
          </button>
        </form>
      </section>

      <p className="tiny faint" style={{ textAlign: "center" }}>
        LinkedIn Leads · v0.1
      </p>
    </main>
  );
}
