import { Brand } from "./Brand";
import { HeaderUser } from "./HeaderUser";
import { ThemeToggle } from "./ThemeToggle";

// Cabeçalho do celular: o nome do sistema e o círculo da sua conta.
export function MobileHeader({ extra }: { extra?: React.ReactNode; bell?: boolean }) {
  return (
    <header className="mobile-header only-mobile">
      <Brand />
      <div className="row" style={{ gap: 10 }}>
        {extra}
        <ThemeToggle />
        <HeaderUser />
      </div>
    </header>
  );
}
