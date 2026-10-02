"use client";

import { useState } from "react";
import { avatarFor } from "@/lib/avatarFor";
import { IconBot } from "./Icons";

// Rosto da pessoa: a foto real quando existe; senão um bonequinho 3D (gênero pelo primeiro nome, tom de pele fixo
// pelo nome, neutro quando o nome é ambíguo). `variant="assistant"` mostra o robozinho (o assistente, que não é uma pessoa).
export function Avatar({
  firstName,
  lastName,
  size = 36,
  photoUrl,
  variant,
}: {
  firstName?: string | null;
  lastName?: string | null;
  size?: number;
  status?: string;
  photoUrl?: string | null;
  variant?: "assistant";
}) {
  const [photoFailed, setPhotoFailed] = useState(false);
  const box = { width: size, height: size } as const;

  if (variant === "assistant") {
    return (
      <span className="avatar avatar-bot" style={box} aria-hidden>
        <IconBot size={Math.round(size * 0.55)} />
      </span>
    );
  }

  if (photoUrl && !photoFailed) {
    return (
      <span className="avatar avatar-photo" style={box} aria-hidden>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photoUrl} alt="" referrerPolicy="no-referrer" loading="lazy" onError={() => setPhotoFailed(true)} />
      </span>
    );
  }

  const doll = avatarFor(firstName, lastName);
  return (
    <span className="avatar avatar-doll" style={box} aria-hidden>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={doll.src} alt="" loading="lazy" />
    </span>
  );
}
