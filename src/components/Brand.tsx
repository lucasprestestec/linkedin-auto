import Link from "next/link";
import { LogoMark } from "./Icons";

export function Brand({ size = 34, className = "" }: { size?: number; className?: string }) {
  return (
    <Link href="/" className={`brand ${className}`} aria-label="LinkedIn Leads — início">
      <LogoMark size={size} />
      <span className="brand-name">
        LinkedIn
        <br />
        Leads
      </span>
    </Link>
  );
}
