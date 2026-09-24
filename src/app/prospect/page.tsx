import { ProspectSearch } from "./ProspectSearch";
import { getSearchQuota, remainingDailyInviteQuota } from "@/lib/prospect";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function ProspectPage() {
  const [quota, inviteQuota, settings] = await Promise.all([
    getSearchQuota().catch(() => null),
    remainingDailyInviteQuota(),
    prisma.settings.findUniqueOrThrow({ where: { id: "singleton" } }),
  ]);

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
        <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0, letterSpacing: -0.2 }}>Prospecção</h1>
        <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 2 }}>
          Busque quem você quiser no LinkedIn e mande convite na hora.
        </div>
      </header>

      <div style={{ padding: "12px 16px 0", display: "flex", flexDirection: "column", gap: 6 }}>
        {quota && (
          <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0 }}>
            Crédito de busca da conta: <strong style={{ color: "var(--text)" }}>{quota.creditsLeft}/{quota.creditsMax}</strong> restante
            {quota.renewsAt && ` · renova em ${new Date(quota.renewsAt).toLocaleDateString("pt-BR")}`}
            {" · "}cada perfil encontrado gasta 1 crédito
          </p>
        )}
        <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0 }}>
          Convites hoje: <strong style={{ color: "var(--text)" }}>{Math.max(0, settings.dailyInviteLimit - inviteQuota)}/{settings.dailyInviteLimit}</strong>
          {" · "}limite existe pra proteger a conta do LinkedIn contra restrição
        </p>
        {quota && quota.creditsLeft <= 10 && (
          <p style={{ fontSize: 12, color: "var(--danger)", margin: 0 }}>
            Crédito quase no fim — considere buscas menores até renovar.
          </p>
        )}
      </div>

      <ProspectSearch maxPerSearch={quota?.maxPerSearch ?? 10} />
    </>
  );
}
