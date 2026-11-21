// Progresso do jogador (logica pura, ASCII): XP, nivel, skins, liberacao de mapas e modos, a proxima
// rodada sugerida (as 5 primeiras sao roteirizadas: uma novidade a cada ~2 min) e o desafio do dia.
import { hashTexto, criarRng } from '../core/rng.js';
import { MAPAS, MODOS } from './catalogo.js';

export const N_SKINS = 18;

/** @typedef {{ xp: number, rodadas: number, skin: number, recordes: Record<string, number>, estrelas: Record<string, number>, desafio: string, vitorias: number }} Perfil */

/** @returns {Perfil} */
export function perfilNovo() {
  return { xp: 0, rodadas: 0, skin: 0, recordes: {}, estrelas: {}, desafio: '', vitorias: 0 };
}

/** Normaliza um perfil lido do armazenamento (campos faltando, tipos errados). @param {any} p @returns {Perfil} */
export function normalizarPerfil(p) {
  const n = perfilNovo();
  if (!p || typeof p !== 'object') return n;
  const num = (v, d) => (Number.isFinite(v) && v >= 0 ? Math.floor(v) : d);
  n.xp = num(p.xp, 0);
  n.rodadas = num(p.rodadas, 0);
  n.vitorias = num(p.vitorias, 0);
  n.skin = num(p.skin, 0) % N_SKINS;
  n.recordes = p.recordes && typeof p.recordes === 'object' ? { ...p.recordes } : {};
  n.estrelas = p.estrelas && typeof p.estrelas === 'object' ? { ...p.estrelas } : {};
  n.desafio = typeof p.desafio === 'string' ? p.desafio : '';
  if (!skinLiberada(n, n.skin)) n.skin = 0;
  return n;
}

/** XP para passar do nivel n ao n+1. @param {number} n */
export const xpDoNivel = (n) => 80 + (n - 1) * 30;

/** Nivel atual e quanto falta. @param {number} xp */
export function nivelDe(xp) {
  let n = 1;
  let resto = xp;
  while (resto >= xpDoNivel(n)) {
    resto -= xpDoNivel(n);
    n++;
  }
  return { nivel: n, dentro: resto, falta: xpDoNivel(n) - resto, total: xpDoNivel(n) };
}

/** Skin k libera no nivel k + 1 (a 0 ja vem liberada). @param {Perfil} p @param {number} k */
export const skinLiberada = (p, k) => k === 0 || nivelDe(p.xp).nivel >= k + 1;

/** Modos e mapas liberados pelas rodadas jogadas. @param {Perfil} p */
export function liberados(p) {
  const r = p.rodadas;
  return {
    mapas: MAPAS.filter((m) => m === 'cidade' || (m === 'praia' && r >= 1) || (m === 'doceria' && r >= 2)),
    modos: MODOS.filter((m) => m === 'classico' || (m === 'solo' && r >= 2) || (m === 'batalha' && r >= 4)),
  };
}

/** As 5 primeiras rodadas: cada uma com uma novidade. */
const ROTEIRO = [
  { modo: 'classico', tema: 'cidade', novidade: '' },
  { modo: 'classico', tema: 'praia', novidade: 'mapa' },
  { modo: 'solo', tema: 'doceria', novidade: 'modo' },
  { modo: 'classico', tema: 'doceria', novidade: 'mapa' },
  { modo: 'batalha', tema: 'cidade', novidade: 'modo' },
];

/**
 * Configuracao da proxima rodada.
 * @param {Perfil} p
 * @param {{ modo?: string, tema?: string }} [escolha] escolha do jogador (so vale se liberada)
 */
export function proximaRodada(p, escolha = {}) {
  const lib = liberados(p);
  const n = p.rodadas;
  let base = n < ROTEIRO.length ? ROTEIRO[n] : null;
  if (!base) {
    // depois do roteiro: gira mapas e alterna os modos (2 classicos, 1 solo, 1 batalha)
    const ciclo = ['classico', 'classico', 'solo', 'batalha'];
    base = { modo: ciclo[n % ciclo.length], tema: MAPAS[n % MAPAS.length], novidade: '' };
  }
  const modo = escolha.modo && lib.modos.includes(/** @type {any} */ (escolha.modo)) ? escolha.modo : base.modo;
  const tema = escolha.tema && lib.mapas.includes(/** @type {any} */ (escolha.tema)) ? escolha.tema : base.tema;
  // dificuldade: as 2 primeiras rodadas sao faceis e protegem o jogador (sem derrota nos ~3 primeiros minutos)
  let niveis = ['fraco'];
  if (n >= 2) niveis = ['fraco', 'medio', 'medio'];
  if (n >= 5) niveis = ['medio', 'medio', 'forte'];
  if (n >= 10) niveis = ['medio', 'forte', 'forte'];
  return {
    modo,
    tema,
    novidade: escolha.modo || escolha.tema ? '' : base.novidade,
    niveis,
    roteiro: n === 0,
    protegerJogador: n < 2,
    bots: modo === 'batalha' ? 7 : n === 0 ? 7 : 8 + (n % 2),
  };
}

