// IA dos buracos-bots (logica pura, ASCII). v0.3.0: cada bot tem objetivo e personalidade.
// A cada "intervalo" (ou na hora, quando um buraco maior chega perto) o bot escolhe o que fazer:
//   1. fugir: avalia 16 direcoes e vai para a que fica mais longe dos maiores, sem se encurralar na borda;
//   2. cacar: um buraco menor que valha a pena, mirando onde ele vai estar (nunca o jogador protegido das
//      2 primeiras rodadas, nunca perto de um maior);
//   3. o gigante especial, se couber e estiver perto;
//   4. seca (SECA s sem comer): a peca que cabe mais perto;
//   5. comer: o CACHO de maior valor por perto (soma da massa em volta, nao a peca solta), longe dos maiores;
//   6. sem nada a vista: vai para a regiao do mapa que ainda tem mais comida.
// Personalidades: guloso (cacho grande, quase nao caca), cacador (caca muito, olha longe), medroso (foge cedo e
// longe, evita comida perto de maiores). O passo da rodada move o bot (desviando de predios que nao cabem, com o
// lado da volta guardado para nao tremer) e troca de alvo se ele ficar preso.
// v0.3.1 (bots "parados" da Doceria em diante): a decisao tem compromisso. A caca continua ate alcancar ou
// desistir (no ritmo em que fecha, sem alcancar em 4,5 s, ou depois de 9 s, a presa fica largada por 6 s); o dado rola no maximo a cada
// 1,5 s (antes o bot alternava caca e cacho a cada pensamento e nao comia nada); o gigante so vale se estiver
// perto (antes o bot cruzava o mapa atras dele); peca andando vale menos que peca parada (o bot pequeno seguia
// o carro sem alcancar); e, SECA s sem comer, o bot vai na peca que cabe mais perto.
import { CABE, VANTAGEM } from './buraco.js';

/** @typedef {{ vel: number, intervalo: number, visao: number, caca: number, foge: number, erro: number }} Nivel */

/** @type {Record<string, Nivel>} */
export const NIVEIS = {
  fraco: { vel: 0.72, intervalo: 0.7, visao: 9, caca: 0.12, foge: 0.88, erro: 1.4 },
  medio: { vel: 0.8, intervalo: 0.5, visao: 12, caca: 0.35, foge: 0.96, erro: 0.8 },
  forte: { vel: 0.87, intervalo: 0.35, visao: 15, caca: 0.6, foge: 1, erro: 0.3 },
};

/** @typedef {{ cacho: number, caca: number, margem: number, perigo: number }} Personalidade */
/** @type {Record<string, Personalidade>} */
export const PERSONALIDADES = {
  // cacho: expoente da soma do cacho (prefere os grandes); caca: multiplica a chance de cacar;
  // margem: distancia alem das bordas em que foge; perigo: peso da comida perto de um maior
  guloso: { cacho: 1.35, caca: 0.35, margem: 3.0, perigo: 0.45 },
  cacador: { cacho: 1.0, caca: 1.7, margem: 2.4, perigo: 0.6 },
  medroso: { cacho: 1.0, caca: 0.1, margem: 6.5, perigo: 0.12 },
};
export const TIPOS = /** @type {const} */ (['guloso', 'cacador', 'medroso']);

/** Sem comer ha SECA s (e sem fugir), o bot vai na peca que cabe mais perto (parada vale mais que andando). */
export const SECA = 2.5;
/**
 * A cada PROVA_CACA s a caca mede quanto fechou: se nesse ritmo nao alcanca a presa em ALCANCA s, larga a presa
 * por LARGA s. Caca nenhuma passa de CACA_MAX s.
 */
const PROVA_CACA = 2.5;
const ALCANCA = 4.5;
const LARGA = 6;
const CACA_MAX = 9;
/** O dado da caca rola no maximo a cada INTERVALO_CACA s. */
const INTERVALO_CACA = 1.5;

