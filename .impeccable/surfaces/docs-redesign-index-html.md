---
version: 1
slug: "docs-redesign-index-html"
primary_target: "docs/redesign/index.html"
related_targets: []
---

# Protótipo do novo painel (Central Dors)

Escopo: protótipo navegável das telas principais do painel do cliente (Hoje, Conversas, Contatos/Adicionar, Agenda, Ajustes), para aprovar a direção antes de reescrever o app. Modo: Operate.

Audiência e tarefa: dono/vendedor B2B, no computador, algumas vezes por dia. Primeiro resolve o que depende dele (aprovar, assumir conversa, reconectar), depois acompanha métricas (contatados, responderam, oportunidades, reuniões). Configuração existe, mas escondida.

Restrições: português do Brasil sem jargão; nenhuma tela mistura resolver, acompanhar e configurar; dados de exemplo são ilustrativos.

## Direction contract

THESIS: O painel é a sinalização de um aeroporto bem resolvido: placas com cor e seta dizem onde cada coisa está, e um painel de embarque diz o status de tudo num relance. Recusa o arranjo padrão de SaaS (cartões de métrica iguais + tabela + menu cinza).

OWN-WORLD: Barra lateral preta (#141414) com placas: rótulo em grotesca condensada em caixa alta, quadradinho de cor por área (Hoje amarelo #FFC928, Conversas azul, Contatos verde, Agenda laranja). Chão claro quente-neutro (#F4F2EC), tinta quase preta. Painel de status como quadro de embarque: fundo preto, letras amarelas em condensada tabular. Estado: verde = andando, amarelo = aguardando você, vermelho = parado. Cantos retos ou 4px; nada de sombra difusa decorativa.

STORY: Ao abrir, a pessoa vê "Hoje": o painel da semana em cima (quantas pessoas em cada etapa) e logo abaixo "Aguardando você", a fila de decisões. Resolve com um clique e segue. Para conversar vai em Conversas; para pôr gente nova, Contatos; o resto mora em Ajustes, fechado.

FIRST VIEWPORT: Esquerda, barra preta de 248px com 4 placas e Ajustes no pé. Topo do conteúdo: título "Hoje" em condensada grande com o quadradinho amarelo e o status do assistente à direita (ligado, mensagens hoje, botão Pausar). Logo abaixo, faixa-painel preta de largura total com 5 colunas (Convidados, Em conversa, Responderam, Oportunidades, Reuniões) em amarelo tabular. Abaixo, à esquerda (2/3), "Aguardando você" com 3 itens e ação primária em cada; à direita (1/3), próxima reunião e capacidade de hoje por canal como faixas que enchem.

FORM: Sinalização de aeroporto + painel de embarque; candidato 6 da lista ordenada; seed 18361c0b. Movimento-assinatura: ao carregar e quando um número muda, os dígitos do painel giram como placas split-flap (só no painel). Raises: cor por área (Manual com abas), faixa de capacidade que não transborda (Fita cassete), oportunidades ordenadas por temperatura (Catálogo de personagens).

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
