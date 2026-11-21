// Regras do buraco (logica pura, ASCII): tamanho pela massa, velocidade, o que cabe na boca e quando um
// buraco engole outro.

/** Raio de um buraco recem-nascido. */
export const RAIO_INICIAL = 0.62;
/** Curva de crescimento r = r0 + GANHO * massa^EXPOENTE: rapida no comeco (a casinha aos ~15 s), lenta no fim
 * (um buraco bom fecha a rodada com raio ~6 a 8, e o mapa nao acaba). */
export const GANHO = 0.45;
export const EXPOENTE = 0.45;
/** Uma peca cabe se o raio dela for menor que esta fracao do raio do buraco. */
export const CABE = 0.92;
/** Um buraco engole outro se for maior por esta razao. */
export const VANTAGEM = 1.12;
/** O buraco engolido (Classico) renasce com esta fracao da massa. */
export const RESTO_AO_RENASCER = 0.4;
/** O que engole fica com esta fracao da massa do engolido. */
export const BOCADO = 0.5;

/** Raio de um buraco com esta massa. @param {number} massa */
export const raioDe = (massa) => RAIO_INICIAL + GANHO * Math.pow(Math.max(0, massa), EXPOENTE);
/** Massa que da este raio. @param {number} r */
export const massaPara = (r) => Math.pow(Math.max(0, r - RAIO_INICIAL) / GANHO, 1 / EXPOENTE);
/** Velocidade maxima (unidades/s): buracos grandes andam um pouco mais. @param {number} r */
export const velocidadeDe = (r) => Math.min(6.6, 4.3 + r * 0.32);

/**
 * A peca de raio s, com o centro a distancia d do centro do buraco de raio r, cai?
 * @param {number} r @param {number} s @param {number} d
 */
export function cai(r, s, d) {
  return s < r * CABE && d < r - s * 0.35;
}

/**
 * A peca e grande demais mas esta na boca (treme na borda)?
 * @param {number} r @param {number} s @param {number} d
 */
export function treme(r, s, d) {
  return s >= r * CABE && d < r * 0.8;
}

/**
 * O buraco A (raio ra) engole o B (raio rb) a distancia d?
 * @param {number} ra @param {number} rb @param {number} d
 */
export function engoleBuraco(ra, rb, d) {
  return ra > rb * VANTAGEM && d < ra - rb * 0.45;
}

/** Degrau de tamanho (sobe a cada 0,5 de raio): toca o "plim" e acende o anel. @param {number} r */
export const degrauDe = (r) => Math.floor((r - RAIO_INICIAL) / 0.5);
