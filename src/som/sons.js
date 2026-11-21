// Sons do Pothole Party.io, sintetizados (src/som/receitas.js). Contrato: (v, t0, p) => duracao em s,
// sem sorteio. Regra do estudio: nada de "catraca" (nenhuma fila de cliques curtos, tique-tique ou ruido
// granulado junto do acerto). Todo som aqui comeca num instante so (acorde, nunca arpejo) e com ataque suave;
// o ritmo das notas do combo (no maximo 8 por segundo, acorde para o que cai junto, polifonia limitada) fica em
// src/som/combo.js.
import { tom } from './receitas.js';
import { hzDoGrau, ATAQUE_MIN } from './combo.js';

const A = ATAQUE_MIN;

/**
 * Timbre de cada material no combo de engolir: (v, t0, f, vol) => fim. Tudo no mesmo t0.
 * @type {Record<string, (v: any, t0: number, f: number, vol: number) => number>}
 */
export const TIMBRES = {
  /** plastico: "pop" redondo, um tiquinho de queda na altura */
  plastico(v, t0, f, vol) {
    return tom(v, t0, { f: f * 1.08, f2: f, glide: 0.05, vol, ataque: A, queda: 0.17, tipo: 'sine' });
  },
  /** metal: sininho (parciais inarmonicos curtos sobre a fundamental) */
  metal(v, t0, f, vol) {
    tom(v, t0, { f: f * 2.76, vol: vol * 0.26, ataque: A, queda: 0.16, tipo: 'sine' });
    tom(v, t0, { f: f * 5.4, vol: vol * 0.08, ataque: A, queda: 0.08, tipo: 'sine' });
    return tom(v, t0, { f, vol, ataque: A, queda: 0.34, tipo: 'sine' });
  },
  /** madeira: marimba (triangulo abafado e um parcial agudo bem curto) */
  madeira(v, t0, f, vol) {
    tom(v, t0, { f: f * 3.9, vol: vol * 0.14, ataque: A, queda: 0.05, tipo: 'sine' });
    return tom(v, t0, { f, vol: vol * 1.15, ataque: A, queda: 0.15, tipo: 'triangle', filtro: { tipo: 'lowpass', f: f * 3, q: 0.7 } });
  },
  /** vidro: "tlin" brilhante (oitava e parciais altos que somem devagar) */
  vidro(v, t0, f, vol) {
    tom(v, t0, { f: f * 3.01, vol: vol * 0.2, ataque: A, queda: 0.3, tipo: 'sine' });
    tom(v, t0, { f: f * 4.2, vol: vol * 0.1, ataque: A, queda: 0.22, tipo: 'sine' });
    return tom(v, t0, { f: f * 2, vol: vol * 0.55, ataque: A, queda: 0.42, tipo: 'sine' });
  },
  /** planta: "fup" macio descendo */
  planta(v, t0, f, vol) {
    return tom(v, t0, { f: f * 1.2, f2: f * 0.86, glide: 0.12, vol, ataque: 0.012, queda: 0.18, tipo: 'triangle', filtro: { tipo: 'lowpass', f: f * 2.2 } });
  },
  /** pessoa: "uip!" de vozinha (dente de serra num filtro de vogal, sobe e assenta) */
  pessoa(v, t0, f, vol) {
    return tom(v, t0, {
      curva: [[0, f * 0.9], [0.06, f * 1.25], [0.2, f * 1.05]], vol: vol * 0.7, ataque: 0.01, queda: 0.17, tipo: 'sawtooth',
      filtro: { tipo: 'bandpass', f: Math.max(900, f * 2.2), q: 1.6 }, vib: { f: 7, prof: f * 0.02 },
    });
  },
  /** carro: "bonk" de lata com um grave de buzininha abafada junto */
  carro(v, t0, f, vol) {
    tom(v, t0, { f: f * 0.5, vol: vol * 0.5, ataque: 0.01, queda: 0.2, tipo: 'square', filtro: { tipo: 'lowpass', f: 700 } });
    return tom(v, t0, { f, f2: f * 0.94, glide: 0.2, vol: vol * 0.75, ataque: A, queda: 0.22, tipo: 'sine' });
  },
  /** doce: "boing" de goma (sobe um pouco e volta) */
  doce(v, t0, f, vol) {
    tom(v, t0, { f: f * 2, vol: vol * 0.14, ataque: A, queda: 0.12, tipo: 'sine' });
    return tom(v, t0, { curva: [[0, f * 0.8], [0.07, f * 1.06], [0.2, f]], vol, ataque: 0.01, queda: 0.2, tipo: 'sine' });
  },
  /** pedra: "toc" seco e grave */
  pedra(v, t0, f, vol) {
    tom(v, t0, { f: f * 0.5, vol: vol * 0.55, ataque: A, queda: 0.16, tipo: 'triangle' });
    return tom(v, t0, { f, vol: vol * 0.6, ataque: A, queda: 0.12, tipo: 'triangle', filtro: { tipo: 'lowpass', f: f * 2 } });
  },
};

