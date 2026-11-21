// Combo de sons ao engolir (v0.3.0), logica pura (sem audio, sem relogio: o main.js passa o tempo do jogo).
// Cada peca engolida pede um "plop" com o timbre do material; a altura sobe pela pentatonica maior enquanto o
// combo continua e um acorde fecha o combo quando ele acaba.
//
// Regra do estudio, nada de "catraca" (cliques rapidos em fila, tique-tique, ruido granulado junto do acerto):
//   - no maximo uma nota a cada ESPACO s (8 por segundo);
//   - o que for engolido enquanto a proxima nota espera vira UM toque: com 2 ou mais pecas, um acorde (2 ou 3
//     vozes da escala, todas comecando no mesmo instante), nunca notas seguidas;
//   - polifonia limitada (VOZES ao mesmo tempo, contando o que ainda soa); sem vaga, a nota cai e a fila zera;
//   - ataque suave (ATAQUE_MIN) em todo toque.
// O combo acaba depois de FECHA s sem engolir nada; com pelo menos 3 notas, toca o acorde de fechamento.

/** Pentatonica maior (semitons). */
export const ESCALA = [0, 2, 4, 7, 9];
/** Intervalo minimo entre duas notas (s): 8 notas por segundo no maximo. */
export const ESPACO = 0.125;
/** Vozes soando ao mesmo tempo, no maximo. */
export const VOZES = 6;
/** Silencio que fecha o combo (s). */
export const FECHA = 0.75;
/** Ataque minimo de qualquer toque (s). */
export const ATAQUE_MIN = 0.008;
/** Nota MIDI do primeiro grau (D5 = 74: limpo e alegre, acima do grave do baque). */
export const RAIZ = 74 - 12;
/** Grau mais alto antes de parar de subir (2 oitavas). */
const TETO = 10;
/** Quanto cada nota soa (s), para contar a polifonia. */
const DURACAO = 0.32;

/** Hz de um grau da escala (grau 0 = RAIZ). @param {number} g */
export function hzDoGrau(g) {
  const oit = Math.floor(g / ESCALA.length);
  const st = ESCALA[((g % ESCALA.length) + ESCALA.length) % ESCALA.length] + 12 * oit;
  return 440 * Math.pow(2, (RAIZ + st - 69) / 12);
}

/**
 * @typedef {{ tipo: 'nota', t: number, graus: number[], mat: string, mat2: string, s: number, n: number }
 *   | { tipo: 'fecho', t: number, graus: number[], n: number }} Toque
 */

/** Cria o combo. */
export function criarCombo() {
  /** @type {{ s: number, mat: string }[]} */
  let fila = [];
  let ultimaNota = -9;
  let ultimoItem = -9;
  let grau = 0;
  let notas = 0;
  /** fim de cada voz que ainda soa */
  /** @type {number[]} */
  let vozes = [];
  return {
    /** quantas notas o combo atual ja tocou */
    get notas() { return notas; },
    /** grau atual da escala */
    get grau() { return grau; },
    /**
     * Uma peca foi engolida agora.
     * @param {number} t tempo do jogo (s) @param {{ s: number, mat: string }} item
     */
    comeu(t, item) {
      fila.push(item);
      ultimoItem = t;
    },
    /**
     * Avanca: devolve os toques a tocar agora (0 ou 1 nota, ou o fecho).
     * @param {number} t tempo do jogo (s)
     * @returns {Toque[]}
     */
    passo(t) {
      /** @type {Toque[]} */
      const out = [];
      vozes = vozes.filter((f) => f > t);
      if (fila.length && t - ultimaNota >= ESPACO - 1e-9) {
        // a maior peca da fila escolhe o timbre; a segunda colore o acorde
        const ord = fila.slice().sort((a, b) => b.s - a.s);
        const pedidas = fila.length >= 4 ? 3 : fila.length >= 2 ? 2 : 1;
        const vagas = Math.max(0, VOZES - vozes.length);
        const nv = Math.min(pedidas, vagas);
        if (nv > 0) {
          const g = Math.min(grau, TETO);
          const graus = [g, g + 2, g + 4].slice(0, nv);
          out.push({ tipo: 'nota', t, graus, mat: ord[0].mat, mat2: (ord[1] || ord[0]).mat, s: ord[0].s, n: fila.length });
          for (let k = 0; k < nv; k++) vozes.push(t + DURACAO);
          notas++;
          // sobe um grau por nota (no teto, fica oscilando entre os dois graus de cima)
          grau = grau < TETO ? grau + 1 : TETO - 1 + ((notas + 1) % 2);
          ultimaNota = t;
        }
        fila = [];
      }
      if (!fila.length && notas > 0 && t - ultimoItem >= FECHA) {
        if (notas >= 3) {
          // acorde maior da raiz, uma oitava acima quando o combo foi longo
          const base = notas >= 8 ? 5 : 0;
          out.push({ tipo: 'fecho', t, graus: [base, base + 2, base + 3, base + 5], n: notas });
        }
        notas = 0;
        grau = 0;
      }
      return out;
    },
    /** Zera (rodada nova). */
    zerar() {
      fila = [];
      ultimaNota = -9;
      ultimoItem = -9;
      grau = 0;
      notas = 0;
      vozes = [];
    },
  };
}
