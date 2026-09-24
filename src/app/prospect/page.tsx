import { ProspectSearch } from "./ProspectSearch";

export default function ProspectPage() {
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
      <ProspectSearch />
    </>
  );
}
