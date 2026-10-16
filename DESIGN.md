---
name: Central Dors
description: Painel do cliente como sinalização de aeroporto — placas com cor por área e um painel de embarque que mostra o status num relance.
colors:
  sign-black: "#141414"
  sign-raised: "#232320"
  sign-ink: "#F4F2EC"
  sign-dim: "#A9A598"
  amber: "#FFC928"
  amber-soft: "#FFF3CC"
  area-hoje: "#FFC928"
  area-conversas: "#4A90F0"
  area-contatos: "#34A866"
  area-agenda: "#F07B2C"
  area-campanhas: "#8E6CEF"
  area-assistente: "#1FA39B"
  area-ajustes: "#A9A598"
  ok: "#24734A"
  ok-soft: "#E1F1E7"
  stop: "#B83A24"
  focus: "#2F6FE0"
  ground: "#F4F2EC"
  paper: "#FFFFFF"
  ink: "#141414"
  ink-2: "#47463F"
  ink-3: "#66645B"
  rule: "#DEDAD0"
  rule-2: "#CBC6B8"
  board-cell: "#1F1F1C"
  board-divider: "#2E2D28"
  board-label: "#BDB8A8"
  board-foot: "#8F8B7E"
  board-up: "#7FD6A0"
typography:
  display:
    fontFamily: "Barlow Condensed, Arial Narrow, sans-serif"
    fontSize: "clamp(40px, 5vw, 60px)"
    fontWeight: 800
    lineHeight: 0.9
    letterSpacing: "0.005em"
  board-digit:
    fontFamily: "Barlow Condensed, Arial Narrow, sans-serif"
    fontSize: "clamp(38px, 4.4vw, 60px)"
    fontWeight: 700
    lineHeight: 1
    fontFeature: "tnum"
  headline:
    fontFamily: "Barlow Condensed, Arial Narrow, sans-serif"
    fontSize: "26px"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "0.03em"
  sign:
    fontFamily: "Barlow Condensed, Arial Narrow, sans-serif"
    fontSize: "20px"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "0.06em"
  button:
    fontFamily: "Barlow Condensed, Arial Narrow, sans-serif"
    fontSize: "17px"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "0.06em"
  label:
    fontFamily: "Barlow Condensed, Arial Narrow, sans-serif"
    fontSize: "16px"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "0.1em"
  tag:
    fontFamily: "Barlow Condensed, Arial Narrow, sans-serif"
    fontSize: "13px"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "0.08em"
  title:
    fontFamily: "Barlow, system-ui, sans-serif"
    fontSize: "18px"
    fontWeight: 600
    lineHeight: 1.4
  body:
    fontFamily: "Barlow, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.5
  meta:
    fontFamily: "Barlow, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.4
rounded:
  mark: "2px"
  control: "3px"
  board: "4px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "14px"
  lg: "20px"
  xl: "32px"
  gutter: "36px"
components:
  button:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    padding: "0 18px"
    height: "44px"
  button-hover:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.ground}"
  button-go:
    backgroundColor: "{colors.sign-black}"
    textColor: "{colors.amber}"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    padding: "0 18px"
    height: "44px"
  button-quiet:
    backgroundColor: "transparent"
    textColor: "{colors.ink-3}"
    rounded: "{rounded.control}"
  button-quiet-hover:
    backgroundColor: "{colors.rule}"
    textColor: "{colors.ink}"
  button-sm:
    padding: "0 12px"
    height: "36px"
  sign:
    backgroundColor: "transparent"
    textColor: "{colors.sign-dim}"
    typography: "{typography.sign}"
    rounded: "{rounded.control}"
    padding: "0 12px"
    height: "52px"
  sign-current:
    backgroundColor: "{colors.sign-raised}"
    textColor: "{colors.sign-ink}"
  chip:
    backgroundColor: "transparent"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.mark}"
    padding: "0 9px"
    height: "34px"
  chip-pressed:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.ground}"
  tag-you:
    backgroundColor: "{colors.amber}"
    textColor: "{colors.ink}"
    typography: "{typography.tag}"
    rounded: "{rounded.mark}"
    padding: "4px 6px"
  tag-ok:
    backgroundColor: "{colors.ok-soft}"
    textColor: "{colors.ok}"
    typography: "{typography.tag}"
    rounded: "{rounded.mark}"
    padding: "4px 6px"
  panel:
    backgroundColor: "{colors.paper}"
    rounded: "{rounded.control}"
    padding: "18px 20px"
  board:
    backgroundColor: "{colors.sign-black}"
    textColor: "{colors.amber}"
    rounded: "{rounded.board}"
    padding: "18px 20px 16px"
  input-search:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "0 12px"
    height: "44px"