export const SONS = {
  /**
   * Nota do combo: p.graus (1 a 3 graus da pentatonica, um acorde), p.mat e p.mat2 (timbres), p.s (raio da
   * maior peca: so o volume do "gulp" de baixo muda).
   */
  nota(v, t0, p) {
    const graus = (p && p.graus) || [0];
    const mat = (p && p.mat) || 'plastico';
    const mat2 = (p && p.mat2) || mat;
    const s = Math.min(1.3, (p && p.s) || 0.3);
    const vol = 0.06 / Math.sqrt(graus.length);
    // o "gulp" da boca, grave e curto, uma vez por toque
    let fim = tom(v, t0, { f: hzDoGrau(graus[0]) * 0.5, f2: hzDoGrau(graus[0]) * 0.34, glide: 0.1, vol: 0.045 + s * 0.03, ataque: 0.01, queda: 0.11, tipo: 'sine' });
    graus.forEach((g, k) => {
      const timbre = TIMBRES[k === 1 ? mat2 : mat] || TIMBRES.plastico;
      fim = Math.max(fim, timbre(v, t0, hzDoGrau(g), vol));
    });
    return fim - t0;
  },
  /** fim do combo: acorde maior (p.graus) que soa e some devagar */
  fecho(v, t0, p) {
    const graus = (p && p.graus) || [0, 2, 3, 5];
    let fim = t0;
    for (const g of graus) {
      const f = hzDoGrau(g);
      tom(v, t0, { f: f * 2, vol: 0.012, ataque: 0.03, queda: 0.7, tipo: 'sine' });
      fim = Math.max(fim, tom(v, t0, { f, vol: 0.032, ataque: 0.03, queda: 0.85, tipo: 'triangle' }));
    }
    return fim - t0;
  },
  /** o buraco abre (degrau de tamanho): grave limpo descendo e uma quinta subindo, juntos */
  abrir(v, t0, p) {
    const n = (p && p.n) || 1;
    tom(v, t0, { f: 62, f2: 44, glide: 0.45, vol: 0.26, ataque: 0.02, queda: 0.55, tipo: 'sine' });
    tom(v, t0, { f: 124, f2: 186, glide: 0.4, vol: 0.07, ataque: 0.03, queda: 0.45, tipo: 'sine' });
    return tom(v, t0, { f: hzDoGrau(5 + (n % 3) * 2), vol: 0.022, ataque: 0.05, queda: 0.55, tipo: 'triangle' }) - t0;
  },
  /** predio desabando no buraco: grave longo com batimento (duas senoides quase iguais), sem ruido */
  desaba(v, t0, p) {
    const s = (p && p.s) || 2;
    tom(v, t0, { f: 123, f2: 40, glide: 0.7, vol: 0.12, ataque: 0.012, queda: 0.7 + s * 0.05, tipo: 'sine' });
    tom(v, t0, { f: 240, f2: 90, glide: 0.35, vol: 0.045, ataque: 0.012, queda: 0.35, tipo: 'triangle' });
    return tom(v, t0, { f: 120, f2: 38, glide: 0.7, vol: 0.24, ataque: 0.012, queda: 0.75 + s * 0.05, tipo: 'sine' }) - t0;
  },
  /** predio grande demais rachando: um rangido grave so */
  racha(v, t0) {
    tom(v, t0, { f: 70, f2: 58, glide: 0.4, vol: 0.12, ataque: 0.03, queda: 0.4, tipo: 'sine' });
    return tom(v, t0, { f: 98, f2: 82, glide: 0.35, vol: 0.035, ataque: 0.03, queda: 0.35, tipo: 'sawtooth', filtro: { tipo: 'lowpass', f: 420 } }) - t0;
  },
  /** o jogador engoliu outro buraco: glub fundo e um acorde maior junto */
  engoliu(v, t0) {
    tom(v, t0, { f: 300, f2: 80, glide: 0.35, vol: 0.18, ataque: 0.01, queda: 0.4, tipo: 'sine' });
    let fim = t0;
    for (const f of [523, 659, 784]) fim = Math.max(fim, tom(v, t0 + 0.12, { f, vol: 0.045, ataque: 0.04, queda: 0.55, tipo: 'triangle' }));
    return fim - t0;
  },
  /** o jogador foi engolido */
  engolido(v, t0) {
    return tom(v, t0, { f: 520, f2: 110, glide: 0.5, vol: 0.14, ataque: 0.01, queda: 0.55, tipo: 'triangle' }) - t0;
  },
  /** renasceu: acorde suave, tudo junto */
  renasceu(v, t0) {
    let fim = t0;
    for (const f of [392, 523, 659]) fim = Math.max(fim, tom(v, t0, { f, vol: 0.04, ataque: 0.05, queda: 0.4, tipo: 'sine' }));
    return fim - t0;
  },
  /** gigante cai do ceu: assobio descendo e o baque grave (sem ruido) */
  gigante(v, t0) {
    tom(v, t0, { f: 900, f2: 200, glide: 0.8, vol: 0.06, ataque: 0.02, queda: 0.8, tipo: 'sine' });
    tom(v, t0 + 0.85, { f: 123, f2: 44, glide: 0.5, vol: 0.12, ataque: 0.01, queda: 0.6, tipo: 'sine' });
    return tom(v, t0 + 0.85, { f: 120, f2: 45, vol: 0.24, ataque: 0.01, queda: 0.6, tipo: 'sine' }) + 0.05 - t0;
  },
  /** fim da rodada: um acorde (maior se ganhou), sem fanfarra de notas seguidas */
  fim(v, t0, p) {
    const notas = p && p.ganhou ? [523, 659, 784, 1047] : [440, 523, 659];
    let fim = t0;
    for (const f of notas) fim = Math.max(fim, tom(v, t0, { f, vol: 0.05, ataque: 0.03, queda: 0.9, tipo: 'triangle' }));
    return fim - t0;
  },
  clique(v, t0) {
    return tom(v, t0, { f: 880, f2: 660, vol: 0.06, ataque: 0.008, queda: 0.06, tipo: 'triangle' }) - t0;
  },
  /** pessoa assustada: "aaah!" curto (dente de serra num filtro de vogal, voz por p.v de 0 a 1) */
  grito(v, t0, p) {
    const k = 0.8 + ((p && p.v) || 0.5) * 0.6;
    return tom(v, t0, {
      f: 420 * k, f2: 640 * k, glide: 0.12, vol: 0.03, ataque: 0.015, segurar: 0.1, queda: 0.22, tipo: 'sawtooth',
      filtro: { tipo: 'bandpass', f: 1000 * k, q: 2.2 }, vib: { f: 9, prof: 22 },
    }) - t0;
  },
  /** buzina de carro: dois tons juntos, um toque so */
  buzina(v, t0, p) {
    const k = (p && p.grave) ? 0.75 : 1;
    tom(v, t0, { f: 415 * k, vol: 0.022, ataque: 0.01, segurar: 0.16, queda: 0.06, tipo: 'square', filtro: { tipo: 'lowpass', f: 1600 } });
    return tom(v, t0, { f: 523 * k, vol: 0.02, ataque: 0.01, segurar: 0.16, queda: 0.06, tipo: 'square', filtro: { tipo: 'lowpass', f: 1600 } }) - t0;
  },
};
