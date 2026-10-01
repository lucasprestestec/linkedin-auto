import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Política de Privacidade — Central Dors",
  description: "Como a Central Dors trata dados pessoais e dados da sua conta Google.",
};


// Página pública exigida pelo Google na tela de consentimento (escopos do Gmail e da
// Agenda). Descreve o que o sistema faz de fato; se o comportamento mudar, atualize aqui.
export default function PrivacyPage() {
  return (
    <main className="legal">
      <h1 style={{ fontSize: 30, marginBottom: 4 }}>Política de Privacidade</h1>
      <p style={{ opacity: 0.7, marginTop: 0 }}>Central Dors · Última atualização: 29/09/2026</p>

      <h2>1. Quem somos</h2>
      <p>
        A Central Dors é um sistema operado por Lucas Prestes (LP Sistemas) que ajuda profissionais e empresas (os &ldquo;clientes&rdquo;) a conversar com seus
        contatos comerciais e marcar reuniões. Contato sobre privacidade: <a href="mailto:eu@lucasprestes.com">eu@lucasprestes.com</a>.
      </p>

      <h2>2. Quais dados tratamos</h2>
      <ul>
        <li>
          <strong>Dados do cliente:</strong> nome, e-mail da conta Google conectada, configurações do sistema e a autorização (token) que você concede ao Google.
        </li>
        <li>
          <strong>Dados dos contatos (leads) do cliente:</strong> nome, cargo, link de perfil, e-mail e telefone quando informados, e o histórico de mensagens
          trocadas por LinkedIn, e-mail e WhatsApp.
        </li>
        <li>
          <strong>Dados da conta Google, somente com a sua autorização:</strong> mensagens de e-mail (leitura e envio) e eventos da agenda (leitura e criação).
        </li>
      </ul>

      <h2>3. Como usamos os dados do Google</h2>
      <p>Usamos os dados do Google apenas para oferecer as funções que você pediu ao conectar a conta:</p>
      <ul>
        <li>ler as respostas dos seus leads e enviar e-mails em seu nome, dentro das conversas comerciais;</li>
        <li>ver quando você está ocupado, para oferecer horários livres, e criar a reunião (com link do Google Meet) na sua agenda.</li>
      </ul>
      <p>
        <strong>Não</strong> usamos esses dados para publicidade, <strong>não</strong> os vendemos, e nenhuma pessoa lê o conteúdo dos seus e-mails, exceto
        quando você mesmo abre a conversa no painel, para fins de segurança/abuso, por obrigação legal ou com o seu consentimento. O uso e a transferência das
        informações recebidas das APIs do Google seguem a{" "}
        <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noreferrer">
          Política de Dados do Usuário dos Serviços de API do Google
        </a>
        , incluindo os requisitos de Uso Limitado.
      </p>

      <h2>4. Inteligência artificial</h2>
      <p>
        Para redigir respostas, o texto da conversa (incluindo o conteúdo de e-mails recebidos) é enviado a um provedor de inteligência artificial contratado
        por nós, somente para gerar a resposta daquela conversa. Esse conteúdo não é usado para publicidade nem vendido. Você pode manter o modo de aprovação
        ligado para revisar cada mensagem antes do envio.
      </p>
      <p>
        Quando uma pessoa envia um áudio, uma foto ou um vídeo pelo WhatsApp, o arquivo é enviado ao provedor de inteligência artificial apenas para ser
        convertido em texto (transcrição ou descrição), e o que guardamos na conversa é esse texto, não o arquivo. Não repetimos números de documentos
        pessoais que apareçam em imagens.
      </p>

      <h2>5. Mensagens de voz e a sua voz</h2>
      <p>
        Se você ativar as mensagens de voz, grava a sua própria voz na tela &ldquo;Minha voz&rdquo;, depois de confirmar que a voz é sua e autorizar o uso. A
        gravação é enviada ao serviço de voz (Fish Audio) somente para criar uma voz digital, e o assistente passa a poder enviar áudios com ela, em seu
        nome, nas conversas de WhatsApp que você permitir. Você escolhe quando o assistente responde em áudio e pode apagar a voz a qualquer momento: ela é
        removida do serviço e das configurações. Os áudios gerados ficam disponíveis por um endereço temporário para o WhatsApp baixá-los e são apagados
        em até 24 horas.
      </p>

      <h2>6. Com quem compartilhamos</h2>
      <p>
        Apenas com prestadores necessários para o funcionamento: hospedagem e banco de dados (Vercel e Neon), provedor de inteligência artificial, serviço de
        automação do LinkedIn e o CRM/WhatsApp que você conectar. Não vendemos dados pessoais.
      </p>

      <h2>7. Segurança e retenção</h2>
      <p>
        O token do Google é guardado criptografado. O acesso ao painel exige senha. Mantemos os dados enquanto a conta do cliente estiver ativa e os apagamos
        em até 30 dias após o encerramento ou a pedido. Ao desconectar o Google no sistema, revogamos a autorização e apagamos o token.
      </p>

      <h2>8. Seus direitos (LGPD)</h2>
      <p>
        Você (cliente ou contato) pode pedir acesso, correção, portabilidade ou exclusão dos seus dados, e revogar consentimentos, escrevendo para{" "}
        <a href="mailto:eu@lucasprestes.com">eu@lucasprestes.com</a>. Os contatos comerciais são tratados pelo cliente que os prospecta (controlador); nós
        atuamos como operadores, seguindo as instruções dele.
      </p>

      <h2>9. Alterações</h2>
      <p>Podemos atualizar esta política; a data no topo indica a versão vigente.</p>

      <p style={{ marginTop: 32 }}>
        <Link href="/sobre">Voltar</Link> · <Link href="/termos">Termos de Serviço</Link>
      </p>
    </main>
  );
}