---

# Design System: Central Dors

> Fonte: protótipo aprovado `docs/redesign/index.html` (direção "Sinalização de Aeroporto", seed 18361c0b), revisado em duas rodadas. **O app Next.js ainda não foi migrado**: `src/app/ds.css` e as telas em `src/` usam o visual antigo, que este sistema substitui. Ao reescrever uma tela do app, siga este arquivo, não o `ds.css`.

## Overview

**Creative North Star: "Sinalização de Aeroporto"**

O painel funciona como a sinalização de um aeroporto bem resolvido: placas pretas com uma cor por área dizem onde cada coisa está, e um painel de embarque preto com dígitos amarelos diz o status de tudo num relance. Quem abre o painel não lê; reconhece. Cor marca lugar e estado, nunca enfeite.

O chão é claro e quente (papel areia), a tinta é quase preta, e tudo que é "placa" é preto sólido: a barra lateral, o painel de embarque, o botão de ação principal, o aviso que aparece embaixo. A tipografia de placa é uma grotesca condensada em caixa alta; o texto corrido é a mesma família em largura normal, em caixa baixa. A densidade é de ferramenta de trabalho: listas com linhas finas, nada de cartões iguais enfileirados.

O sistema recusa o arranjo padrão de SaaS (fileira de cartões de métrica iguais + tabela + menu cinza), sombra difusa decorativa e cantos arredondados de "app amigável".

**Key Characteristics:**
- Barra lateral preta com placas: quadradinho de cor por área + rótulo condensado em caixa alta + seta no item atual.
- Um único painel de embarque por tela, preto, dígitos amarelos tabulares com virada split-flap.
- Estado em três cores fixas: verde = andando, amarelo = aguardando você, vermelho = parado.
- Cantos retos ou quase (2–4px), nenhuma sombra; profundidade por cor sólida e filete.
- Tema escuro completo, com as placas ficando ainda mais pretas que o chão.

## Colors

Chão areia e tinta preta, com amarelo de sinalização como única voz forte e quatro cores de área que só aparecem em marcas pequenas.

### Primary
- **Amarelo Sinalização** (amber): a cor do que depende da pessoa. Dígitos do painel de embarque, texto do botão principal (amarelo sobre preto), contador de pendências, etiqueta "Com você", ícone de item aguardando, seleção de texto, polegar do interruptor ligado. Também é a cor da área Hoje.
- **Amarelo Claro** (amber-soft): fundo da conversa selecionada na lista. Só isso.

### Secondary
- **Cores de Área** (area-hoje, area-conversas azul, area-contatos verde, area-agenda laranja, area-ajustes cinza): cada área do menu tem uma. Aparecem só no quadradinho da placa ativa, no quadradinho ao lado do título da tela, na seta do item ativo e em marcas pequenas daquela área (cabeçalho do calendário em laranja, passo atual de Contatos em verde, ícone de conversa em azul).

### Tertiary
- **Verde Andando** (ok / ok-soft): status "Conectado", etiqueta "Andando/Confirmada", luz do assistente ligado. No painel de embarque, a variação positiva usa o verde claro de placa (board-up).
- **Vermelho Parado** (stop): canal fora do ar, assistente pausado, faixa de capacidade cheia.
- **Azul Foco** (focus): somente o anel de foco do teclado (3px, afastado 2px).

### Neutral
- **Preto Placa** (sign-black / ink): barra lateral, painel de embarque, botão principal, aviso flutuante, bolha de mensagem enviada; também a tinta do texto.
- **Placa Elevada** (sign-raised): fundo da placa atual e do quadradinho apagado na barra.
- **Tinta de Placa / Placa Apagada** (sign-ink / sign-dim): texto da barra, ativo e inativo.
- **Chão Areia** (ground): fundo da página, da conversa aberta e de linhas ao passar o mouse.
- **Papel** (paper): painéis, tabela, rascunhos de mensagem, bolha recebida.
- **Tinta 2 / Tinta 3** (ink-2 / ink-3): texto secundário e metadado.
- **Filete / Filete Forte** (rule / rule-2): divisórias de lista e bordas; o forte em campos, chips e faixas.
- **Peças do painel de embarque** (board-cell, board-divider, board-label, board-foot): célula do dígito, divisória entre colunas, rótulo da coluna, rodapé. Valem só dentro do painel.

