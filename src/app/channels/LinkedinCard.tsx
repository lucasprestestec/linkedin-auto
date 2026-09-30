import type { Settings } from "@prisma/client";
import { getIdentity } from "@/lib/edges";
import { ConnectButton } from "../settings/ConnectButton";
import { RefreshStatusButton } from "../settings/RefreshStatusButton";
import { DisconnectButton } from "../settings/DisconnectButton";
import { LeftoverData } from "../settings/LeftoverData";
import { linkedinDataCount } from "../settings/actions";

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
export async function LinkedinCard({ settings, status, today }: { settings: Settings; status: { connected: boolean; name?: string }; today: string }) {
  const { connected } = status;
  const leftover = settings.linkedinIdentityId ? 0 : await linkedinDataCount();
  return (
    <div className="stack" aria-label="Conta do LinkedIn">
      <div className="setting" style={{ padding: 0 }}>
        <div className="setting-text">
          <b>{connected ? `Conectado${status.name ? ` · ${status.name}` : ""}` : settings.linkedinNeedsReconnect ? "Precisa reconectar" : "Não conectado"}</b>
          <small>
            {connected
              ? today
              : settings.linkedinNeedsReconnect
                ? `${settings.linkedinReconnectReason ?? "A sessão caiu"}. Reconecte para a secretária voltar a trabalhar.`
                : "Convites, primeira mensagem e conversas."}
          </small>
        </div>
        {settings.linkedinIdentityId && <DisconnectButton />}
      </div>
      {!connected && (
        <div className="stack" style={{ gap: 8, alignItems: "flex-start" }}>
          <ConnectButton />
          <RefreshStatusButton />
        </div>
      )}
      {leftover > 0 && <LeftoverData count={leftover} />}
    </div>
  );
}