/**
 * XP de uma rodada.
 * @param {{ modo: string, colocacao: number, pontos: number, fracao?: number, desafio?: boolean }} r
 */
export function xpDaRodada(r) {
  let xp = 20 + Math.min(60, Math.floor(r.pontos / 25));
  if (r.modo === 'solo') xp += Math.round((r.fracao || 0) * 50);
  else xp += r.colocacao === 1 ? 40 : r.colocacao === 2 ? 25 : r.colocacao === 3 ? 15 : 5;
  if (r.desafio) xp *= 2;
  return xp;
}

/** Estrelas do Solo pela fracao comida. @param {number} f */
export const estrelasSolo = (f) => (f >= 0.999 ? 3 : f >= 0.85 ? 2 : f >= 0.6 ? 1 : 0);

/**
 * Aplica o fim de uma rodada ao perfil (devolve um perfil novo e o que mudou).
 * @param {Perfil} p
 * @param {{ modo: string, tema: string, colocacao: number, pontos: number, fracao?: number, desafio?: boolean, dia?: string }} r
 */
export function fecharRodada(p, r) {
  const antes = nivelDe(p.xp).nivel;
  const libAntes = liberados(p);
  const xp = xpDaRodada(r);
  const q = normalizarPerfil(p);
  q.xp += xp;
  q.rodadas++;
  if (r.colocacao === 1 && r.modo !== 'solo') q.vitorias++;
  const chave = `${r.modo}-${r.tema}`;
  const recorde = r.pontos > (q.recordes[chave] || 0);
  if (recorde) q.recordes[chave] = r.pontos;
  if (r.modo === 'solo') q.estrelas[r.tema] = Math.max(q.estrelas[r.tema] || 0, estrelasSolo(r.fracao || 0));
  if (r.desafio && r.dia) q.desafio = r.dia;
  const depois = nivelDe(q.xp).nivel;
  /** @type {number[]} */
  const skinsNovas = [];
  for (let k = 1; k < N_SKINS; k++) if (antes < k + 1 && depois >= k + 1) skinsNovas.push(k);
  const libDepois = liberados(q);
  return {
    perfil: q,
    xp,
    subiu: depois > antes,
    nivel: depois,
    skinsNovas,
    mapasNovos: libDepois.mapas.filter((m) => !libAntes.mapas.includes(m)),
    modosNovos: libDepois.modos.filter((m) => !libAntes.modos.includes(m)),
    recorde,
  };
}

/**
 * Desafio do dia (o mesmo para todo mundo no dia): mapa, modo classico, e uma meta de engolir.
 * @param {string} dia 'AAAA-MM-DD'
 */
export function desafioDoDia(dia) {
  const r = criarRng(hashTexto(`gulp-${dia}`));
  const metas = [
    { grupo: 'carro', n: 6 }, { grupo: 'casa', n: 3 }, { grupo: 'pessoa', n: 25 }, { grupo: 'medio', n: 10 },
    { grupo: 'predio', n: 2 }, { grupo: 'grande', n: 2 }, { grupo: 'calcada', n: 40 },
  ];
  const meta = metas[Math.floor(r() * metas.length)];
  return { dia, tema: MAPAS[Math.floor(r() * MAPAS.length)], modo: 'classico', grupo: meta.grupo, n: meta.n };
}

/**
 * O desafio esta disponivel (liberado e ainda nao feito hoje)?
 * @param {Perfil} p @param {string} dia
 */
export const desafioAberto = (p, dia) => p.rodadas >= 3 && p.desafio !== dia;

/** Cumpriu a meta do desafio? @param {{ grupo: string, n: number }} d @param {Record<string, number>} comidas */
export const desafioCumprido = (d, comidas) => (comidas[d.grupo] || 0) >= d.n;
