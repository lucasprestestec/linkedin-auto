import type { Tone } from "@/components/IconChip";

// Cada etiqueta ganha sempre a mesma cor (pelo texto dela), para o olho aprender: "quente" é sempre laranja.
const TONES: Tone[] = ["accent", "ok", "warn", "violet", "neutral"];

export function tagTone(tag: string): Tone {
  let h = 0;
  for (const ch of tag.toLowerCase()) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return TONES[h % TONES.length];
}
