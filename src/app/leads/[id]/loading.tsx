export default function Loading() {
  return (
    <div className="chat" aria-busy="true" aria-label="Carregando conversa" style={{ padding: 20, gap: 12 }}>
      <div className="skeleton" style={{ width: 160, height: 16 }} />
      {[62, 48, 70, 40].map((w, i) => (
        <div key={i} className="skeleton" style={{ width: `${w}%`, height: 40, borderRadius: 14, alignSelf: i % 2 ? "flex-end" : "flex-start" }} />
      ))}
    </div>
  );
}
