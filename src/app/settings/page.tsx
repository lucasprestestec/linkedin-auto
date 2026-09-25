import { prisma } from "@/lib/prisma";
import { getIdentity } from "@/lib/edges";
import { logout } from "../actions";
import { ConnectButton } from "./ConnectButton";
import { RefreshStatusButton } from "./RefreshStatusButton";
import { NotificationsCard } from "./NotificationsCard";
import { pushPublicKey } from "@/lib/push";
import { IdealClientForm } from "./IdealClientForm";
import { OwnerNameForm } from "./OwnerNameForm";
import { MobileHeader } from "@/components/MobileHeader";
import { ExclusionListForm } from "./ExclusionListForm";
import { IconChevronRight, IconDownload, IconLinkedin, IconLogout } from "@/components/Icons";

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
    <main className="page account">
      <MobileHeader />
      <header className="page-hero rise">
        <h1 className="display page-title">
          Sua <span className="name-grad">conta.</span>
        </h1>
        <p className="hero-sub">Só o essencial: sua conta do LinkedIn e quem a automação deve (e não deve) procurar.</p>
      </header>

      <div className="account-col">
        <section className="group rise">
          <h2 className="group-title">Você</h2>
          <OwnerNameForm value={settings.ownerName ?? ""} />
        </section>

        <section className="group rise">
          <h2 className="group-title">LinkedIn</h2>
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
        </section>

        <section id="alcance" className="group rise" style={{ scrollMarginTop: 90 }}>
          <h2 className="group-title">Quem você quer alcançar</h2>
          <IdealClientForm value={settings.targetAudience ?? ""} />
        </section>

        <section className="group rise">
          <h2 className="group-title">Quem nunca contatar</h2>
          <ExclusionListForm value={settings.exclusionList ?? ""} />
        </section>

        {/* Sem as chaves de push no servidor, o card só mostraria um aviso técnico. */}
        {pushPublicKey() && (
          <section className="group rise">
            <h2 className="group-title">Avisos</h2>
            <NotificationsCard publicKey={pushPublicKey()} />
          </section>
        )}

        <div className="card rise" style={{ overflow: "hidden" }}>
          <a href="/api/export/leads" className="setting-row" download>
            <span className="setting-icon" style={{ background: "var(--brand-soft)", color: "var(--brand-ink)" }}>
              <IconDownload size={19} />
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: "block", fontWeight: 700 }}>Baixar meus leads</span>
              <span className="tiny faint">Planilha para Excel ou Google Planilhas</span>
            </span>
            <IconChevronRight size={18} className="chev" />
          </a>
          <form action={logout} style={{ borderTop: "1px solid var(--border)" }}>
            <button type="submit" className="setting-row" style={{ width: "100%", border: "none", background: "none", textAlign: "left" }}>
              <span className="setting-icon" style={{ background: "var(--urgent-soft)", color: "var(--urgent-ink)" }}>
                <IconLogout size={19} />
              </span>
              <span style={{ flex: 1, fontWeight: 700, color: "var(--urgent-ink)" }}>Sair</span>
              <IconChevronRight size={18} className="chev" />
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
