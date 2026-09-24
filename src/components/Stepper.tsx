"use client";

import { IconMinus, IconPlus } from "./Icons";

export function Stepper({
  id,
  name,
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  id: string;
  name: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
}) {
  const clamp = (v: number) => Math.min(max, Math.max(min, v));
  return (
    <div className="stepper">
      <button type="button" onClick={() => onChange(clamp(value - step))} disabled={value <= min} aria-label="Diminuir">
        <IconMinus size={16} strokeWidth={2.6} />
      </button>
      <input
        id={id}
        name={name}
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(clamp(Number(e.target.value) || min))}
      />
      <button type="button" onClick={() => onChange(clamp(value + step))} disabled={value >= max} aria-label="Aumentar">
        <IconPlus size={16} strokeWidth={2.6} />
      </button>
    </div>
  );
}
