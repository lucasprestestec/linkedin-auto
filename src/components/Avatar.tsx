import { initials } from "@/lib/format";

// Iniciais num círculo neutro. Sem cor por pessoa: nada compete com o texto.
export function Avatar({
  firstName,
  lastName,
  size = 36,
}: {
  firstName?: string | null;
  lastName?: string | null;
  size?: number;
  status?: string;
}) {
  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }} aria-hidden>
      {initials(firstName, lastName)}
    </span>
  );
}