/**
 * Bots com massa bem abaixo da do jogador andam um pouco mais (placar disputado); bem acima, um pouco menos.
 * Nas rodadas protegidas (as 2 primeiras) o alvo e mais baixo e ninguem ganha impulso: o jogador costuma vencer.
 */
export function elastico(/** @type {number} */ massaBot, /** @type {number} */ massaJogador, protegido = false) {
  const rel = massaBot / Math.max(1, massaJogador);
  const alvo = protegido ? 0.5 : 0.75;
  // v0.3.1: ate +18% para quem ficou bem para tras (o piloto e o jogador bom ficaram mais eficientes com a IA nova)
  return 1 + Math.max(protegido ? -0.2 : -0.16, Math.min(protegido ? 0 : 0.18, (alvo - rel) * 0.4));
}

/** Os buracos maiores que ameacam b agora (perto o bastante pela margem da personalidade). */
export function ameacas(R, b, margem) {
  const out = [];
  for (const o of R.buracos) {
    if (o === b || !o.vivo || o.r <= b.r * VANTAGEM) continue;
    const d = Math.hypot(o.x - b.x, o.z - b.z);
    if (d < o.r + b.r + margem) out.push(o);
  }
  return out;
}

/** Ha um buraco maior que b perto do ponto (x, z)? */
function perigoEm(R, b, x, z, folga) {
  for (const o of R.buracos) {
    if (o === b || !o.vivo || o.r <= b.r * VANTAGEM) continue;
    if (Math.hypot(o.x - x, o.z - z) < o.r + b.r + folga) return true;
  }
  return false;
}

/** O ponto esta na lista de alvos ruins (onde o bot ficou preso)? */
function evitado(R, b, x, z) {
  if (!b.evitar) return false;
  for (const e of b.evitar) if (e.ate > R.t && Math.hypot(e.x - x, e.z - z) < 1.5 + b.r * 0.5) return true;
  return false;
}

/**
 * Escolhe o alvo do bot b (grava b.ax, b.az e b.estado).
 * @param {any} R estado da rodada (rodada.js)
 * @param {any} b buraco
 * @param {() => number} rng
 */