**Tema escuro** (troca por `prefers-color-scheme` ou botão): chão #131311, papel #1C1C19, tinta #EDEAE2 / #C9C5BA / #A29E92, filetes #2E2D29 / #3D3B35, placa #000 e placa elevada #1A1A17; verde #5CC48A, vermelho #F07A63, foco #7AA8FF. O botão principal ganha borda amarela, a bolha enviada vira #34332D e o painel ganha borda #3D3B35 para se separar do chão.

### Named Rules
**The Amarelo é Você Rule.** Amarelo significa "isto depende de você" (ou é um dígito do painel). Não use amarelo para destacar algo que o assistente resolve sozinho.

**The Cor de Área é Marca Pequena Rule.** Cor de área nunca pinta fundo de bloco, texto corrido ou botão. Ela vive em quadradinhos, setas e faixas estreitas.

**The Três Estados Rule.** Verde andando, amarelo aguardando você, vermelho parado. Nenhuma quarta cor de status.

## Typography

**Display Font:** Barlow Condensed (com Arial Narrow)
**Body Font:** Barlow (com system-ui)

**Character:** Letra de placa: condensada, pesada, caixa alta, espaçada. O texto corrido usa a mesma família em largura normal para que placa e frase pareçam do mesmo aeroporto.

### Hierarchy
- **Display** (800, clamp 40–60px, 0.9): título da tela, em caixa alta, sempre com o quadradinho da cor da área à esquerda (lado de 0.62em).
- **Board digit** (700, clamp 38–60px, numerais tabulares): só os dígitos do painel de embarque.
- **Headline** (700, 26px, caixa alta): título de seção ("Aguardando você"). Dias da Agenda usam 800 a 30px.
- **Sign** (700, 20px, 0.06em, caixa alta): rótulos das placas da barra lateral.
- **Button** (700, 17px, 0.06em, caixa alta): botões; 15px no tamanho pequeno.
- **Label** (700, 14–16px, 0.1em, caixa alta, Tinta 3): cabeçalho de painel lateral, cabeçalho de grupo de ajustes, cabeçalho de tabela, rótulo de coluna do painel de embarque.
- **Tag** (700, 13px, 0.08em, caixa alta): etiquetas de status, separador de dia na conversa.
- **Title** (Barlow 600, 17–18px): título de item da fila e de linha de ajuste.
- **Body** (Barlow 400, 16px, 1.5): texto corrido; rascunhos com no máximo 66ch, subtítulo da tela com no máximo 62ch e 17px.
- **Meta** (Barlow 400, 14px, Tinta 3): canal, hora, cargo e empresa.

### Named Rules
**The Placa em Caixa Alta, Frase em Caixa Baixa Rule.** Toda letra condensada é caixa alta; todo texto em Barlow normal é caixa de frase. Nunca condensada em caixa baixa, nunca frase inteira em caixa alta.

**The Número Tabular Rule.** Todo número que muda ou se compara (contadores, horas, capacidade, dígitos) usa numerais tabulares.

## Layout

Barra lateral fixa de 248px à esquerda (preta, altura da janela, Ajustes e usuário no pé). Conteúdo com respiro lateral `clamp(20px, 4vw, 56px)` e largura máxima de 1180px. Cada tela abre com o mesmo cabeçalho: título display à esquerda, subtítulo de uma frase, e ações ou status alinhados à direita na base.

Hoje: painel de embarque em largura total (5 colunas iguais separadas por filetes), depois uma divisão 2/3 + 1/3 (mínimo 280px na coluna lateral, espaço de 36px). Conversas: três colunas (lista 320px, conversa, detalhes 300px opcionais). Listas usam filete de 2px em tinta no topo e filetes finos entre linhas, em vez de cartões.

Ritmo de espaçamento: 4px entre placas, 8px entre botões, 14px de respiro em itens de lista, 18–20px dentro de painéis e linhas de ajuste, 24px abaixo do cabeçalho, 32px abaixo do painel de embarque.

Responsivo: até 1100px a divisão 2/3+1/3 vira uma coluna e os detalhes da conversa somem. Até 820px a barra lateral vira uma barra inferior fixa (placas empilhadas ícone + rótulo de 13px, contador no canto); o painel de embarque fica 3 colunas em cima e 2 embaixo; Conversas mostra a lista ou a conversa, nunca as duas, com botão de voltar.

## Elevation & Depth

