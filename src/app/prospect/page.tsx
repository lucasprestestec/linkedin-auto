import { ProspectSearch } from "./ProspectSearch";
import { WarmSuggestions } from "./WarmSuggestions";
import { AccountTypeNotice } from "./AccountTypeNotice";
import { ProspectTabs } from "./ProspectTabs";
import { FindMoreCard, ProfileShortcuts, QuickSearch } from "./ProspectHeroActions";
import { remainingDailyInviteQuota } from "@/lib/prospect";
import { parseIdealClient } from "@/lib/audience";
import { prisma } from "@/lib/prisma";
import { MobileHeader } from "@/components/MobileHeader";
import { IconShield, IconZap } from "@/components/Icons";

export const dynamic = "force-dynamic";

const DEFAULT_PROFILES = [
  { title: "Diretor de RH", subtitle: "Recursos Humanos" },
  { title: "CFO", subtitle: "Finanças" },
  { title: "Sócio fundador", subtitle: "Empresas" },
  { title: "Gerente administrativo", subtitle: "Administração" },
];

export default async function ProspectPage() {
  const [remaining, settings, campaigns, recent] = await Promise.all([
    remainingDailyInviteQuota(),
    prisma.settings.findUniqueOrThrow({ where: { id: "singleton" } }),
    prisma.campaign.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.lead.findMany({ orderBy: { createdAt: "desc" }, take: 4, select: { firstName: true, lastName: true } }),
  ]);
  const left = Math.max(0, remaining);

  // Perfis sugeridos: os cargos do cliente ideal (Ajustes); sem isso, os mais comuns.
  const icp = parseIdealClient(settings.targetAudience);
  const fromIcp = icp.titles.map((title, i) => ({ title, subtitle: icp.industries[i] ?? "Seu cliente ideal" }));
  const profiles = [...fromIcp, ...DEFAULT_PROFILES.filter((d) => !icp.titles.some((t) => t.toLowerCase() === d.title.toLowerCase()))].slice(0, 6);

  const quota = (
    <span className="credit-pill" title={`${left} de ${settings.dailyInviteLimit} convites disponíveis hoje`}>
      <IconZap size={16} /> {left}
    </span>
  );

  return (
    <main className="page prospect">
      <MobileHeader extra={quota} bell={false} />

      <div className="prospect-top">
        <section className="prospect-hero rise">
          <div className="row only-desktop" style={{ gap: 10, marginBottom: 14 }}>
            {quota}
            <span className="small muted">
              convite{left !== 1 ? "s" : ""} disponíve{left !== 1 ? "is" : "l"} hoje de {settings.dailyInviteLimit}
            </span>
          </div>
          <h1 className="display prospect-title">
            Prospecção
            <br />
            <span className="name-grad">sem esforço.</span>
          </h1>
          <p className="prospect-sub">Encontre as pessoas certas no LinkedIn e inicie conversas que geram oportunidade.</p>
          <QuickSearch />
          <p className="tiny faint row" style={{ gap: 5, marginTop: 10, color: "var(--success-ink)", fontWeight: 600 }}>
            <IconShield size={14} /> Limite diário de {settings.dailyInviteLimit} convites protege sua conta
          </p>
        </section>

        <div className="prospect-side stack rise" style={{ "--i": 1, gap: 22 } as React.CSSProperties}>
          <ProfileShortcuts profiles={profiles} />
          <FindMoreCard people={recent} />
        </div>
      </div>

      <ProspectTabs
        warm={
          <>
            <WarmSuggestions campaigns={campaigns} />
            <AccountTypeNotice />
          </>
        }
        search={<ProspectSearch campaigns={campaigns} />}
      />
    </main>
  );
}
