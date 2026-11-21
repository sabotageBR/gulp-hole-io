// Textos em pt (pt-BR), en e es. O idioma vem do portal (portal.idioma: 'pt-BR' | 'en' | 'es'; vazio na
// Poki, e ai vale o do navegador), nunca so do navegador no californiagames.io. Ingles e obrigatorio na
// CrazyGames: na duvida, en. O titulo e marca e nao se traduz.
// No HTML, data-t="chave" troca o textContent e data-t-aria="chave" o aria-label.

/** @typedef {'pt'|'en'|'es'} Idioma */

export const TEXTOS = {
  pt: {
    titulo: 'Pothole Party.io',
    continuar: 'Continuar',
    pausa: 'Pausa',
    som: 'Som',
    jogar: 'Jogar',
    maior: 'Começar maior',
    skins: 'Bordas',
    pronto: 'Pronto',
    semVideo: 'Sem vídeo agora',
    voce: 'Você',
    classico: 'Clássico',
    solo: 'Solo',
    batalha: 'Batalha',
    cidade: 'Cidade',
    praia: 'Praia',
    doceria: 'Doceria',
    lugar: '{n}º lugar',
    venceu: 'Você venceu!',
    engolidoFim: 'Engolido!',
    soloFim: '{p}% engolido',
    soloLimpo: 'Bairro inteiro engolido!',
    subClassico: '{m} · {mapa} · {pts} pontos',
    subBatalha: '{m} · {mapa} · {k} buracos engolidos',
    subSolo: '{m} · {mapa} · {e}',
    xp: '+{n} XP',
    nivel: 'Nv {n}',
    novaSkin: 'Borda nova liberada!',
    novoMapa: 'Mapa novo: {m}!',
    novoModo: 'Modo novo: {m}!',
    dicaSolo: 'Só você no bairro, sem bots: engula tudo antes do tempo acabar!',
    dicaBatalha: 'Arena menor e sem renascer: o último buraco de pé vence!',
    proxMapa: 'Próximo: mapa {m}',
    proxModo: 'Próximo: modo {m}',
    recorde: 'Recorde!',
    cresceu: 'Maior!',
    casa: 'Uma casa inteira!',
    predio: 'Um prédio inteiro!',
    gigante: 'Um gigante caiu do céu!',
    giganteComido: 'Gigante engolido!',
    engoliu: 'Nhac! Engoliu {n}!',
    engolido: '{n} engoliu você!',
    coroa: 'Você é o maior!',
    dezSeg: '10 segundos!',
    vivos: '{n} de pé',
    estrelas: '{n} de 3 estrelas',
    desafio: 'Desafio do dia: engula {n} {g} no mapa {m} (XP em dobro)',
    desafioFeito: 'Desafio do dia cumprido! XP em dobro',
    desafioAmanha: 'Desafio do dia feito. Amanhã tem outro!',
    g_carro: 'veículos',
    g_casa: 'casas',
    g_pessoa: 'bonecos',
    g_medio: 'árvores e quiosques',
    g_predio: 'prédios',
    g_grande: 'veículos grandes',
    g_calcada: 'coisinhas',
    bloqueada: 'Nv {n}',
  },
  en: {
    titulo: 'Pothole Party.io',
    continuar: 'Continue',
    pausa: 'Paused',
    som: 'Sound',
    jogar: 'Play',
    maior: 'Start bigger',
    skins: 'Rims',
    pronto: 'Done',
    semVideo: 'No video right now',
    voce: 'You',
    classico: 'Classic',
    solo: 'Solo',
    batalha: 'Battle',
    cidade: 'Toy Town',
    praia: 'Beach',
    doceria: 'Sweet Town',
    lugar: '{n} place',
    venceu: 'You won!',
    engolidoFim: 'Gulped!',
    soloFim: '{p}% swallowed',
    soloLimpo: 'Whole block swallowed!',
    subClassico: '{m} · {mapa} · {pts} points',
    subBatalha: '{m} · {mapa} · {k} holes gulped',
    subSolo: '{m} · {mapa} · {e}',
    xp: '+{n} XP',
    nivel: 'Lv {n}',
    novaSkin: 'New rim unlocked!',
    novoMapa: 'New map: {m}!',
    novoModo: 'New mode: {m}!',
    dicaSolo: 'Just you and the block, no bots: gulp it all before time runs out!',
    dicaBatalha: 'Smaller arena, no respawns: the last hole standing wins!',
    proxMapa: 'Next: {m} map',
    proxModo: 'Next: {m} mode',
    recorde: 'New record!',
    cresceu: 'Bigger!',
    casa: 'A whole house!',
    predio: 'A whole building!',
    gigante: 'A giant fell from the sky!',
    giganteComido: 'Giant gulped!',
    engoliu: 'Gulp! You ate {n}!',
    engolido: '{n} gulped you!',
    coroa: "You're the biggest!",
    dezSeg: '10 seconds!',
    vivos: '{n} left',
    estrelas: '{n} of 3 stars',
    desafio: 'Daily challenge: gulp {n} {g} in {m} (double XP)',
    desafioFeito: 'Daily challenge done! Double XP',
    desafioAmanha: 'Daily challenge done. New one tomorrow!',
    g_carro: 'vehicles',
    g_casa: 'houses',
    g_pessoa: 'toy people',
    g_medio: 'trees and kiosks',
    g_predio: 'buildings',
    g_grande: 'big vehicles',
    g_calcada: 'little things',
    bloqueada: 'Lv {n}',
  },
  es: {
    titulo: 'Pothole Party.io',
    continuar: 'Continuar',
    pausa: 'Pausa',
    som: 'Sonido',
    jogar: 'Jugar',
    maior: 'Empezar más grande',
    skins: 'Bordes',
    pronto: 'Listo',
    semVideo: 'Sin video ahora',
    voce: 'Tú',
    classico: 'Clásico',
    solo: 'Solo',
    batalha: 'Batalla',
    cidade: 'Ciudad',
    praia: 'Playa',
    doceria: 'Dulcería',
    lugar: '{n}.º lugar',
    venceu: '¡Ganaste!',
    engolidoFim: '¡Tragado!',
    soloFim: '{p}% tragado',
    soloLimpo: '¡Barrio entero tragado!',
    subClassico: '{m} · {mapa} · {pts} puntos',
    subBatalha: '{m} · {mapa} · {k} agujeros tragados',
    subSolo: '{m} · {mapa} · {e}',
    xp: '+{n} XP',
    nivel: 'Nv {n}',
    novaSkin: '¡Nuevo borde desbloqueado!',
    novoMapa: '¡Mapa nuevo: {m}!',
    novoModo: '¡Modo nuevo: {m}!',
    dicaSolo: 'Solo tú en el barrio, sin bots: ¡trágalo todo antes de que acabe el tiempo!',
    dicaBatalha: 'Arena más pequeña y sin reaparecer: ¡gana el último agujero en pie!',
    proxMapa: 'Siguiente: mapa {m}',
    proxModo: 'Siguiente: modo {m}',
    recorde: '¡Récord!',
    cresceu: '¡Más grande!',
    casa: '¡Una casa entera!',
    predio: '¡Un edificio entero!',
    gigante: '¡Un gigante cayó del cielo!',
    giganteComido: '¡Gigante tragado!',
    engoliu: '¡Ñam! ¡Te comiste a {n}!',
    engolido: '¡{n} te tragó!',
    coroa: '¡Eres el más grande!',
    dezSeg: '¡10 segundos!',
    vivos: 'Quedan {n}',
    estrelas: '{n} de 3 estrellas',
    desafio: 'Desafío del día: traga {n} {g} en {m} (XP doble)',
    desafioFeito: '¡Desafío del día cumplido! XP doble',
    desafioAmanha: 'Desafío del día hecho. ¡Mañana hay otro!',
    g_carro: 'vehículos',
    g_casa: 'casas',
    g_pessoa: 'muñecos',
    g_medio: 'árboles y quioscos',
    g_predio: 'edificios',
    g_grande: 'vehículos grandes',
    g_calcada: 'cositas',
    bloqueada: 'Nv {n}',
  },
};