Sem sombras. A profundidade vem de material: placa preta sólida sobre chão areia, papel branco com filete de 1px sobre o chão, e filete grosso de tinta (2px) marcando o início de uma lista ou tabela. O único "relevo" é o da própria placa split-flap: a dobra de cima gira sobre a dobradiça e escurece.

### Named Rules
**The Placa Não Flutua Rule.** Nenhum `box-shadow` em superfície alguma. Separe com cor sólida, filete ou mudança de chão para papel.

## Shapes

Cantos retos ou quase. 2px para marcas pequenas (quadradinhos, etiquetas, chips, contadores, interruptor), 3px para controles e recipientes (botões, campos, painéis, bolhas, avatares), 4px só para o painel de embarque. Avatares, luzes de status e marcadores de etapa são quadrados, nunca círculos. Bordas de controle têm 1.5px; divisórias, 1px; início de lista, 2px.

O quadradinho colorido é a forma-assinatura: aparece na marca, em cada placa, ao lado de cada título e como luz de status.

## Components

### Buttons
Placas de ação: condensada em caixa alta, firmes, sem sombra.
- **Shape:** quase reto (3px), altura 44px (36px no pequeno), borda 1.5px.
- **Padrão (contorno):** borda e texto em tinta sobre transparente; ao passar o mouse inverte (fundo tinta, texto areia); ao clicar desce 1px.
- **Principal ("go"):** fundo preto placa, texto amarelo. Um por item ou formulário: a ação que resolve ("Aprovar e enviar", "Reconectar", "Convidar"). No tema escuro ganha borda amarela.
- **Discreto:** sem borda, Tinta 3; ao passar, fundo filete. Para descartar, voltar, detalhes.
- **Desabilitado:** 45% de opacidade, texto explica o motivo ("Marque alguém").
- **Link com seta:** condensada em caixa alta com seta à direita, sublinha ao passar.

### Chips
- **Style:** contorno 1.5px filete forte, 2px, condensada 15px caixa alta.
- **State:** pressionado = fundo tinta, texto areia. Filtros exclusivos (`aria-pressed`).

### Tags
Etiquetas de estado, 2px, condensada 13px caixa alta. "Com você" = amarelo com tinta; "Andando/Confirmada/Conectado" = verde suave com verde; hora/data = só Tinta 3, sem fundo.

### Cards / Containers
- **Corner Style:** 3px.
- **Background:** papel sobre chão areia.
- **Shadow Strategy:** nenhuma (ver Elevation & Depth).
- **Border:** 1px filete.
- **Internal Padding:** 18–20px. Cabeçalho do painel em Label caixa alta Tinta 3.

### Inputs / Fields
- **Style:** contorno 1.5px filete forte, 3px, altura 44px, ícone de lupa à esquerda em Tinta 3.
- **Focus:** a borda vira tinta; o anel azul de foco aparece na navegação por teclado.
- **Interruptor:** trilho quadrado (2px) 52×30; ligado = trilho preto com polegar amarelo.

### Navigation
- **Barra de placas:** fundo preto, placas de 52px com quadradinho 26px + rótulo Sign + contador amarelo. Inativa: texto apagado, quadradinho apagado. Ao passar: fundo placa elevada. Atual: fundo placa elevada, quadradinho na cor da área com ícone preto, seta na cor da área. Assistente (configuração da IA) e Ajustes moram no pé, separados.
- **Celular:** barra inferior fixa com Hoje, Conversas, Contatos, Campanhas, Agenda e Mais (que abre Ajustes, com atalhos para Assistente e Campanhas no topo), sem seta nem marca.

### Painel de Embarque (assinatura)
Faixa preta de largura total, cantos 4px, colunas separadas por filete escuro. Cada coluna: rótulo Label em cinza de placa, valor em células split-flap (célula escura, 0.68em × 1.08em, linha de dobradiça no meio), nota de uma linha. A coluna mais importante tem o rótulo em amarelo. Rodapé com período e hora de atualização, e "dados de exemplo" sempre que os números forem ilustrativos. Ao carregar e quando um número muda, cada dígito vira placa a placa (dobra de 220ms, uma por 130ms, colunas defasadas 60ms). Com movimento reduzido, os números aparecem prontos.

### Fila "Aguardando você"
Lista com filete de tinta 2px no topo. Cada item: a foto da pessoa (44px) com o selo do canal no canto, ou o ícone vermelho de problema quando não há pessoa; o tipo vem numa etiqueta antes do metadado (Aprovar amarelo, Sua vez azul, Parado vermelho), título em Title, rascunho em caixa de papel quando houver, ações logo abaixo e metadado (canal · há quanto tempo) embaixo do conteúdo. Ao resolver, o item desliza 16px para a direita e some; aparece um aviso preto com texto amarelo embaixo da tela.

