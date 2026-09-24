export default function Loading() {
  return (
    <div className="chat-page" aria-busy="true" aria-label="Carregando conversa">
      <header className="chat-header">
        <div className="skeleton" style={{ width: 40, height: 40, borderRadius: 999, marginLeft: 46 }} />
        <div className="stack" style={{ gap: 6, flex: 1 }}>
          <div className="skeleton" style={{ width: 140, height: 13 }} />
          <div className="skeleton" style={{ width: 90, height: 10 }} />
        </div>
      </header>
      <div className="chat-intro">
        <div className="skeleton" style={{ width: 76, height: 76, borderRadius: 999 }} />
        <div className="skeleton" style={{ width: 160, height: 18, marginTop: 8 }} />
        <div className="skeleton" style={{ width: 220, height: 12 }} />
      </div>
      <div className="thread">
        {[62, 48, 70, 40].map((w, i) => (
          <div
            key={i}
            className="skeleton"
            style={{ width: `${w}%`, height: 52, borderRadius: 22, alignSelf: i % 2 ? "flex-end" : "flex-start", marginTop: 10 }}
          />
        ))}
      </div>
    </div>
  );
}
