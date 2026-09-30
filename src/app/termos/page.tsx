import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Termos de Serviço — Secretaria Comercial",
  description: "Condições de uso da Secretaria Comercial.",
};

const wrap: React.CSSProperties = { maxWidth: 760, margin: "0 auto", padding: "40px 20px 64px", lineHeight: 1.65 };

export default function TermsPage() {
  return (
    <main style={wrap}>
      <h1 style={{ fontSize: 30, marginBottom: 4 }}>Termos de Serviço</h1>
      <p style={{ opacity: 0.7, marginTop: 0 }}>Secretaria Comercial · Última atualização: 29/09/2026</p>

      <h2>1. O serviço</h2>
      <p>
        A Secretaria Comercial ajuda o cliente a conversar com seus contatos comerciais (LinkedIn, e-mail e WhatsApp), a fazer follow-up e a marcar reuniões
        na agenda do Google. O sistema é operado por Lucas Prestes (LP Sistemas).
      </p>

      <h2>2. Responsabilidades do cliente</h2>
      <ul>
        <li>Usar o sistema de forma lícita e respeitar as regras das plataformas conectadas (LinkedIn, Google, WhatsApp) e a LGPD.</li>
        <li>Abordar apenas pessoas que possa contatar legitimamente e respeitar pedidos de quem não quer mais receber mensagens.</li>
        <li>Revisar as mensagens quando o modo de aprovação estiver ligado; quando desligado, o cliente responde pelas mensagens enviadas em seu nome.</li>
        <li>Manter a segurança das suas credenciais e conexões.</li>
      </ul>

      <h2>3. Limites do serviço</h2>
      <p>
        O sistema depende de serviços de terceiros e pode ficar indisponível ou ser limitado por eles (por exemplo, sessões expiradas ou regras do LinkedIn e do
        WhatsApp). Não garantimos resultados comerciais, como respostas, reuniões ou vendas. Mensagens escritas por inteligência artificial podem conter erros;
        por isso existe o modo de aprovação.
      </p>

      <h2>4. Dados e privacidade</h2>
      <p>
        O tratamento de dados segue a <Link href="/privacidade">Política de Privacidade</Link>. O cliente pode desconectar o Google e encerrar o uso a qualquer
        momento.
      </p>

      <h2>5. Encerramento</h2>
      <p>Qualquer das partes pode encerrar o uso a qualquer momento. Podemos suspender contas que violem estes termos ou coloquem o serviço em risco.</p>

      <h2>6. Contato</h2>
      <p>
        <a href="mailto:eu@lucasprestes.com">eu@lucasprestes.com</a>
      </p>

      <p style={{ marginTop: 32 }}>
        <Link href="/sobre">Voltar</Link> · <Link href="/privacidade">Política de Privacidade</Link>
      </p>
    </main>
  );
}
