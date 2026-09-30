export default function Loading() {
  return (
    <main className="page" aria-busy="true" aria-label="Carregando" style={{ paddingTop: 24 }}>
      <div className="skeleton" style={{ width: 180, height: 34 }} />
      <div className="skeleton" style={{ height: 120, borderRadius: 20 }} />
      <div className="skeleton" style={{ height: 220, borderRadius: 20 }} />
    </main>
  );
}