export function pensarBot(R, b, rng) {
  const nv = NIVEIS[b.nivel] || NIVEIS.medio;
  const pe = PERSONALIDADES[b.perso] || PERSONALIDADES.guloso;
  const meio = R.lado / 2 - 1.5;
  // o alvo pode ir ate onde o buraco anda (lado/2 - 0,6): preso a 1,5 da borda, a peca la no canto ficava fora da
  // boca e o bot parava no alvo para sempre (v0.3.1)
  const borda = R.lado / 2 - 0.7;
  const prender = (/** @type {number} */ v) => Math.max(-borda, Math.min(borda, v));
  const visao = nv.visao + b.r * 1.6;

  // 1) fugir (quem ja foge so para com 60% a mais de folga: nada de fugir e voltar na mesma fronteira)
  const am = ameacas(R, b, b.estado === 'foge' ? pe.margem * 1.6 : pe.margem);
  if (am.length && rng() < nv.foge) {
    let melhor = 0;
    let nota = -Infinity;
    const D = 6 + b.r * 1.2;
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2;
      const px = b.x + Math.cos(a) * D;
      const pz = b.z + Math.sin(a) * D;
      let n = Infinity;
      for (const o of am) n = Math.min(n, Math.hypot(px - o.x, pz - o.z) - o.r);
      // borda: encurralar e morrer
      const fora = Math.max(0, Math.abs(px) - meio + 3, Math.abs(pz) - meio + 3);
      n -= fora * 3;
      // continuar na direcao em que ja ia (sem tremer entre duas saidas iguais)
      if (b.estado === 'foge') n += ((Math.cos(a) * (b.ax - b.x) + Math.sin(a) * (b.az - b.z)) / (Math.hypot(b.ax - b.x, b.az - b.z) || 1)) * 1.2;
      if (n > nota) {
        nota = n;
        melhor = a;
      }
    }
    b.ax = prender(b.x + Math.cos(melhor) * D);
    b.az = prender(b.z + Math.sin(melhor) * D);
    b.estado = 'foge';
    return;
  }

  // 2) cacar (nunca nas rodadas protegidas: a primeira experiencia e calma; na Batalha, bem mais)
  const batalha = R.modo === 'batalha';
  const alcance = visao * (batalha ? 1.6 : 1.2);
  const mirar = (/** @type {any} */ presa) => {
    // mira onde a presa vai estar (meio caminho do tempo de chegada)
    const d = Math.hypot(presa.x - b.x, presa.z - b.z);
    const lead = Math.min(1.2, d / 9);
    b.ax = prender(presa.x + presa.vx * lead);
    b.az = prender(presa.z + presa.vz * lead);
    b.estado = 'caca';
  };
  // a caca em andamento continua (o dado nao rola de novo: nada de alternar caca e cacho a cada pensamento)
  if (b.estado === 'caca' && b.presa >= 0) {
    const p = R.buracos[b.presa];
    if (p && presaBoa(R, b, p, alcance * 1.25)) {
      mirar(p);
      return;
    }
  }
  b.presa = -1;
  if (!R.protegerJogador && R.t >= (b.proxCaca || 0)) {
    b.proxCaca = R.t + INTERVALO_CACA;
    if (rng() < Math.min(0.97, nv.caca * pe.caca * (batalha ? 1.8 : 1))) {
      let presa = null;
      let melhor = 0;
      for (const o of R.buracos) {
        if (!presaBoa(R, b, o, alcance)) continue;
        const v = o.massa / (Math.hypot(o.x - b.x, o.z - b.z) + 4);
        if (v > melhor) {
          presa = o;
          melhor = v;
        }
      }
      if (presa) {
        mirar(presa);
        b.presa = presa.id;
        b.cacaIni = R.t;
        b.cacaT0 = R.t;
        b.cacaD0 = Math.hypot(presa.x - b.x, presa.z - b.z);
        return;
      }
    }
  }

  // 3) o gigante especial: vale muito, mas so se estiver perto (longe, o bot cruzava o mapa sem comer nada)
  if (R.gigante && R.gigante.id >= 0) {
    const g = R.objetos[R.gigante.id];
    const ok = g && g.estado === 0 && g.peca.s < b.r * CABE && Math.hypot(g.x - b.x, g.z - b.z) < visao * 1.6 + 6
      && !perigoEm(R, b, g.x, g.z, 1);
    if (ok && (b.estado === 'gigante' || rng() < 0.85)) {
      b.ax = prender(g.x);
      b.az = prender(g.z);
      b.estado = 'gigante';
      return;
    }
  }

  // 4) seca: SECA s sem comer, a peca que cabe mais perto
  if (R.t - (b.comeuT || 0) > SECA) {
    const o = maisPerto(R, b, visao);
    if (o) {
      b.ax = prender(o.x);
      b.az = prender(o.z);
      b.estado = 'come';
      b.cacho = { x: o.x, z: o.z, soma: 0 };
      return;
    }
  }

  // 5) comida: o cacho de maior valor
  const c = melhorCacho(R, b, visao, pe);
  if (c) {
    b.ax = prender(c.x + (rng() - 0.5) * nv.erro);
    b.az = prender(c.z + (rng() - 0.5) * nv.erro);
    b.estado = 'come';
    b.cacho = c;
    return;
  }

  // 6) nada a vista: a regiao com mais comida que ainda cabe
  const reg = regiaoComComida(R, b);
  if (reg) {
    b.ax = prender(reg.x);
    b.az = prender(reg.z);
  } else {
    b.ax = prender(b.x * 0.4 + (rng() - 0.5) * R.lado * 0.6);
    b.az = prender(b.z * 0.4 + (rng() - 0.5) * R.lado * 0.6);
  }
  b.estado = 'passeia';
}

