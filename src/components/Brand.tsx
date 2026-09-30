import Link from "next/link";

export function Brand({ className = "" }: { size?: number; className?: string }) {
  return (
    <Link href="/" className={`brand ${className}`} aria-label="Início">
      Central Dors
    </Link>
  );
}
