"use client";

// Escolha da campanha na hora de convidar. Sem campanhas cadastradas, não aparece.
export function CampaignPicker({
  campaigns,
  value,
  onChange,
}: {
  campaigns: { id: string; name: string }[];
  value: string;
  onChange: (id: string) => void;
}) {
  if (campaigns.length === 0) return null;
  return (
    <label className="field" style={{ gap: 6 }}>
      <span className="label">Campanha destes convites</span>
      <select className="input" style={{ height: 46, fontSize: 15 }} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Sem campanha (instruções gerais)</option>
        {campaigns.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
    </label>
  );
}
