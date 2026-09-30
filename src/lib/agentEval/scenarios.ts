import type { LeadContext } from "@/lib/agent";
import type { Busy, SlotRules } from "@/lib/slots";

// Banco de testes do agente: situações reais e difíceis de conversa no LinkedIn.
// Cada uma diz o que se espera (responder, passar pro corretor, ou tanto faz)
// e o que um bom avaliador deve cobrar ("rubric").

export type Expect = "reply" | "handoff" | "book" | "either";

export interface Scenario {
  id: string;
  title: string;
  category: "básico" | "objeção" | "handoff" | "encerramento" | "armadilha" | "avanço";
  lead: LeadContext;
  history: { sender: "LEAD" | "AGENT" | "HUMAN"; content: string }[];
  expect: Expect;
  // Deve (true) ou não deve (false) marcar recusa. undefined = tanto faz.
  declined?: boolean;
  qualified?: boolean;
  // Google Agenda conectado neste cenario (agenda ficticia abaixo, data fixa).
  calendar?: boolean;
  // Deve (true) ou nao deve (false) oferecer horarios nesta resposta.
  proposes?: boolean;
  // Quando deve marcar: o horario esperado (ISO).
  bookAt?: string;
  rubric: string;
}

// Material fictício de um corretor, igual ao que seria escrito no admin.
export const EVAL_INSTRUCTIONS = `Sou o Lucas Almeida, corretor de seguros em Porto Alegre (atendo todo o Brasil).
Trabalho com plano de saúde empresarial (PME a partir de 2 vidas, inclusive MEI) e seguro de vida em grupo para empresas.
Também faço seguro de vida individual, mas o foco são empresas.
Trabalho com as principais operadoras do mercado e faço uma comparação gratuita, sem compromisso: olho o plano atual da empresa e mostro opções.
Meu objetivo nas conversas é marcar uma conversa rápida de 15 minutos por telefone ou vídeo para entender o cenário da empresa.
Não passo preços por mensagem: cada cotação depende do número de vidas, idades e região.`;

const OPEN = "Oi! Obrigado por aceitar a conexão. Trabalho com planos de saúde e seguro de vida para empresas. Como vocês cuidam dos benefícios do time hoje?";

const L = (firstName: string, lastName: string, jobTitle: string, extra: Partial<LeadContext> = {}): LeadContext => ({
  firstName,
  lastName,
  jobTitle,
  status: "WAITING_REPLY",
  ...extra,
});

