import Link from "next/link";

// Nome do sistema com o quadrado âmbar da sinalização.
export function Brand({ className = "" }: { size?: number; className?: string }) {
  return (
    <Link href="/" className={`brand ${className}`} aria-label="Início">
      <i className="brand-sq" aria-hidden="true" />
      <span className="brand-full">Central Dors</span>
    </Link>
  );
}