### Faixa de capacidade
Trilho de 10px (chão areia, filete forte, 2px) que enche em tinta e nunca transborda; cheia vira vermelho. Rótulo do canal à esquerda, contagem tabular "20/20" à direita.

### Pessoas e canais
Toda pessoa aparece com a foto do perfil (no sistema real, a que já vem do LinkedIn); sem foto, um avatar ilustrado (masculino ou feminino, em traço chapado com tons de pele e cabelo variados, sempre o mesmo para a mesma pessoa), nunca iniciais. Foto quadrada de 3px (40px em listas, 32px em linhas compactas, 44px na fila). Quando a origem importa, um selo de 19px com o ícone oficial do canal fica no canto inferior direito, com borda de papel. Os canais sempre aparecem com o ícone oficial ao lado do nome: LinkedIn #0A66C2, WhatsApp #25D366, E-mail em placa cinza #5A574E.

### Campanhas
Lista com filete de tinta no topo; cada campanha: nome em condensada caixa alta 24px, etiqueta de estado (Ativa verde, Em revisão amarela, Pausada apagada), oferta em uma linha, ícones dos canais e prazo; à direita, três números tabulares (Pessoas, Responderam, Reuniões) e Abrir. Campanha pausada fica a 60% de opacidade.

### Assistente
Duas caixas lado a lado: Jeito de escrever (mensagem de exemplo em bolha preta, traços como etiquetas com contorno da cor da área, sugestões novas com Aplicar) e Voz (liga/desliga áudios, botão tocar preto com triângulo amarelo, forma de onda). A escolha de voz ocupa uma caixa larga: alternância Vozes prontas / Minha voz, filtro Todas / Femininas / Masculinas e uma grade de cartões (tocar amostra, nome, gênero e se fala português, marca de escolhida em preto com visto amarelo). O modo de áudio (Só texto / Quando a pessoa mandar áudio / Sempre no WhatsApp) é uma lista de opções com contorno. Abaixo, linhas de ajuste: quem abordar, insistência, quem nunca contatar, e o que passa pela aprovação.

### Abas, menus e seções que abrem
O que é pouco usado nunca some: mora em abas (sublinhado de tinta de 3px na aba ativa), em menus "Ações"/"Mais" (lista com contorno de tinta 1.5px, item perigoso em vermelho) ou em linhas que abrem (fundo areia quando abertas). Conversa tem as abas Conversa e Ficha; Contatos tem as abas Buscar no LinkedIn, Sugestões quentes, Colar perfis, Adicionar à mão e Importar planilha.

### Conversa
Bolhas de 3px, no máximo 68% da largura (88% no celular). Enviada pelo assistente: preto, texto areia, à direita. Recebida: papel com filete, à esquerda. Passagem para o humano: faixa amarela com seta e "Sua vez" em condensada caixa alta.

## Do's and Don'ts

### Do:
- **Do** marcar cada área com seu quadradinho de cor (Hoje amarelo, Conversas azul, Contatos verde, Campanhas violeta, Agenda laranja, Assistente verde-água, Ajustes cinza) na placa e ao lado do título.
- **Do** usar o botão principal preto com texto amarelo para a ação que resolve a pendência, um por item.
- **Do** usar setas para indicar direção (placa ativa, link "Adicionar pessoas", passagem "Sua vez"); a seta é sinalização, não enfeite.
- **Do** rotular números ilustrativos como "dados de exemplo" no próprio painel.
- **Do** manter avatares, luzes e marcadores quadrados (2–3px).
- **Do** respeitar `prefers-reduced-motion`: sem virada split-flap, sem entrada de tela.

### Don't:
- **Don't** montar fileira de cartões de métrica iguais + tabela + menu cinza; os números vivem no painel de embarque.
- **Don't** usar sombra difusa ou qualquer `box-shadow` decorativo.
- **Don't** usar a virada split-flap fora do painel de embarque.
- **Don't** pintar fundos de bloco ou texto corrido com cor de área.
- **Don't** colocar rótulo pequeno em caixa alta acima de títulos (kicker/eyebrow); o título display com o quadradinho já diz onde a pessoa está.
- **Don't** usar círculos para avatares, luzes de status ou marcadores.
- **Don't** usar quadrados com iniciais no lugar da foto; sem foto, avatar genérico.
- **Don't** escrever o nome do canal sem o ícone oficial ao lado.