/**
 * O cacho de maior valor a vista: sementes pelas pecas que cabem (massa por distancia), cada uma pontuada pela
 * massa somada em volta (raio pelo tamanho da boca) e pelo centro de massa. Perto de um maior vale menos.
 * O alvo atual ganha um bonus (nao troca por um quase igual: nada de ziguezague).
 */
function melhorCacho(R, b, visao, pe) {
  const lim = b.r * CABE;
  /** @type {{ id: number, v: number }[]} */
  const sementes = [];
  let vistos = 0;
  R.grade.perto(b.x, b.z, visao, (/** @type {number} */ id) => {
    if (vistos > 220) return;
    const o = R.objetos[id];
    if (o.estado !== 0 || o.peca.s >= lim) return;
    vistos++;
    const d = Math.hypot(o.x - b.x, o.z - b.z);
    if (d > visao) return;
    sementes.push({ id, v: ((o.peca.s * o.peca.s + 0.04) * (o.ia && d > b.r + 1.5 ? ANDANDO : 1)) / (d + 2) });
  });
  if (!sementes.length) return null;
  sementes.sort((p, q) => q.v - p.v);
  const raio = Math.max(0.9, Math.min(3.5, b.r * 0.9));
  let melhor = null;
  let nota = 0;
  const atual = b.estado === 'come' && b.cacho ? b.cacho : null;
  for (let k = 0; k < Math.min(14, sementes.length); k++) {
    const o = R.objetos[sementes[k].id];
    let soma = 0;
    let sx = 0;
    let sz = 0;
    R.grade.perto(o.x, o.z, raio, (/** @type {number} */ id) => {
      const q = R.objetos[id];
      if (q.estado !== 0 || q.peca.s >= lim) return;
      if (Math.hypot(q.x - o.x, q.z - o.z) > raio) return;
      const m = (q.peca.s * q.peca.s + 0.04) * (q.ia ? ANDANDO : 1);
      soma += m;
      sx += q.x * m;
      sz += q.z * m;
    });
    if (soma <= 0) continue;
    const cx = sx / soma;
    const cz = sz / soma;
    if (evitado(R, b, cx, cz)) continue;
    const d = Math.hypot(cx - b.x, cz - b.z);
    let n = Math.pow(soma, pe.cacho) / (d + 3);
    if (perigoEm(R, b, cx, cz, 2)) n *= pe.perigo;
    if (atual && Math.hypot(atual.x - cx, atual.z - cz) < raio) n *= 1.3;
    if (n > nota) {
      nota = n;
      melhor = { x: cx, z: cz, soma };
    }
  }
  return melhor;
}

/** Peso de uma peca que anda (carro, pessoa) no valor do cacho: ela sai do lugar ate o bot chegar. */
const ANDANDO = 0.45;

/** A peca que cabe mais perto (andando conta como 3 unidades mais longe), fora dos alvos ruins. */
function maisPerto(R, b, visao) {
  const lim = b.r * CABE;
  let melhor = null;
  let nota = Infinity;
  R.grade.perto(b.x, b.z, visao, (/** @type {number} */ id) => {
    const o = R.objetos[id];
    if (o.estado !== 0 || o.peca.s >= lim) return;
    const n = Math.hypot(o.x - b.x, o.z - b.z) + (o.ia ? 3 : 0);
    if (n < nota && !evitado(R, b, o.x, o.z) && !perigoEm(R, b, o.x, o.z, 1.5)) {
      nota = n;
      melhor = o;
    }
  });
  return melhor;
}

