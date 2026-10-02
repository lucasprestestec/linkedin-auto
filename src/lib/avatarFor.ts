// Qual bonequinho 3D mostrar para uma pessoa quando não há foto: o gênero vem do primeiro nome e o tom de pele
// é sorteado de forma fixa pelo nome completo (a mesma pessoa sempre tem o mesmo boneco). Nome ambíguo ou
// desconhecido vira o boneco neutro: é melhor errar para o neutro do que para o gênero errado.

export type AvatarGender = "mulher" | "homem" | "neutro";

const strip = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");

// Nomes que servem para os dois (ou apelidos curtos demais para saber): sempre neutro.
const NEUTRAL = new Set(
  "alex cris chris jordan sasha charlie ariel dani gabi nicola rene renee camille claude jean lu val fran ju bia gui rafa fer carol alexis ale joan jo lee max sam taylor andy kim li".split(" "),
);

const FEMALE = new Set(
  (
    "maria ana juliana fernanda patricia aline camila amanda bruna jessica leticia luciana vanessa mariana gabriela beatriz larissa carolina catarina thalita talita tatiana renata simone claudia cristina sandra sonia rosana adriana daniela paula paola priscila raquel rafaela rebeca sabrina sara sarah silvia sueli tais thais valeria vera viviane vitoria yasmin debora denise eliane elisa eduarda emanuele fabiana fatima flavia giovana giovanna helena ingrid isabela isabel isadora jaqueline joana julia karina katia laura livia lorena lucia luiza luisa marcela marcia marta michele monica natalia nathalia nicole olivia pamela regina roberta rosa samara solange stefany stephanie tamires tereza teresa vilma zilda alice alessandra angela andrea barbara bianca brenda carla carmen clara cintia cecilia diana elaine eloisa erica evelyn gisele gloria heloisa irene iris ivone jane janaina joice jussara kelly kamila lais lara lilian lidia luana lucimara madalena mayara melissa miriam nara neusa nayara noemi odete paloma pietra rita rosangela rute sheila shirley sofia suelen tatiane telma ursula valentina wanda yara zilene socorro consuelo rosario lourdes conceicao aparecida graca penha"
  ).split(" "),
);

const MALE = new Set(
  (
    "joao jose antonio francisco carlos paulo pedro lucas luiz luis marcos marcelo rafael daniel bruno felipe rodrigo gustavo leonardo eduardo fernando ricardo roberto sergio fabio fabricio diego thiago tiago vinicius mateus matheus gabriel andre alexandre anderson adriano alan alberto alisson caio cesar claudio cristiano danilo davi david douglas edson elias emerson enzo erick fabiano flavio geraldo guilherme gilberto henrique hugo igor ismael ivan jonas jorge julio junior kaique leandro lorenzo mauricio miguel murilo nelson nicolas otavio patrick raul renan renato rogerio ronaldo samuel sandro sidney silvio stefano tales valter victor vitor wagner walter wellington william wesley yuri osvaldo orlando oscar nilton mario moises milton mauro marco luciano laerte jair jefferson jeferson helio heitor gerson fausto evandro edgar dirceu denis cleber celso breno benedito arthur artur augusto arnaldo abel abner adao adilson luca joshua jonata"
  ).split(" "),
);

export function genderOfFirstName(firstName: string | null | undefined): AvatarGender {
  const raw = (firstName ?? "").trim().split(/\s+/)[0] ?? "";
  const n = strip(raw);
  if (!n) return "neutro";
  if (NEUTRAL.has(n)) return "neutro";
  if (FEMALE.has(n)) return "mulher";
  if (MALE.has(n)) return "homem";
  // Nome fora das listas: pela terminação, só nos casos claros em português.
  if (n.length >= 4 && n.endsWith("a")) return "mulher";
  if (n.length >= 4 && n.endsWith("o")) return "homem";
  return "neutro";
}

function hash(s: string): number {
  let h = 5381;
  for (const ch of s) h = ((h << 5) + h + ch.charCodeAt(0)) >>> 0;
  return h;
}

// Caminho da imagem do bonequinho (public/avatars): gênero pelo primeiro nome, tom de pele (1 a 5) pelo nome completo.
export function avatarFor(firstName: string | null | undefined, lastName: string | null | undefined): { src: string; gender: AvatarGender; tone: number } {
  const gender = genderOfFirstName(firstName);
  const full = strip(`${firstName ?? ""}${lastName ?? ""}`) || "contato";
  const tone = (hash(full) % 5) + 1;
  return { src: `/avatars/${gender}-${tone}.png`, gender, tone };
}
