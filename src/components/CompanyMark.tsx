import { avatarGradient } from "@/lib/format";

// "Logo" da empresa: quadradinho colorido com as iniciais (não temos o logo real).
export function CompanyMark({ name, size = 40 }: { name: string; size?: number }) {
  return (
    <span
      className="company-mark"
      style={{ width: size, height: size, background: avatarGradient(name), fontSize: Math.round(size * 0.32), borderRadius: Math.round(size * 0.3) }}
      aria-hidden="true"
    >
      {name.replace(/[^\p{L}\p{N}]/gu, "").slice(0, 2).toUpperCase() || "?"}
    </span>
  );
}
