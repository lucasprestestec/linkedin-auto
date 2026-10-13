import Link from "next/link";

export function Brand({ className = "" }: { size?: number; className?: string }) {
  return (
    <Link href="/" className={`brand ${className}`} aria-label="Início">
      <span className="brand-full">Central Dors</span>
      <span className="brand-short" aria-hidden="true">CD</span>
    </Link>
  );
}
