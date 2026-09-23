import { initials, avatarColor } from "@/lib/format";

export function Avatar({ firstName, lastName, size = 40 }: { firstName?: string | null; lastName?: string | null; size?: number }) {
  const label = `${firstName ?? ""} ${lastName ?? ""}`.trim() || "?";
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: avatarColor(label),
        color: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: size * 0.38,
        fontWeight: 600,
        flexShrink: 0,
      }}
    >
      {initials(firstName, lastName)}
    </div>
  );
}
