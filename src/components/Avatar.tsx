"use client";

import { useState } from "react";
import { avatarFor } from "@/lib/avatarFor";
import { IconBot } from "./Icons";
import { ChannelBadge, type ChannelKey } from "./ChannelBadge";

// Rosto da pessoa: a foto real quando existe; senão um bonequinho 3D (gênero pelo primeiro nome, tom de pele fixo
// pelo nome, neutro quando o nome é ambíguo). Com `channel`, o selo do canal fica no canto do rosto. `variant="assistant"` mostra o robozinho (o assistente, que não é uma pessoa).
export function Avatar({ channel, ...props }: AvatarProps & { channel?: ChannelKey | null }) {
  if (!channel) return <Face {...props} />;
  return (
    <span className="av-wrap">
      <Face {...props} />
      <ChannelBadge channel={channel} size={Math.max(14, Math.round((props.size ?? 36) * 0.4))} />
    </span>
  );
}

type AvatarProps = {
  firstName?: string | null;
  lastName?: string | null;
  size?: number;
  status?: string;
  photoUrl?: string | null;
  variant?: "assistant";
};

function Face({
  firstName,
  lastName,
  size = 36,
  photoUrl,
  variant,
}: AvatarProps) {
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
