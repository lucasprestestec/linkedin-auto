import { IconChevronRight, IconShield } from "@/components/Icons";

// Aviso fixo sobre como o tipo de conta do LinkedIn (gratuita x Premium,
// pessoal x página de empresa) muda o que o sistema consegue fazer. Considera
// a conta atual do corretor: pessoal e gratuita.

type Status = "ok" | "limited" | "unavailable";

const STATUS: Record<Status, { label: string; className: string }> = {
  ok: { label: "Funciona", className: "badge-qualified" },
  limited: { label: "Limitado", className: "badge-invite" },
  unavailable: { label: "Indisponível", className: "" },
};

const ITEMS: { title: string; status: Status; yours: string; other: string }[] = [
  {
    title: "Visitas ao seu perfil",
    status: "limited",
    yours: "Conta gratuita: o LinkedIn mostra só as últimas ~5 visitas.",
    other: "Premium: lista completa de quem visitou, então mais sugestões quentes.",
  },
  {
    title: "Visitas em modo privado",
    status: "unavailable",
    yours: "Quem navega em modo privado aparece anônimo, sem link, e fica fora da lista.",
    other: "Premium também não revela quem está em modo privado.",
  },
  {
    title: "Seguidores do seu perfil",
    status: "ok",
    yours: "Funciona igual em qualquer conta. É a principal fonte de sugestões.",
    other: "Suas conexões seguem você automaticamente e são tiradas da lista.",
  },
  {
    title: "Seguidores de página",
    status: "unavailable",
    yours: "Conta pessoal: não há página de empresa para ler seguidores.",
    other: "Com uma Página de empresa no LinkedIn (você como admin), os seguidores dela viram sugestões também.",
  },
  {
    title: "Convites de conexão",
    status: "ok",
    yours: "O limite semanal do LinkedIn vale para qualquer conta. O sistema convida sem nota, então o limite de notas da conta gratuita não afeta.",
    other: "Premium não aumenta o limite semanal de convites.",
  },
  {
    title: "Mensagens",
    status: "ok",
    yours: "A IA só conversa com quem já é conexão, o que funciona em qualquer conta.",
    other: "Mandar mensagem para quem não é conexão (InMail) exige Premium. O sistema não usa isso.",
  },
];

export function AccountTypeNotice() {
  return (
    <details className="card notice rise" style={{ "--i": 1 } as React.CSSProperties}>
      <summary className="notice-summary">
        <span className="setting-icon" style={{ background: "var(--info-soft)", color: "var(--info-ink)" }}>
          <IconShield size={19} />
        </span>
        <span className="stack" style={{ flex: 1, minWidth: 0, gap: 3 }}>
          <span style={{ fontWeight: 700 }}>O tipo de conta muda o que aparece aqui</span>
          <span className="row" style={{ gap: 6, flexWrap: "wrap" }}>
            <span className="badge badge-open badge-plain" style={{ height: 22 }}>
              Sua conta: pessoal · gratuita
            </span>
          </span>
        </span>
        <IconChevronRight size={18} className="chev notice-chev" />
      </summary>

      <ul className="notice-list">
        {ITEMS.map((item) => (
          <li key={item.title}>
            <div className="row" style={{ justifyContent: "space-between", gap: 10 }}>
              <span style={{ fontWeight: 700, fontSize: 14 }}>{item.title}</span>
              <span className={`badge ${STATUS[item.status].className}`} style={{ height: 22, flexShrink: 0 }}>
                {STATUS[item.status].label}
              </span>
            </div>
            <p className="small muted" style={{ marginTop: 4 }}>
              {item.yours}
            </p>
            <p className="tiny faint" style={{ marginTop: 3 }}>
              {item.other}
            </p>
          </li>
        ))}
      </ul>

      <p className="tiny faint notice-foot">
        Limites e recursos são do próprio LinkedIn e podem mudar. Nada aqui gasta crédito extra da edges.run.
      </p>
    </details>
  );
}
