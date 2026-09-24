import { Brand } from "./Brand";
import { NotificationBell } from "./NotificationBell";
import { UserAvatar } from "./UserAvatar";

// Cabeçalho do celular: marca à esquerda; à direita, sino + avatar (ou o que a
// página passar em `extra`, antes do avatar).
export function MobileHeader({ extra, bell = true }: { extra?: React.ReactNode; bell?: boolean }) {
  return (
    <header className="mobile-header only-mobile">
      <Brand size={30} />
      <div className="row" style={{ gap: 10 }}>
        {extra}
        {bell && <NotificationBell />}
        <UserAvatar size={44} />
      </div>
    </header>
  );
}