/** o e uma presa boa para b agora? (cabe com folga, nao e migalha, nao largada, perto, sem maior em volta) */
function presaBoa(R, b, o, alcance) {
  if (o === b || !o.vivo || o.escudo > 0) return false;
  if (o.jogador && R.protegerJogador) return false;
  if (b.r <= o.r * VANTAGEM * 1.04 || o.r < b.r * 0.3) return false;
  if (b.largou && b.largou.some((/** @type {any} */ l) => l.id === o.id && l.ate > R.t)) return false;
  if (Math.hypot(o.x - b.x, o.z - b.z) > alcance) return false;
  return !perigoEm(R, b, o.x, o.z, 1.5);
}

/**
 * A caca nao esta alcancando? A cada PROVA_CACA s estima quanto falta pelo ritmo em que a distancia caiu; sem
 * alcancar em ALCANCA s (ou passados CACA_MAX s), a presa fica largada por LARGA s e o bot volta a comer.
 * @returns {boolean} largou agora
 */
export function largarPresa(R, b, p) {
  const longa = R.t - (b.cacaT0 ?? b.cacaIni) > CACA_MAX;
  if (!longa && R.t - b.cacaIni < PROVA_CACA) return false;
  const d = Math.hypot(p.x - b.x, p.z - b.z);
  const ritmo = (b.cacaD0 - d) / Math.max(0.1, R.t - b.cacaIni);
  const falta = d - (b.r - p.r * 0.45);
  if (!longa && (falta <= 0 || (ritmo > 0.15 && falta / ritmo < ALCANCA))) {
    b.cacaIni = R.t;
    b.cacaD0 = d;
    return false;
  }
  b.largou = (b.largou || []).filter((/** @type {any} */ l) => l.ate > R.t);
  b.largou.push({ id: p.id, ate: R.t + LARGA });
  b.presa = -1;
  b.estado = 'larga';
  return true;
}

/** Regiao (celula grossa de 12) com mais massa que cabe, pesada pela distancia. */
function regiaoComComida(R, b) {
  const lim = b.r * CABE;
  const C = 12;
  const meio = R.lado / 2;
  let melhor = null;
  let nota = 0;
  for (let z = -meio + C / 2; z < meio; z += C) {
    for (let x = -meio + C / 2; x < meio; x += C) {
      let soma = 0;
      R.grade.perto(x, z, C / 2, (/** @type {number} */ id) => {
        const o = R.objetos[id];
        if (o.estado === 0 && o.peca.s < lim) soma += o.peca.s * o.peca.s + 0.04;
      });
      if (soma <= 0 || perigoEm(R, b, x, z, 3)) continue;
      const n = soma / (Math.hypot(x - b.x, z - b.z) + 10);
      if (n > nota) {
        nota = n;
        melhor = { x, z };
      }
    }
  }
  return melhor;
}

/**
 * Desvio de pecas que nao cabem na boca (predios grandes): olha a frente; se o caminho passa por uma, vira
 * para o lado guardado em b.lado (escolhido uma vez e mantido por ~1 s: nada de tremer).
 * @param {any} R @param {any} b @param {number} dx @param {number} dz direcao unitaria desejada
 * @returns {[number, number]}
 */
export function desviar(R, b, dx, dz) {
  const lim = b.r * CABE;
  const frente = b.r + 2.4;
  let alvo = null;
  let tMin = Infinity;
  R.grade.perto(b.x + dx * frente * 0.5, b.z + dz * frente * 0.5, frente * 0.5 + 4, (/** @type {number} */ id) => {
    const o = R.objetos[id];
    if (o.estado !== 0 || o.peca.s < lim || o.ia) return;
    const ox = o.x - b.x;
    const oz = o.z - b.z;
    const t = ox * dx + oz * dz;
    if (t < -0.2 || t > frente + o.peca.s) return;
    const lat = ox * dz - oz * dx;
    if (Math.abs(lat) > o.peca.s * 0.9 + b.r * 0.4) return;
    // o alvo esta antes do obstaculo: segue reto
    const dAlvo = Math.hypot(b.ax - b.x, b.az - b.z);
    if (dAlvo < t - o.peca.s * 0.5) return;
    if (t < tMin) {
      tMin = t;
      alvo = { lat };
    }
  });
  if (!alvo) {
    if (R.t - (b.ladoT || -9) > 1.2) b.lado = 0;
    return [dx, dz];
  }
  if (!b.lado || R.t - (b.ladoT || -9) > 1.2) b.lado = alvo.lat > 0 ? -1 : 1;
  b.ladoT = R.t;
  // perpendicular para o lado escolhido, mais forte quanto mais perto
  const k = Math.max(0.6, Math.min(1.6, 2.2 - tMin / frente * 1.6));
  const px = -dz * b.lado;
  const pz = dx * b.lado;
  const nx = dx + px * k;
  const nz = dz + pz * k;
  const n = Math.hypot(nx, nz) || 1;
  return [nx / n, nz / n];
}

