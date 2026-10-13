import type { ComponentType, SVGProps } from "react";

export type Tone = "accent" | "ok" | "warn" | "violet" | "neutral";

// Ícone dentro de um quadradinho colorido suave, no estilo do resto do painel.
export function IconChip({ Icon, tone = "accent", size = 34 }: { Icon: ComponentType<SVGProps<SVGSVGElement> & { size?: number }>; tone?: Tone; size?: number }) {
  return (
    <span className={`ico-chip tone-${tone}`} style={{ width: size, height: size }} aria-hidden="true">
      <Icon size={Math.round(size * 0.52)} />
    </span>
  );
}
