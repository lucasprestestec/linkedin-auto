import { initials, avatarGradient } from "@/lib/format";
import type { StatusTone } from "@/lib/status";

export function Avatar({
  firstName,
  lastName,
  size = 44,
  status,
}: {
  firstName?: string | null;
  lastName?: string | null;
  size?: number;
  status?: StatusTone;
}) {
  const label = `${firstName ?? ""} ${lastName ?? ""}`.trim() || "?";
  return (
    <span
      className="avatar"
      style={{ width: size, height: size, background: avatarGradient(label), fontSize: Math.round(size * 0.36) }}
    >
      {initials(firstName, lastName)}
      {status && <span className={`avatar-status status-${status}`} />}
    </span>
  );
}
