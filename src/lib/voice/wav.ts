// WAV mono de 16 bits, feito no navegador a partir da gravação (o servidor não precisa de ffmpeg).
// Pura: roda no navegador e nos testes.

export function encodeWav(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const bytes = samples.length * 2;
  const buf = new ArrayBuffer(44 + bytes);
  const v = new DataView(buf);
  const str = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, "RIFF");
  v.setUint32(4, 36 + bytes, true);
  str(8, "WAVE");
  str(12, "fmt ");
  v.setUint32(16, 16, true); // tamanho do bloco fmt
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 1, true); // mono
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * 2, true); // bytes por segundo
  v.setUint16(32, 2, true); // bytes por amostra
  v.setUint16(34, 16, true); // bits
  str(36, "data");
  v.setUint32(40, bytes, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return buf;
}

export function isWav(bytes: Uint8Array): boolean {
  const tag = (o: number) => String.fromCharCode(...bytes.slice(o, o + 4));
  return bytes.length > 44 && tag(0) === "RIFF" && tag(8) === "WAVE";
}

// Duração de um WAV PCM (segundos), lida do cabeçalho. null se não for um WAV que a gente entenda.
export function wavSeconds(bytes: Uint8Array): number | null {
  if (!isWav(bytes)) return null;
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const byteRate = v.getUint32(28, true);
  if (!byteRate) return null;
  return (bytes.length - 44) / byteRate;
}