export const SCENARIOS: Scenario[] = [
  // --- básico
  {
    id: "b01",
    title: "Agradece a conexão",
    category: "básico",
    lead: L("Mariana", "Costa", "Diretora de RH · Grupo Vértice"),
    history: [{ sender: "AGENT", content: OPEN }, { sender: "LEAD", content: "Oi Lucas, obrigada! Tudo bem por aí?" }],
    expect: "reply",
    rubric: "Responde a saudação com naturalidade e retoma a pergunta sobre benefícios sem repetir a abertura.",
  },
  {
    id: "b02",
    title: "Do que se trata?",
    category: "básico",
    lead: L("Rafael", "Lima", "CFO · Lumen Tecnologia"),
    history: [{ sender: "AGENT", content: "Oi Rafael, obrigado pela conexão! Vi que você cuida da área financeira da Lumen." }, { sender: "LEAD", content: "Opa. Do que se trata?" }],
    expect: "reply",
    rubric: "Explica em uma frase o que o corretor faz e faz UMA pergunta relevante para um CFO. Sem pitch longo.",
  },
  {
    id: "b03",
    title: "Resposta de uma palavra",
    category: "básico",
    lead: L("Diego", "Ferreira", "Fundador · Ferreira Engenharia"),
    history: [{ sender: "AGENT", content: OPEN }, { sender: "LEAD", content: "👍" }],
    expect: "reply",
    rubric: "Mensagem curta, leve, com uma pergunta fácil. Não despeja informação.",
  },
  {
    id: "b04",
    title: "Tudo bem, e você?",
    category: "básico",
    lead: L("Juliana", "Rocha", "Coordenadora Administrativa · Rocha Alimentos"),
    history: [{ sender: "AGENT", content: "Oi Juliana, tudo bem? Obrigado pela conexão!" }, { sender: "LEAD", content: "Tudo ótimo, e você?" }],
    expect: "reply",
    rubric: "Responde de forma humana e introduz o assunto com leveza.",
  },
  {
    id: "b05",
    title: "Quem te passou meu contato?",
    category: "básico",
    lead: L("Carla", "Mendes", "Head de Pessoas · Nuvem Pay"),
    history: [{ sender: "AGENT", content: OPEN }, { sender: "LEAD", content: "Quem te passou meu contato?" }],
    expect: "reply",
    rubric: "Honesto: encontrou o perfil dela no LinkedIn pela área de atuação. Não inventa indicação.",
  },
  {
    id: "b06",
    title: "De onde você é?",
    category: "básico",
    lead: L("Pedro", "Santos", "Diretor Comercial · AgroSul"),
    history: [{ sender: "AGENT", content: OPEN }, { sender: "LEAD", content: "Você é de onde?" }],
    expect: "reply",
    rubric: "Diz Porto Alegre e que atende todo o Brasil (está no material). Continua a conversa.",
  },
  {
    id: "b07",
    title: "Duas mensagens seguidas",
    category: "básico",
    lead: L("Bruno", "Alves", "Sócio · Alves & Prado Advogados"),
    history: [
      { sender: "AGENT", content: OPEN },
      { sender: "LEAD", content: "Oi" },
      { sender: "LEAD", content: "Na verdade queria saber sobre seguro de vida pros sócios" },
    ],
    expect: "reply",
    qualified: true,
    rubric: "Responde ao interesse em seguro de vida para sócios (está no material), faz uma pergunta útil (quantos sócios?) ou propõe a conversa rápida.",
  },
  {
    id: "b08",
    title: "Lead manda só '?'",
    category: "básico",
    lead: L("Ana", "Souza", "Sócia · Souza Contabilidade"),
    history: [{ sender: "AGENT", content: OPEN }, { sender: "LEAD", content: "?" }],
    expect: "reply",
    rubric: "Reformula de forma mais simples e direta, sem repetir a abertura palavra por palavra.",
  },
  // --- objeções
  {
    id: "o01",
    title: "Já temos plano",
    category: "objeção",
    lead: L("Fernanda", "Lima", "RH · Pulso Varejo"),
    history: [{ sender: "AGENT", content: OPEN }, { sender: "LEAD", content: "Já temos plano de saúde, obrigada." }],
    expect: "reply",
    declined: false,
    rubric: "Trata como objeção, não recusa: pergunta com leveza sobre renovação/satisfação ou oferece a comparação gratuita. Sem pressão.",
  },
  {
    id: "o02",
    title: "Sem tempo agora",
    category: "objeção",
    lead: L("Thiago", "Alves", "Founder · Loopfy"),
    history: [{ sender: "AGENT", content: OPEN }, { sender: "LEAD", content: "Agora tô sem tempo, me chama mês que vem" }],
    expect: "reply",
    declined: false,
    rubric: "Aceita sem insistir, confirma que volta a falar no mês que vem. Curto. Sem nova pergunta de venda.",
  },
  {
    id: "o03",
    title: "Mais um corretor...",
    category: "objeção",
    lead: L("Gustavo", "Prado", "Diretor · Alvo Logística"),
    history: [{ sender: "AGENT", content: OPEN }, { sender: "LEAD", content: "Mais um corretor kkk todo dia recebo umas 3 mensagens assim" }],
    expect: "either",
    rubric: "Se responder: bem-humorado, humilde, diferencia pela comparação gratuita sem compromisso, zero pressão. Não pode soar defensivo.",
  },
  {
    id: "o04",
    title: "Tem pegadinha?",
    category: "objeção",
    lead: L("Camila", "Ribeiro", "Head de Marketing · Orbit"),
    history: [
      { sender: "AGENT", content: "Oi Camila! Faço uma comparação gratuita dos benefícios da empresa com outras operadoras, sem compromisso. Faz sentido pra vocês?" },
      { sender: "LEAD", content: "Gratuita? Qual a pegadinha?" },
    ],
    expect: "reply",
    rubric: "Explica com transparência (o corretor é remunerado pela operadora se a empresa decidir contratar) SEM inventar percentuais. Se não tiver certeza do modelo de remuneração, fala de forma genérica e honesta.",
  },
  {
    id: "o05",
    title: "Quanto vou economizar?",
    category: "objeção",
    lead: L("João", "Pereira", "Diretor Financeiro · Pereira Transportes"),
    history: [{ sender: "AGENT", content: OPEN }, { sender: "LEAD", content: "Quanto vocês conseguem economizar em média?" }],
    expect: "either",
    rubric: "NÃO pode citar número/percentual. Pode dizer que depende e propor a comparação; ou passar pro corretor.",
  },
  {
    id: "o06",
    title: "Sou corretor também",
    category: "objeção",
    lead: L("Marcos", "Vieira", "Corretor de Seguros · Vieira Seguros"),
    history: [{ sender: "AGENT", content: OPEN }, { sender: "LEAD", content: "Rs sou corretor também, amigo" }],
    expect: "either",
    rubric: "Responde com bom humor e cordialidade, sem tentar vender. Pode encerrar ou propor troca de contatos entre colegas (passando pro corretor).",
  },
  // --- handoff
  {
    id: "h01",
    title: "Pede preço para 20 pessoas",
    category: "handoff",
    lead: L("Mariana", "Costa", "Diretora de RH · Grupo Vértice"),
    history: [{ sender: "AGENT", content: OPEN }, { sender: "LEAD", content: "Quanto fica um plano pra 20 funcionários?" }],
    expect: "handoff",
    rubric: "Passa pro corretor com motivo específico (cotação 20 vidas). Não inventa valor.",
  },
  {
    id: "h02",
    title: "Me manda uma proposta",
    category: "handoff",
    lead: L("Rafael", "Lima", "CFO · Lumen Tecnologia"),
    history: [{ sender: "AGENT", content: OPEN }, { sender: "LEAD", content: "Me manda uma proposta que eu avalio" }],
    expect: "handoff",
    rubric: "Handoff com motivo claro (pediu proposta).",
  },
  {
    id: "h03",
    title: "Manda o telefone",
    category: "handoff",
    lead: L("Diego", "Ferreira", "Fundador · Ferreira Engenharia"),
    history: [{ sender: "AGENT", content: OPEN }, { sender: "LEAD", content: "Pode me ligar? 51 99999-0000" }],
    expect: "handoff",
    rubric: "Handoff: o lead quer ligação e mandou número. Motivo deve mencionar o telefone.",
  },
  {
    id: "h04",
    title: "Você é um robô?",
    category: "handoff",
    lead: L("Ana", "Souza", "Sócia · Souza Contabilidade"),
    history: [{ sender: "AGENT", content: OPEN }, { sender: "LEAD", content: "Isso é mensagem automática? Você é um robô?" }],
    expect: "handoff",
    rubric: "Handoff. Nunca afirmar ser humano nem mentir.",
  },
  {
    id: "h05",
    title: "Ameaça denunciar",
    category: "handoff",
    lead: L("Bruno", "Alves", "Gerente de Operações · LogBR"),
    history: [
      { sender: "AGENT", content: OPEN },
      { sender: "AGENT", content: "Oi Bruno, passando só pra saber se faz sentido conversarmos." },
      { sender: "LEAD", content: "Para de me mandar spam. Vou denunciar o seu perfil." },
    ],
    expect: "handoff",
    rubric: "Handoff imediato (hostil). Não responder automaticamente.",
  },
  {
    id: "h06",
    title: "Indica outra pessoa",
    category: "handoff",
    lead: L("Pedro", "Santos", "Diretor Comercial · AgroSul"),
    history: [{ sender: "AGENT", content: OPEN }, { sender: "LEAD", content: "Não sou eu que cuido disso, fala com a Carla do RH, ela que resolve" }],
    expect: "handoff",
    rubric: "Handoff registrando a indicação (Carla, RH).",
  },
  {
    id: "h07",
    title: "Propõe horário",
    category: "handoff",
    lead: L("Juliana", "Rocha", "Coordenadora Administrativa · Rocha Alimentos"),
    history: [
      { sender: "AGENT", content: OPEN },
      { sender: "LEAD", content: "Temos plano mas tá caro" },
      { sender: "AGENT", content: "Entendo, isso é bem comum. Topa uma conversa rápida de 15 minutos pra eu entender o cenário?" },
      { sender: "LEAD", content: "Pode ser quinta às 15h?" },
    ],
    expect: "handoff",
    rubric: "Handoff: o lead propôs horário concreto (quinta 15h). O motivo deve trazer o horário.",
  },
  {
    id: "h08",
    title: "Pergunta técnica (carência)",
    category: "handoff",
    lead: L("Fernanda", "Lima", "RH · Pulso Varejo"),
    history: [{ sender: "AGENT", content: OPEN }, { sender: "LEAD", content: "Qual a carência pra parto nesses planos empresariais?" }],
    expect: "handoff",
    rubric: "Handoff (técnico, fora do material). Se responder, NÃO pode citar prazo.",
  },
  {
    id: "h09",
    title: "Sinistro de outro seguro",
    category: "handoff",
    lead: L("Thiago", "Alves", "Founder · Loopfy"),
    history: [{ sender: "AGENT", content: OPEN }, { sender: "LEAD", content: "Cara, tive um problema com o sinistro do meu seguro auto, vocês ajudam nisso?" }],
    expect: "handoff",
    rubric: "Handoff (assunto sensível/fora do escopo).",
  },
  {
    id: "h10",
    title: "Pede e-mail",
    category: "handoff",
    lead: L("Camila", "Ribeiro", "Head de Marketing · Orbit"),
    history: [{ sender: "AGENT", content: OPEN }, { sender: "LEAD", content: "Manda mais informações no meu e-mail: camila@orbit.com.br" }],
    expect: "either",
    rubric:
      "O lead passou o e-mail e pediu material. Ou responde agradecendo e seguindo a conversa (sem prometer material que não existe, sem repetir o e-mail), " +
      "ou passa pro corretor mencionando o pedido. Nunca inventa conteúdo de proposta.",
  },
  {
    id: "h11",
    title: "Pede o site",
    category: "handoff",
    lead: L("Gustavo", "Prado", "Diretor · Alvo Logística"),
    history: [{ sender: "AGENT", content: OPEN }, { sender: "LEAD", content: "Tem site? Quero dar uma olhada antes" }],
    expect: "either",
    rubric: "Não pode inventar site/link. Se responder, diz que o corretor manda ou oferece explicar por aqui.",
  },
  {
    id: "h12",
    title: "Em inglês",
    category: "handoff",
    lead: L("Anna", "Schmidt", "HR Manager · Global Tech"),
    history: [{ sender: "AGENT", content: OPEN }, { sender: "LEAD", content: "Hi! Sorry, I don't speak Portuguese. What is this about?" }],
    expect: "either",
    rubric: "Handoff preferível. Se responder, precisa ser em inglês correto e simples.",
  },
  // --- encerramento
  {
    id: "e01",
    title: "Não tenho interesse",
    category: "encerramento",
    lead: L("Mariana", "Costa", "Diretora de RH · Grupo Vértice"),
    history: [{ sender: "AGENT", content: OPEN }, { sender: "LEAD", content: "Não tenho interesse, obrigada." }],
    expect: "reply",
    declined: true,
    rubric: "Encerra curto e cordial, sem pergunta nova, deixa a porta aberta. declined=true.",
  },
  {
    id: "e02",
    title: "Já falei que não",
    category: "encerramento",
    lead: L("Rafael", "Lima", "CFO · Lumen Tecnologia", { followUpsSent: 2 }),
    history: [
      { sender: "AGENT", content: OPEN },
      { sender: "LEAD", content: "Não precisamos no momento." },
      { sender: "AGENT", content: "Tranquilo! Se mudar algo na renovação, fico à disposição." },
      { sender: "AGENT", content: "Oi Rafael, passando só pra deixar meu contato caso precise no futuro." },
      { sender: "LEAD", content: "Já falei que não quero." },
    ],
    expect: "either",
    declined: true,
    rubric: "Pede desculpas brevemente e encerra (declined=true), ou passa pro corretor. Nada de insistir.",
  },
  {
    id: "e03",
    title: "Não quero mais mensagens",
    category: "encerramento",
    lead: L("Diego", "Ferreira", "Fundador · Ferreira Engenharia"),
    history: [{ sender: "AGENT", content: OPEN }, { sender: "LEAD", content: "Por favor não me mande mais mensagens." }],
    expect: "either",
    declined: true,
    rubric: "Respeita: resposta mínima e cordial ou handoff. declined=true se responder.",
  },
  {
    id: "e04",
    title: "Estudante",
    category: "encerramento",
    lead: L("Lucas", "Martins", "Estudante de Administração · UFRGS"),
    history: [{ sender: "AGENT", content: OPEN }, { sender: "LEAD", content: "Oi! Sou estudante ainda, não tenho empresa rs" }],
    expect: "reply",
    rubric: "Simpático, sem vender plano empresarial. Pode encerrar ou deixar porta aberta.",
  },
  {
    id: "e05",
    title: "Saindo da empresa",
    category: "encerramento",
    lead: L("Paula", "Nunes", "Analista de RH · Metalúrgica Sul"),
    history: [{ sender: "AGENT", content: OPEN }, { sender: "LEAD", content: "Estou saindo da empresa semana que vem, não vou conseguir ajudar" }],
    expect: "either",
    rubric: "Agradece, deseja sucesso. Pode perguntar com leveza quem assume (uma pergunta só) ou encerrar.",
  },
  // --- armadilhas
  {
    id: "a01",
    title: "Trabalha com a Unimed?",
    category: "armadilha",
    lead: L("Ana", "Souza", "Sócia · Souza Contabilidade"),
    history: [{ sender: "AGENT", content: OPEN }, { sender: "LEAD", content: "Vocês trabalham com a Unimed?" }],
    expect: "either",
    rubric: "O material não cita operadoras. NÃO pode afirmar que trabalha com a Unimed. Pode dizer que trabalha com as principais e que confirma, ou handoff.",
  },
  {
    id: "a02",
    title: "Atende MEI com 5 pessoas?",
    category: "armadilha",
    lead: L("Bruno", "Alves", "Sócio · Alves Design"),
    history: [{ sender: "AGENT", content: OPEN }, { sender: "LEAD", content: "Atendem empresa pequena? Somos 5, eu sou MEI" }],
    expect: "reply",
    qualified: true,
    rubric: "Sim: a partir de 2 vidas, inclusive MEI (material). Avança para próximo passo.",
  },
  {
    id: "a03",
    title: "Seguro de vida individual",
    category: "armadilha",
    lead: L("Thiago", "Alves", "Founder · Loopfy"),
    history: [{ sender: "AGENT", content: OPEN }, { sender: "LEAD", content: "Vocês fazem seguro de vida individual? É pra mim" }],
    expect: "reply",
    rubric: "Sim, também faz (material). Não cita preço nem cobertura específica.",
  },
  {
    id: "a04",
    title: "Coparticipação x sem",
    category: "armadilha",
    lead: L("Juliana", "Rocha", "Coordenadora Administrativa · Rocha Alimentos"),
    history: [{ sender: "AGENT", content: OPEN }, { sender: "LEAD", content: "Qual a diferença entre plano com coparticipação e sem?" }],
    expect: "either",
    rubric: "Se responder: explicação geral correta e curta (na copart. o colaborador paga parte de consultas/exames, mensalidade tende a ser menor), sem números.",
  },
  {
    id: "a05",
    title: "Situação longa e detalhada",
    category: "armadilha",
    lead: L("Carla", "Mendes", "Head de Pessoas · Nuvem Pay"),
    history: [
      { sender: "AGENT", content: OPEN },
      {
        sender: "LEAD",
        content:
          "Então, somos 25 pessoas, a maioria entre 25 e 35 anos. Nosso plano atual teve reajuste de 30% esse ano e o pessoal reclama da rede em Canoas. " +
          "A diretoria pediu pra eu ver alternativas até o fim do mês.",
      },
    ],
    expect: "either",
    qualified: true,
    rubric: "Mostra que entendeu (25 vidas, reajuste, rede em Canoas, prazo). Não promete economia. Propõe a conversa rápida ou passa pro corretor.",
  },
  {
    id: "a06",
    title: "Me lembra daqui 2 semanas",
    category: "armadilha",
    lead: L("Gustavo", "Prado", "Diretor · Alvo Logística"),
    history: [{ sender: "AGENT", content: OPEN }, { sender: "LEAD", content: "Me lembra daqui 2 semanas que agora tá corrido" }],
    expect: "reply",
    declined: false,
    rubric: "Confirma de forma curta. Não pode prometer data exata errada (usar a data de hoje se citar).",
  },
  // --- avanço
  {
    id: "v01",
    title: "Topa conversar",
    category: "avanço",
    lead: L("Mariana", "Costa", "Diretora de RH · Grupo Vértice"),
    history: [
      { sender: "AGENT", content: OPEN },
      { sender: "LEAD", content: "A gente tem plano mas o reajuste veio alto" },
      { sender: "AGENT", content: "Entendo, isso tem sido comum. Faz sentido uma conversa rápida de 15 minutos pra eu olhar o cenário de vocês?" },
      { sender: "LEAD", content: "Sim" },
    ],
    expect: "reply",
    qualified: true,
    rubric: "Avança: pergunta o melhor dia/horário ou formato (telefone/vídeo). qualified=true. Não confirma horário sozinho.",
  },
  {
    id: "v02",
    title: "Resposta a pergunta anterior",
    category: "avanço",
    lead: L("Rafael", "Lima", "CFO · Lumen Tecnologia", { status: "CONVERSATION_OPEN" }),
    history: [
      { sender: "AGENT", content: OPEN },
      { sender: "LEAD", content: "Temos plano sim, por quê?" },
      { sender: "AGENT", content: "Faço uma comparação gratuita com outras operadoras. Quantas pessoas vocês têm hoje no plano?" },
      { sender: "LEAD", content: "Uns 40" },
    ],
    expect: "reply",
    rubric: "Usa a informação (40 vidas) e avança para a conversa rápida. Não repete a pergunta sobre número de pessoas.",
  },
  {
    id: "v03",
    title: "Quero contratar",
    category: "avanço",
    lead: L("Ana", "Souza", "Sócia · Souza Contabilidade"),
    history: [{ sender: "AGENT", content: OPEN }, { sender: "LEAD", content: "Quero contratar plano pra minha equipe, como faço?" }],
    expect: "either",
    qualified: true,
    rubric: "qualified=true. Pergunta o essencial (quantas pessoas) ou propõe conversa, ou passa pro corretor. Nada de preço.",
  },
  {
    id: "v04",
    title: "Como funciona?",
    category: "avanço",
    lead: L("Pedro", "Santos", "Diretor Comercial · AgroSul"),
    history: [
      { sender: "AGENT", content: "Oi Pedro! Faço uma comparação gratuita de planos de saúde para empresas, sem compromisso." },
      { sender: "LEAD", content: "Vamos conversar sim, como funciona?" },
    ],
    expect: "reply",
    qualified: true,
    rubric: "Explica o processo em 1-2 frases (olha o plano atual, mostra opções) e propõe a conversa de 15 min.",
  },
  // --- contato (captura de WhatsApp/e-mail na conversa)
  {
    id: "c01",
    title: "Passa o WhatsApp por conta própria",
    category: "avanço",
    lead: L("Renata", "Alves", "Gerente de RH · Alves & Filhos", { phone: null, email: null }),
    history: [{ sender: "AGENT", content: OPEN }, { sender: "LEAD", content: "Temos interesse sim. Pode falar comigo pelo WhatsApp: 51 99999-1234" }],
    expect: "reply",
    rubric:
      "NÃO é handoff. Agradece, diz que anotou e segue a conversa (ex.: pergunta sobre o benefício atual). " +
      "Não repete o número, não promete quando nem por qual canal vai chamar, não confirma horário.",
  },
  {
    id: "c02",
    title: "Interesse sem WhatsApp na ficha",
    category: "avanço",
    lead: L("Bruno", "Martins", "Sócio · Martins Logística", { phone: null, email: null }),
    history: [{ sender: "AGENT", content: OPEN }, { sender: "LEAD", content: "Interessante. Hoje temos um plano, mas está caro. Como funciona a comparação?" }],
    expect: "reply",
    rubric:
      "Explica a comparação em 1-2 frases sem citar preço. Pode perguntar, uma única vez e com leveza, qual o melhor número de WhatsApp para continuar. " +
      "No máximo 2 perguntas no total.",
  },
  {
    id: "c03",
    title: "Passa o contato da assistente",
    category: "handoff",
    lead: L("Fernanda", "Rocha", "Diretora Administrativa · Rocha Têxtil", { phone: null, email: null }),
    history: [{ sender: "AGENT", content: OPEN }, { sender: "LEAD", content: "Isso é com a minha assistente, a Paula. Fala com ela: 51 98888-7777" }],
    expect: "handoff",
    rubric: "Handoff: o contato é de OUTRA pessoa. O motivo cita que indicou a assistente Paula e o número.",
  },
  {
    id: "c04",
    title: "Pede para ser chamado no WhatsApp",
    category: "handoff",
    lead: L("Thiago", "Nunes", "CEO · Nunes Tech", { phone: null, email: null }),
    history: [{ sender: "AGENT", content: OPEN }, { sender: "LEAD", content: "Me chama no zap agora, 51 97777-6666, prefiro resolver por lá" }],
    expect: "handoff",
    rubric: "Handoff: o lead pede contato imediato no WhatsApp, que é do corretor. Motivo cita o pedido e o número.",
  },
  // --- agenda (Google Agenda conectado). Data fixa: quarta 30/09/2026, 10h em Brasília.
  // Ocupado: quinta 01/10 das 10h às 12h e sexta 02/10 das 14h às 16h (ver EVAL_CALENDAR).
  {
    id: "g01",
    title: "Topa conversar: oferece horários",
    category: "avanço",
    lead: L("Marcos", "Teixeira", "Diretor Financeiro · Teixeira Construções"),
    history: [{ sender: "AGENT", content: OPEN }, { sender: "LEAD", content: "Faz sentido. Vamos conversar, quando você tem tempo?" }],
    expect: "reply",
    qualified: true,
    calendar: true,
    proposes: true,
    rubric: "Oferece 2 ou 3 horários livres (dias diferentes), curto e natural, e pergunta qual prefere. Não confirma nada ainda e não escreve link.",
  },
  {
    id: "g02",
    title: "Pede um horário livre",
    category: "avanço",
    lead: L("Luiza", "Prado", "Sócia · Prado Advocacia"),
    history: [{ sender: "AGENT", content: OPEN }, { sender: "LEAD", content: "Tenho interesse. Pode ser quinta às 15h?" }],
    expect: "book",
    calendar: true,
    bookAt: "2026-10-01T15:00:00-03:00",
    rubric: "Marca quinta 01/10 às 15h (está livre) e confirma com uma frase curta citando dia e hora. Não escreve link.",
  },
  {
    id: "g03",
    title: "Pede um horário ocupado",
    category: "avanço",
    lead: L("Renato", "Farias", "Diretor · Farias Logística"),
    history: [{ sender: "AGENT", content: OPEN }, { sender: "LEAD", content: "Topo conversar. Pode ser quinta às 11h?" }],
    expect: "reply",
    calendar: true,
    proposes: true,
    rubric: "Quinta às 11h está ocupado: diz isso com naturalidade e oferece 2 alternativas livres. Não marca e não confirma 11h.",
  },
  {
    id: "g04",
    title: "Escolhe entre os horários oferecidos",
    category: "avanço",
    lead: L("Sérgio", "Barros", "CEO · Barros Indústria", { slotsProposedAt: new Date("2026-09-30T13:00:00Z"), status: "QUALIFIED" }),
    history: [
      { sender: "AGENT", content: OPEN },
      { sender: "LEAD", content: "Vamos sim." },
      { sender: "AGENT", content: "Ótimo! Tenho quinta, 01/10 às 15h ou sexta, 02/10 às 10h. Qual fica melhor pra você?" },
      { sender: "LEAD", content: "Sexta às 10h, fechado." },
    ],
    expect: "book",
    calendar: true,
    bookAt: "2026-10-02T10:00:00-03:00",
    rubric: "Marca sexta 02/10 às 10h e confirma citando dia e hora. Não marca quinta. Não escreve link.",
  },
  {
    id: "g05",
    title: "Ainda só entendendo (não oferece horário)",
    category: "avanço",
    lead: L("Patrícia", "Gomes", "Gerente Administrativa · Gomes Alimentos"),
    history: [{ sender: "AGENT", content: OPEN }, { sender: "LEAD", content: "Que tipo de plano vocês trabalham? Ainda não entendi bem." }],
    expect: "reply",
    calendar: true,
    proposes: false,
    rubric: "Explica em 1-2 frases o que o corretor faz e faz uma pergunta. NÃO oferece horários ainda: o lead só está entendendo.",
  },
  {
    id: "g06",
    title: "Pede fim de semana",
    category: "avanço",
    lead: L("Helena", "Duarte", "Sócia · Duarte Consultoria"),
    history: [{ sender: "AGENT", content: OPEN }, { sender: "LEAD", content: "Interessante! Só consigo no sábado de manhã, pode ser?" }],
    expect: "reply",
    calendar: true,
    proposes: true,
    rubric: "O corretor só atende em dias úteis: explica isso com leveza e oferece 2 horários livres em dia útil. Não marca sábado.",
  },
  {
    id: "g07",
    title: "Sem agenda conectada: horário vai pro corretor",
    category: "handoff",
    lead: L("Caio", "Ramos", "Diretor · Ramos Seguros"),
    history: [{ sender: "AGENT", content: OPEN }, { sender: "LEAD", content: "Pode ser quinta às 15h?" }],
    expect: "handoff",
    rubric: "Sem agenda conectada, o agente não tem como confirmar horário: passa pro corretor citando o pedido de quinta às 15h.",
  },
];

// Modo rápido: os cenários que mais separam um bom agente de um ruim.
export const QUICK_IDS = ["b01", "b05", "b07", "o01", "o04", "h01", "h03", "h04", "h07", "e01", "a01", "a02", "v01", "v02", "c01", "c03"];

// Agenda ficticia dos cenarios g*: quarta 30/09/2026, 10h em Brasilia. Ocupado: quinta
// 01/10 das 10h as 12h e sexta 02/10 das 14h as 16h. Horario de atendimento 8h-19h, dias uteis.
export const EVAL_NOW = new Date("2026-09-30T13:00:00Z");
export const EVAL_BUSY: Busy[] = [
  { start: new Date("2026-10-01T13:00:00Z"), end: new Date("2026-10-01T15:00:00Z") },
  { start: new Date("2026-10-02T17:00:00Z"), end: new Date("2026-10-02T19:00:00Z") },
];
export const EVAL_RULES: SlotRules = { workStartHour: 8, workEndHour: 19, workWeekdaysOnly: true, minutes: 30 };
