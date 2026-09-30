import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Central Dors — o que é",
  description: "Assistente de prospecção que conversa com seus contatos por LinkedIn, e-mail e WhatsApp e marca reuniões na sua agenda.",
};


// Página pública (sem login): é a "página inicial do aplicativo" que o Google exige
// na tela de consentimento, e explica ao corretor o que o sistema faz com o Google.
export default function AboutPage() {
  return (
    <main className="legal">
      <h1 style={{ fontSize: 32, marginBottom: 8 }}>Central Dors</h1>
      <p style={{ opacity: 0.8, marginTop: 0 }}>Um assistente de prospecção para corretores e profissionais que vendem por conversa.</p>

      <h2>O que ela faz</h2>
      <ul>
        <li>Conversa com os seus contatos e leads por LinkedIn, e-mail e WhatsApp, em nome do profissional.</li>
        <li>Faz follow-up de quem parou de responder e passa a conversa para você quando é a hora.</li>
        <li>Combina o dia e a hora da reunião com o lead e a coloca direto na sua agenda, com link de videochamada.</li>
        <li>Você aprova as mensagens antes de saírem (modo piloto) ou deixa o assistente enviar sozinho.</li>
      </ul>

      <h2>Como a Central Dors usa a sua conta Google</h2>
      <p>
        Quando você conecta o Google, a Central Dors pede permissão para <strong>enviar e ler e-mails</strong> (só para responder às
        conversas dos seus leads) e para <strong>ver e criar eventos na sua agenda</strong> (só para achar horários livres e marcar reuniões). Ela não
        usa esses dados para publicidade, não os vende e não os compartilha para outros fins. Você pode desconectar a qualquer momento no sistema
        ou em{" "}
        <a href="https://myaccount.google.com/permissions" target="_blank" rel="noreferrer">
          myaccount.google.com/permissions
        </a>
        .
      </p>
      <p>
        O uso das informações recebidas das APIs do Google segue a{" "}
        <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noreferrer">
          Política de Dados do Usuário dos Serviços de API do Google
        </a>
        , incluindo os requisitos de Uso Limitado.
      </p>

      <h2>Documentos</h2>
      <ul>
        <li>
          <Link href="/privacidade">Política de Privacidade</Link>
        </li>
        <li>
          <Link href="/termos">Termos de Serviço</Link>
        </li>
      </ul>

      <p style={{ marginTop: 32 }}>
        Já é cliente? <Link href="/login">Entrar no painel</Link>. Contato: <a href="mailto:eu@lucasprestes.com">eu@lucasprestes.com</a>.
      </p>
    </main>
  );
}
