export default function Loading() {
  return (
    <main className="page" aria-busy="true" aria-label="Carregando">
      <header className="topbar">
        <div className="topbar-titles stack" style={{ gap: 8 }}>
          <div className="skeleton" style={{ width: 120, height: 12 }} />
          <div className="skeleton" style={{ width: 190, height: 28 }} />
        </div>
      </header>
      <div className="skeleton" style={{ height: 250, borderRadius: "var(--r-xl)" }} />
      <div className="skeleton" style={{ height: 48, borderRadius: 16 }} />
      <div className="card" style={{ padding: 4 }}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="lead-row">
            <div className="skeleton" style={{ width: 44, height: 44, borderRadius: 999, flexShrink: 0 }} />
            <div className="lead-main" style={{ gap: 8 }}>
              <div className="skeleton" style={{ width: "55%", height: 13 }} />
              <div className="skeleton" style={{ width: "85%", height: 11 }} />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
