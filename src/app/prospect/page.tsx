import { ProspectSearch } from "./ProspectSearch";
import { WarmSuggestions } from "./WarmSuggestions";
import { AccountTypeNotice } from "./AccountTypeNotice";
import { remainingDailyInviteQuota } from "@/lib/prospect";
import { prisma } from "@/lib/prisma";
import { ProgressRing } from "@/components/ProgressRing";
import { IconShield } from "@/components/Icons";

export const dynamic = "force-dynamic";

export default async function ProspectPage() {
  const [remaining, settings] = await Promise.all([
    remainingDailyInviteQuota(),
    prisma.settings.findUniqueOrThrow({ where: { id: "singleton" } }),
  ]);
  const usedToday = Math.max(0, settings.dailyInviteLimit - remaining);
  const left = Math.max(0, remaining);

  return (
    <main className="page">
      <header className="topbar">
        <div className="topbar-titles">
          <div className="eyebrow">Encontre novos clientes</div>
          <h1 className="title-xl">Prospecção</h1>
        </div>
      </header>

      <section className="card card-pad rise row" style={{ gap: 16 }} aria-label="Convites de hoje">
        <ProgressRing value={usedToday} max={settings.dailyInviteLimit} caption={`de ${settings.dailyInviteLimit}`} />
        <div className="stack" style={{ gap: 4, flex: 1, minWidth: 0 }}>
          <div className="title-md">
            {left > 0 ? `${left} convite${left !== 1 ? "s" : ""} disponíve${left !== 1 ? "is" : "l"} hoje` : "Limite de hoje atingido"}
          </div>
          <p className="small muted">
            {left > 0 ? "Enviados hoje contam para o limite diário." : "Amanhã o contador zera e você pode convidar de novo."}
          </p>
          <span className="row tiny" style={{ gap: 5, color: "var(--success-ink)", fontWeight: 700, marginTop: 4 }}>
            <IconShield size={14} /> Limite protege sua conta do LinkedIn
          </span>
        </div>
      </section>

      <WarmSuggestions />
      <AccountTypeNotice />

      <h2 className="group-title" style={{ marginTop: 4 }}>
        Ou busque manualmente
      </h2>
      <ProspectSearch />
    </main>
  );
}
