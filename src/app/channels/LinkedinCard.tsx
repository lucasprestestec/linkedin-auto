import type { Settings } from "@prisma/client";
import { getIdentity } from "@/lib/edges";
import { IconLinkedin } from "@/components/Icons";
import { ConnectButton } from "../settings/ConnectButton";
import { RefreshStatusButton } from "../settings/RefreshStatusButton";
import { DisconnectButton } from "../settings/DisconnectButton";

export async function linkedinStatus(settings: Settings): Promise<{ connected: boolean; name?: string }> {
  if (!settings.linkedinIdentityId) return { connected: false };
  try {
    const identity = await getIdentity(settings.linkedinIdentityId);
    return { connected: identity.integrations.includes("linkedin") && !settings.linkedinNeedsReconnect, name: identity.name };
  } catch {
    return { connected: false };
  }
}

// Canal principal: convites, abertura e conversas no LinkedIn.
export function LinkedinCard({ settings, status }: { settings: Settings; status: { connected: boolean; name?: string } }) {
  const { connected } = status;
  return (
    <section className="card card-pad connection rise" aria-label="Conta do LinkedIn">
      <div className="row" style={{ gap: 14 }}>
        <span className="li-mark">
          <IconLinkedin size={26} />
        </span>
        <div className="stack" style={{ gap: 3, flex: 1, minWidth: 0 }}>
          <span className="title-md">
            LinkedIn <span className="channel-tag">principal</span>
          </span>
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

      <p className="small muted">
        Convites, primeira mensagem quando aceitam e as conversas. Até {settings.dailyInviteLimit} convites e {settings.dailyMessageLimit} mensagens por
        dia, pra proteger sua conta.
      </p>

      {!connected && (
        <>
          {settings.linkedinNeedsReconnect && (
            <p className="small muted">{settings.linkedinReconnectReason ?? "A sessão do LinkedIn caiu"}. Reconecte para a automação voltar a funcionar.</p>
          )}
          <ConnectButton />
          <RefreshStatusButton />
        </>
      )}
      {settings.linkedinIdentityId && <DisconnectButton />}
    </section>
  );
}
