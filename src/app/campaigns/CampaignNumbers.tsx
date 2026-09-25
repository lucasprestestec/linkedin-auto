import type { CampaignNumbers as Numbers } from "@/lib/campaignStats";

const ITEMS: { key: keyof Numbers; label: string }[] = [
  { key: "invited", label: "Convidados" },
  { key: "connected", label: "Aceitaram" },
  { key: "replied", label: "Responderam" },
  { key: "qualified", label: "Oportunidades" },
];

export function CampaignNumbers({ numbers, size = "sm" }: { numbers: Numbers; size?: "sm" | "lg" }) {
  return (
    <dl className={`camp-numbers camp-numbers-${size}`}>
      {ITEMS.map(({ key, label }) => (
        <div key={key}>
          <dt>{label}</dt>
          <dd>{numbers[key]}</dd>
        </div>
      ))}
    </dl>
  );
}
