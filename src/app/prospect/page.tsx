import { ProspectSearch } from "./ProspectSearch";
import { remainingDailyInviteQuota } from "@/lib/prospect";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function ProspectPage() {
  const [remaining, settings] = await Promise.all([
    remainingDailyInviteQuota(),
    prisma.settings.findUniqueOrThrow({ where: { id: "singleton" } }),
  ]);
  const usedToday = Math.max(0, settings.dailyInviteLimit - remaining);

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
          Busque quem você quiser e mande convite na hora.
        </div>
      </header>

      <div style={{ padding: "12px 16px 0", display: "flex", flexDirection: "column", gap: 6 }}>
        <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0 }}>
          Convites hoje: <strong style={{ color: "var(--text)" }}>{usedToday}/{settings.dailyInviteLimit}</strong>
          {" · "}o LinkedIn restringe a conta acima disso — por isso o limite existe e não dá pra passar dele
        </p>
      </div>

      <ProspectSearch />
    </>
  );
}