/**
 * Preso? A cada 1 s confere se o bot chegou mais perto do alvo ou andou; duas falhas seguidas marcam o alvo como
 * ruim por 6 s e forcam pensar de novo.
 * @param {any} R @param {any} b @param {number} dt
 */
export function vigiarPreso(R, b, dt) {
  b.vigia = (b.vigia || 0) + dt;
  if (b.vigia < 1) return;
  b.vigia = 0;
  const dAlvo = Math.hypot(b.ax - b.x, b.az - b.z);
  const andou = Math.hypot(b.x - (b.px ?? b.x), b.z - (b.pz ?? b.z));
  const melhorou = (b.dAnt ?? Infinity) - dAlvo;
  b.px = b.x;
  b.pz = b.z;
  b.dAnt = dAlvo;
  // longe do alvo sem chegar mais perto, ou parado em cima dele sem comer nada
  const parado = dAlvo <= 0.6 && andou < 0.3 && R.t - (b.comeuT || 0) > 1;
  if ((dAlvo > 0.6 && melhorou < 0.5 && andou < 1.2) || parado) b.falhas = (b.falhas || 0) + 1;
  else b.falhas = 0;
  if (b.falhas >= 2) {
    b.falhas = 0;
    b.evitar = (b.evitar || []).filter((/** @type {any} */ e) => e.ate > R.t);
    b.evitar.push({ x: b.ax, z: b.az, ate: R.t + 6 });
    b.cacho = null;
    b.pensar = 0;
    b.dAnt = Infinity;
  }
}

/**
 * Piloto automatico do jogador (?auto, prints, videos e simulacao): pensa como um bot forte e guloso e devolve a
 * direcao da entrada (modulo ate 1).
 * @param {any} R @param {any} b @param {number} dt
 * @returns {{ x: number, z: number }}
 */
export function piloto(R, b, dt) {
  b.pensar -= dt;
  vigiarPreso(R, b, dt);
  if (b.pensar <= 0 || Math.hypot(b.ax - b.x, b.az - b.z) < 0.25) {
    b.pensar = NIVEIS.forte.intervalo;
    const nivel = b.nivel;
    const perso = b.perso;
    b.nivel = 'forte';
    b.perso = 'guloso';
    pensarBot(R, b, R.rng);
    b.nivel = nivel;
    b.perso = perso;
  }
  // o piloto tambem segue a presa entre um pensamento e outro (e larga a que nao alcanca)
  if (b.estado === 'caca' && b.presa >= 0) {
    const p = R.buracos[b.presa];
    if (p && p.vivo) {
      b.ax = p.x + p.vx * 0.3;
      b.az = p.z + p.vz * 0.3;
      if (largarPresa(R, b, p)) b.pensar = 0;
    }
  }
  const dx = b.ax - b.x;
  const dz = b.az - b.z;
  const n = Math.hypot(dx, dz);
  if (n < 0.05) return { x: 0, z: 0 };
  const k = n < 1 && b.estado !== 'come' && b.estado !== 'caca' && b.estado !== 'gigante' ? n : 1;
  return { x: (dx / n) * k, z: (dz / n) * k };
}
