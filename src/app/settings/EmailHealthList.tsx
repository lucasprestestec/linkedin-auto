import { adviceFor, type BoxHealth } from "@/lib/emailHealth";

const MARK = { erro: "✕", aviso: "!", info: "i" } as const;

// Saúde do e-mail por caixa: assinatura do domínio (SPF, DMARC, DKIM), e-mails devolvidos e o que fazer.
export function EmailHealthList({ boxes }: { boxes: BoxHealth[] }) {
  if (boxes.length === 0) return null;
  return (
    <div className="stack" style={{ gap: 10 }}>
      <h3 className="t-label">Saúde do e-mail</h3>
      {boxes.map((b) => {
        const advice = adviceFor(b);
        return (
          <div key={b.address}>
            <p className="hint">
              <b>{b.address}</b> · {b.sent30} enviados em 30 dias · {b.bounces} devolvidos no total
              {b.auth ? ` · SPF ${b.auth.spf === "ok" ? "ok" : b.auth.spf} · DMARC ${b.auth.dmarc === "ausente" ? "ausente" : `ok (${b.auth.dmarc})`}` : " · não consegui consultar o domínio agora"}
            </p>
            {advice.length === 0 ? (
              <p className="hint">Tudo certo por aqui.</p>
            ) : (
              <ul className="hint">
                {advice.map((a) => (
                  <li key={a.text}>
                    <b>{MARK[a.level]}</b> {a.text}
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}