/**
 * 'pt-BR', 'pt', 'es-419', 'en-US'... -> pt | en | es (o resto vira en).
 * @param {string} codigo
 * @returns {Idioma}
 */
export function escolherIdioma(codigo) {
  const c = String(codigo || '').toLowerCase();
  if (c.startsWith('pt')) return 'pt';
  if (c.startsWith('es')) return 'es';
  return 'en';
}

/** @type {Idioma} */
let atual = 'en';

/** @param {Idioma} i */
export function definirIdioma(i) {
  atual = TEXTOS[i] ? i : 'en';
}

export const idioma = () => atual;

/**
 * @param {string} chave
 * @param {Record<string, string|number>} [vars]
 */
export function t(chave, vars) {
  const tabela = /** @type {Record<string, string>} */ (TEXTOS[atual]);
  let s = tabela[chave] ?? /** @type {Record<string, string>} */ (TEXTOS.en)[chave] ?? chave;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
  return s;
}

/** Ordinal da colocacao (1st, 2nd... no ingles). @param {number} n */
export function ordinal(n) {
  if (atual !== 'en') return t('lugar', { n });
  const s = n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th';
  return t('lugar', { n: `${n}${s}` });
}

/** @param {ParentNode} raiz */
export function aplicarTextos(raiz) {
  for (const el of raiz.querySelectorAll('[data-t]')) el.textContent = t(/** @type {string} */ (el.getAttribute('data-t')));
  for (const el of raiz.querySelectorAll('[data-t-aria]')) el.setAttribute('aria-label', t(/** @type {string} */ (el.getAttribute('data-t-aria'))));
}
