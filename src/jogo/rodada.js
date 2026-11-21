// Uma rodada (logica pura, ASCII, deterministica pela semente): buracos andando, pecas caindo, buraco
// engolindo buraco, gigante especial, renascer, fim por tempo, por eliminacao (Batalha) ou mapa limpo (Solo).
// O render le o estado; o passo devolve os eventos (som, festa, telemetria).
import { criarRng } from '../core/rng.js';
import { gerarMapa, montarCacho, CACHOS_DO_LUGAR, carroRodando, iaAndante, PASSEIO } from './mapa.js';
import { criarGrade } from './grade.js';
import { TEMAS, massaDe, pontosDe, sortearPeca } from './catalogo.js';
import { RAIO_INICIAL, raioDe, massaPara, velocidadeDe, cai, treme, engoleBuraco, RESTO_AO_RENASCER, BOCADO, degrauDe, CABE } from './buraco.js';
import { pensarBot, NIVEIS, PERSONALIDADES, TIPOS, elastico, ameacas, desviar, vigiarPreso, largarPresa } from './ia.js';
import { passoVida } from './vida.js';

export const DURACAO = 120;
/** O Solo tem o bairro maior (66) e 2:30 para engolir tudo (v0.3.1). */
export const DURACAO_SOLO = 150;
/** Quando o gigante especial aparece (s). */
export const GIGANTE_EM = 70;
/** Profundidade em que a peca some de vez. */
const FUNDO = 7;
/**
 * Reabastecimento (v0.3.0, fluxo continuo): depois de `inicio` s, a cada `cada` s, se sobrou menos que `alvo`
 * das pecas pequenas do comeco, um cacho volta num ponto de cacho do mapa longe dos buracos e fora da vista do
 * jogador (mas perto dela: ele acha logo); gente volta a andar na calcada e carro entra pela ponta da rua.
 * No Solo nao ha (o objetivo e limpar o mapa).
 */
export const REABASTECE = { inicio: 10, cada: 0.5, alvo: 0.82, extra: 2400 };
/** Peca um pouco grande demais (ate CEDE x o que cabe) com a boca embaixo racha e cede depois de TEMPO_CEDE s. */
export const CEDE = 1.2;
export const TEMPO_CEDE = 1.5;
/** O que conta como peca pequena (reabastece): raio da pegada abaixo disto. */
const PEQUENA = 1.3;

/** Raio (unidades do mundo) que a camera do jogador mostra em volta dele, para o reabastecimento nao aparecer. */
export const vistaDe = (/** @type {number} */ r) => 0.72 * (14 + r * 4.9) + 2;

export const NOMES = [
  'Munchy', 'Glub', 'Zuzu', 'Kiko', 'Nina', 'Tito', 'Pip', 'Bobo', 'Lulu', 'Rex', 'Mimi', 'Dodo', 'Yumi',
  'Bento', 'Fifi', 'Toto', 'Coco', 'Nhoc', 'Gogo', 'Lili', 'Poppy', 'Bubu', 'Kiwi', 'Taco', 'Mochi', 'Pudim',
];

/**
 * @typedef {{
 *   id: number, nome: string, skin: number, jogador: boolean, nivel: string,
 *   x: number, z: number, vx: number, vz: number, ax: number, az: number, estado: string, pensar: number,
 *   massa: number, r: number, pontos: number, engolidos: number, buracos: number, vivo: boolean,
 *   renasce: number, escudo: number, degrau: number, fora: boolean, morreuEm: number, perso: string,
 * }} Buraco
 */

/**
 * @param {{ modo?: string, tema?: string, semente: number, bots?: number, nivel?: string, niveis?: string[],
 *   roteiro?: boolean, protegerJogador?: boolean, skin?: number, nome?: string, raio?: number, duracao?: number }} o
 */
export function criarRodada(o) {
  const modo = o.modo || 'classico';
  const temaId = o.tema || 'cidade';
  const rng = criarRng((o.semente >>> 0) + 17);
  const mapa = gerarMapa({ tema: temaId, modo, semente: o.semente, roteiro: !!o.roteiro && modo === 'classico' });
  const grade = criarGrade(mapa.lado, 4);
  const objetos = mapa.objetos.map((m, id) => novoObjeto(id, m.peca, m.x, m.z, { ang: m.ang, espelho: m.espelho, ia: m.ia }));
  let massaTotal = 0;
  for (const ob of objetos) {
    ob.cel = grade.por(ob.id, ob.x, ob.z);
    massaTotal += massaDe(ob.peca.s);
  }

  const nBots = modo === 'solo' ? 0 : Math.max(0, o.bots ?? (modo === 'batalha' ? 7 : 8));
  const nomes = NOMES.slice();
  for (let i = nomes.length - 1; i > 0; i--) {
    const k = Math.floor(rng() * (i + 1));
    [nomes[i], nomes[k]] = [nomes[k], nomes[i]];
  }
  /** @type {Buraco[]} */
  const buracos = [];
  const skins = [];
  for (let i = 0; i < 18; i++) if (i !== (o.skin ?? 0)) skins.push(i);
  // personalidades embaralhadas: sempre ha guloso, cacador e medroso na mesa
  const tipos = [];
  for (let i = 0; i < nBots; i++) tipos.push(TIPOS[i % TIPOS.length]);
  for (let i = tipos.length - 1; i > 0; i--) {
    const k = Math.floor(rng() * (i + 1));
    [tipos[i], tipos[k]] = [tipos[k], tipos[i]];
  }
  for (let i = 0; i <= nBots; i++) {
    const sp = mapa.spawns[i % mapa.spawns.length];
    const jogador = i === 0;
    const raio = jogador && o.raio ? o.raio : RAIO_INICIAL;
    const massa = massaPara(raio);
    buracos.push({
      id: i, nome: jogador ? (o.nome || '') : nomes[i % nomes.length], skin: jogador ? (o.skin ?? 0) : skins[(i * 7 + Math.floor(rng() * 5)) % skins.length],
      jogador, nivel: jogador ? 'jogador' : (o.niveis && o.niveis[(i - 1) % o.niveis.length]) || o.nivel || 'medio',
      x: sp.x, z: sp.z, vx: 0, vz: 0, ax: sp.x, az: sp.z, estado: 'passeia', pensar: rng() * 0.5,
      massa, r: raioDe(massa), pontos: 0, engolidos: 0, buracos: 0, vivo: true, renasce: 0, escudo: jogador ? 0 : 0,
      degrau: 0, fora: false, morreuEm: 0, perso: jogador ? 'guloso' : tipos[i - 1],
      // IA (v0.3.1): ultima comida, caca em andamento e presas largadas, proxima chance de cacar
      comeuT: 0, presa: -1, cacaIni: 0, cacaT0: 0, cacaD0: 0, largou: [], proxCaca: 0,
    });
  }
  for (const b of buracos) b.degrau = degrauDe(b.r);

  let pequenas = 0;
  let carrosRodando = 0;
  for (const ob of objetos) {
    if (ob.peca.s < PEQUENA) pequenas++;
    if (ob.ia && ob.ia.tipo === 'carro') carrosRodando++;
  }

  return {
    modo, tema: temaId, lado: mapa.lado, mapa, grade, objetos, buracos, rng,
    /** reabastecimento: pecas pequenas e carros rodando no comeco e agora */
    reab: { pequenasIni: pequenas, pequenas, carrosIni: carrosRodando, carros: carrosRodando, t: 0, extra: 0, cachos: 0 },
    t: 0, duracao: o.duracao ?? (modo === 'solo' ? DURACAO_SOLO : DURACAO), fim: false, motivo: '',
    protegerJogador: !!o.protegerJogador,
    massaTotal, massaComida: 0, restantes: objetos.length,
    gigante: modo === 'solo' ? null : { em: GIGANTE_EM, id: -1 },
    /** contagem por grupo de peca engolida pelo jogador (desafio do dia) */
    comidasJogador: /** @type {Record<string, number>} */ ({}),
  };
}

/** @typedef {ReturnType<typeof criarRodada>} Rodada */

/** O jogador (sempre o buraco 0). @param {Rodada} R */
export const jogador = (R) => R.buracos[0];

/** Grupo do catalogo de uma peca (para o desafio do dia). @param {string} tema @param {any} peca */
export function grupoDe(tema, peca) {
  const g = TEMAS[tema].grupos;
  for (const k of Object.keys(g)) if (g[k].includes(peca)) return k;
  return peca === TEMAS[tema].gigante ? 'gigante' : '';
}

/**
 * Avanca a rodada. ent: direcao do jogador (x para a direita, z para baixo na tela), modulo de 0 a 1.
 * @param {Rodada} R @param {number} dt @param {{ x: number, z: number }|null} ent
 * @returns {any[]} eventos
 */
export function passoRodada(R, dt, ent) {
  /** @type {any[]} */
  const ev = [];
  if (R.fim) return ev;
  R.t += dt;
  const meio = R.lado / 2;

  // gigante especial
  if (R.gigante && R.gigante.id < 0 && R.t >= R.gigante.em) ev.push(soltarGigante(R));

  // buracos: pensar e andar
  for (const b of R.buracos) {
    if (!b.vivo) {
      if (b.renasce > 0 && (b.renasce -= dt) <= 0) ev.push(renascer(R, b));
      continue;
    }
    if (b.escudo > 0) b.escudo = Math.max(0, b.escudo - dt);
    let dx = 0;
    let dz = 0;
    let fator = 1;
    if (b.jogador) {
      if (ent) {
        dx = ent.x;
        dz = ent.z;
      }
    } else {
      const nv = NIVEIS[b.nivel] || NIVEIS.medio;
      // placar disputado no Classico (elastico); na Batalha nao: e preciso ficar maior que os outros para engolir
      fator = nv.vel * (R.modo === 'classico' ? elastico(b.massa, R.buracos[0].massa, R.protegerJogador) : 1);
      b.pensar -= dt;
      // reflexo: um maior chegou perto e o bot nao esta fugindo -> pensa agora
      if (b.estado !== 'foge' && ameacas(R, b, (PERSONALIDADES[b.perso] || PERSONALIDADES.guloso).margem * 0.8).length) b.pensar = Math.min(b.pensar, 0);
      // cacando: segue a presa entre um pensamento e outro; sem alcancar em ~2,5 s, desiste dela por 6 s
      if (b.estado === 'caca' && b.presa >= 0) {
        const p = R.buracos[b.presa];
        if (p && p.vivo) {
          b.ax = p.x + p.vx * 0.3;
          b.az = p.z + p.vz * 0.3;
          if (largarPresa(R, b, p)) b.pensar = 0;
        }
      }
      vigiarPreso(R, b, dt);
      const dAlvo = Math.hypot(b.ax - b.x, b.az - b.z);
      if (b.pensar <= 0 || dAlvo < 0.25) {
        b.pensar = nv.intervalo * (0.8 + R.rng() * 0.4);
        pensarBot(R, b, R.rng);
      }
      const ddx = b.ax - b.x;
      const ddz = b.az - b.z;
      const n = Math.hypot(ddx, ddz);
      if (n > 0.05) {
        [dx, dz] = desviar(R, b, ddx / n, ddz / n);
        // so freia chegando num ponto vazio; comendo ou cacando vai inteiro (freando, ficava atras do carro)
        if (n < 1 && b.estado !== 'come' && b.estado !== 'caca' && b.estado !== 'gigante') {
          dx *= n;
          dz *= n;
        }
      }
    }
    const m = Math.hypot(dx, dz);
    if (m > 1) {
      dx /= m;
      dz /= m;
    }
    const v = velocidadeDe(b.r) * fator;
    // aceleracao curta: responde rapido, sem tranco
    const k = Math.min(1, dt * 10);
    b.vx += (dx * v - b.vx) * k;
    b.vz += (dz * v - b.vz) * k;
    b.x = Math.max(-meio + 0.6, Math.min(meio - 0.6, b.x + b.vx * dt));
    b.z = Math.max(-meio + 0.6, Math.min(meio - 0.6, b.z + b.vz * dt));
  }

  // vida da cidade: pessoas andando, fugindo e acenando; carros rodando, parando e buzinando
  passoVida(R, dt, ev);

  // engolir pecas: o maior primeiro
  const ordem = R.buracos.filter((b) => b.vivo).sort((a, b) => b.r - a.r);
  for (const b of ordem) {
    /** @type {number[]} */
    const caem = [];
    R.grade.perto(b.x, b.z, b.r + 5, (id) => {
      const o = R.objetos[id];
      if (o.estado !== 0) return;
      const d = Math.hypot(o.x - b.x, o.z - b.z);
      if (cai(b.r, o.peca.s, d)) caem.push(id);
      else if (treme(b.r, o.peca.s, d)) {
        o.treme = 0.25;
        // um pouco grande demais e com a boca embaixo: balanca, racha e cede
        if (o.peca.s < b.r * CABE * CEDE && d < b.r * 0.75) {
          const antes = o.dano;
          o.dano = Math.min(1, o.dano + dt / TEMPO_CEDE);
          o.danoT = R.t;
          if (antes < 0.3 && o.dano >= 0.3) ev.push({ tipo: 'racha', obj: o.id, buraco: b.id, s: o.peca.s });
          if (o.dano >= 1) caem.push(id);
        }
      }
    });
    for (const id of caem) ev.push(comecarQueda(R, b, R.objetos[id]));
  }

  // quedas (e a rachadura volta devagar quando a boca sai de baixo)
  for (const o of R.objetos) {
    if (o.treme > 0) o.treme = Math.max(0, o.treme - dt);
    if (o.dano > 0 && o.estado === 0 && R.t - (o.danoT || 0) > 0.1) o.dano = Math.max(0, o.dano - dt * 0.25);
    if (o.estado === 1) cair(R, o, dt);
  }

  if (R.modo !== 'solo') reabastecer(R, dt, ev);

  // buraco engole buraco
  for (const a of ordem) {
    if (!a.vivo) continue;
    for (const b of R.buracos) {
      if (b === a || !b.vivo || b.escudo > 0) continue;
      const d = Math.hypot(a.x - b.x, a.z - b.z);
      if (!engoleBuraco(a.r, b.r, d)) continue;
      ev.push(engolirBuraco(R, a, b));
    }
  }

  // tamanho e degrau
  for (const b of R.buracos) {
    const r = raioDe(b.massa);
    if (r !== b.r) {
      b.r = r;
      const dg = degrauDe(r);
      if (dg > b.degrau) {
        b.degrau = dg;
        ev.push({ tipo: 'degrau', buraco: b.id, degrau: dg });
      }
    }
  }

  // fim
  const vivos = R.buracos.filter((b) => b.vivo || b.renasce > 0);
  if (R.modo === 'batalha' && (vivos.length <= 1 || !jogador(R).vivo)) encerrar(R, !jogador(R).vivo ? 'eliminado' : 'ultimo', ev);
  else if (R.modo === 'solo' && R.restantes <= 0) encerrar(R, 'limpo', ev);
  else if (R.t >= R.duracao) encerrar(R, 'tempo', ev);
  return ev;
}

/** @param {Rodada} R @param {string} motivo @param {any[]} ev */
function encerrar(R, motivo, ev) {
  R.fim = true;
  R.motivo = motivo;
  ev.push({ tipo: 'fim', motivo });
}

/** Objeto da rodada (pecas do mapa e o gigante). */
function novoObjeto(id, peca, x, z, extra = {}) {
  return {
    id, peca, x, z, y: 0, vx: 0, vz: 0, ang: 0, espelho: false, ia: null,
    estado: 0, dono: -1, ox: 0, oz: 0, vy: 0, incl: 0, vincl: 0, giro: 0, vgiro: 0, vin: 0, redemoinho: 0, eixo: 0,
    treme: 0, cel: -1, nasceu: -1, caiuEm: 0, brota: -1, dano: 0,
    ...extra,
  };
}

/**
 * Queda com fisica simples (tudo relativo ao centro do buraco, que pode estar andando):
 * 1) tomba na borda: inclina para dentro com atrito, ainda apoiada (peca grande tomba mais devagar);
 * 2) passou do ponto: cai com gravidade, escorrega para o centro acelerando e desce em espiral (redemoinho),
 *    girando; a parede do tubo segura a peca dentro do buraco;
 * 3) some no fundo.
 * @param {Rodada} R @param {any} o @param {number} dt
 */
function cair(R, o, dt) {
  const b = R.buracos[o.dono];
  const s = o.peca.s;
  const inercia = 1 / (0.55 + s * 0.45);
  const apoiada = o.incl < 0.78 && o.y > -0.01;
  // tombar: torque da parte que ja esta sobre o vazio
  o.vincl += dt * (4.5 + 5 * inercia);
  o.incl = Math.min(2.4, o.incl + o.vincl * dt);
  // escorregar para o centro: devagar enquanto apoiada (atrito na borda), depois acelera
  o.vin += dt * (apoiada ? 1.6 : 7.5) * inercia;
  if (apoiada) o.vin *= Math.exp(-dt * 2);
  let d = Math.hypot(o.ox, o.oz);
  if (d > 1e-4) {
    const passo = Math.min(d, o.vin * dt);
    o.ox -= (o.ox / d) * passo;
    o.oz -= (o.oz / d) * passo;
  }
  // redemoinho: gira em volta do centro, mais rapido quanto mais fundo
  if (!apoiada) {
    const a = o.redemoinho * dt * (1.1 + Math.min(3, -o.y * 0.3));
    const c = Math.cos(a);
    const sn = Math.sin(a);
    const x = o.ox * c - o.oz * sn;
    o.oz = o.ox * sn + o.oz * c;
    o.ox = x;
  }
  // parede do tubo
  d = Math.hypot(o.ox, o.oz);
  const dMax = Math.max(0, (b ? b.r : 1) - s * 0.55);
  if (o.y < -0.25 && d > dMax && d > 0) {
    o.ox *= dMax / d;
    o.oz *= dMax / d;
  }
  if (d > 0.05) o.eixo = Math.atan2(o.oz, o.ox);
  // gravidade (so depois de tombar)
  if (apoiada) o.vy = 0;
  else o.vy -= 20 * dt;
  o.y += o.vy * dt;
  o.vgiro *= 1 + dt * 0.6;
  o.giro += o.vgiro * dt;
  if (b && b.vivo) {
    o.x = b.x + o.ox;
    o.z = b.z + o.oz;
  }
  if (o.y < -FUNDO - s * 2) o.estado = 2;
}

/** @param {Rodada} R @param {Buraco} b @param {any} o */
function comecarQueda(R, b, o) {
  b.comeuT = R.t;
  o.estado = 1;
  o.dono = b.id;
  o.ox = o.x - b.x;
  o.oz = o.z - b.z;
  o.eixo = Math.atan2(o.oz, o.ox);
  o.vy = 0;
  o.y = 0;
  // ja vinha inclinando na borda (o render tomba a peca antes de ela cair: continua dali)
  o.incl = 0.3;
  o.vincl = 0.8;
  o.vin = 0.5;
  o.vgiro = (R.rng() - 0.5) * 5;
  o.redemoinho = (R.rng() < 0.5 ? -1 : 1) * (0.8 + R.rng() * 0.9);
  o.vx = 0;
  o.vz = 0;
  o.caiuEm = R.t;
  R.grade.tirar(o.id, o.cel);
  o.cel = -1;
  const m = massaDe(o.peca.s);
  const p = pontosDe(o.peca.s);
  b.massa += m;
  b.pontos += p;
  b.engolidos++;
  R.massaComida += m;
  R.restantes--;
  if (o.peca.s < PEQUENA) R.reab.pequenas--;
  if (o.ia && o.ia.tipo === 'carro') R.reab.carros--;
  if (b.jogador) {
    const g = grupoDe(R.tema, o.peca);
    R.comidasJogador[g] = (R.comidasJogador[g] || 0) + 1;
  }
  return { tipo: 'comeu', buraco: b.id, obj: o.id, s: o.peca.s, pontos: p, forma: o.peca.forma };
}

/** Poe uma peca nova no mapa durante a rodada (reabastecimento). @param {Rodada} R @param {any} q */
function brotar(R, q) {
  const id = R.objetos.length;
  const o = novoObjeto(id, q.peca, q.x, q.z, { ang: q.ang || 0, espelho: !!q.espelho, ia: q.ia || null, brota: R.t });
  o.cel = R.grade.por(id, o.x, o.z);
  R.objetos.push(o);
  R.restantes++;
  R.massaTotal += massaDe(o.peca.s);
  R.reab.extra++;
  if (o.peca.s < PEQUENA) R.reab.pequenas++;
  if (o.ia && o.ia.tipo === 'carro') R.reab.carros++;
  return o;
}

/** Longe de todos os buracos? @param {Rodada} R @param {number} x @param {number} z @param {number} folga */
function longeDosBuracos(R, x, z, folga) {
  for (const b of R.buracos) if (b.vivo && Math.hypot(b.x - x, b.z - z) < b.r + folga) return false;
  return true;
}

/**
 * Fluxo continuo: devolve cachos, gente e carros ao mapa conforme o que foi comido (ver REABASTECE).
 * @param {Rodada} R @param {number} dt @param {any[]} ev
 */
function reabastecer(R, dt, ev) {
  const rb = R.reab;
  if (R.t < REABASTECE.inicio || rb.extra >= REABASTECE.extra) return;
  rb.t += dt;
  if (rb.t < REABASTECE.cada) return;
  rb.t = 0;
  const vista = vistaDe(R.buracos[0].r);
  // quanto mais faltar, mais cachos por vez (ate 3)
  const falta = 1 - rb.pequenas / Math.max(1, rb.pequenasIni);
  const vezes = falta > 0.6 ? 3 : falta > 0.4 ? 2 : 1;
  for (let v = 0; v < vezes; v++) if (rb.extra < REABASTECE.extra) reabastecerCacho(R, vista);
  carroNaPonta(R, vista);
}

/** Um cacho volta no melhor ponto (ver reabastecer). @param {Rodada} R @param {number} vista */
function reabastecerCacho(R, vista) {
  const rb = R.reab;
  const eu = R.buracos[0];
  const pontos = R.mapa.pontos;
  if (rb.pequenas < rb.pequenasIni * REABASTECE.alvo && pontos.length) {
    // ponto de cacho: fora da vista, o mais perto dela, longe dos buracos e ja comido (vazio em volta)
    let melhor = null;
    let nota = Infinity;
    for (let k = 0; k < 16; k++) {
      const p = pontos[Math.floor(R.rng() * pontos.length)];
      const d = Math.hypot(p.x - eu.x, p.z - eu.z);
      if (d < vista || !longeDosBuracos(R, p.x, p.z, 6)) continue;
      let cheio = 0;
      R.grade.perto(p.x, p.z, 1.6, (id) => {
        const o = R.objetos[id];
        if (o.estado === 0 && !o.ia && Math.hypot(o.x - p.x, o.z - p.z) < 1.8) cheio++;
      });
      if (cheio > 2) continue;
      const n = d - vista + R.rng() * 6;
      if (n < nota) {
        nota = n;
        melhor = p;
      }
    }
    if (melhor) {
      const lista = CACHOS_DO_LUGAR[/** @type {'rua'} */ (melhor.lugar)];
      const nome = lista[Math.floor(R.rng() * lista.length)];
      // dentro do mapa como no gerarMapa (antes o cacho da borda brotava pecas alem da borda, v0.3.1)
      const lim = R.lado / 2 - 0.5;
      for (const q of montarCacho(R.tema, nome, melhor.x, melhor.z, melhor.ang, R.rng, melhor.comp)) {
        if (Math.abs(q.x) <= lim && Math.abs(q.z) <= lim) brotar(R, q);
      }
      rb.cachos++;
      // e alguem volta a andar na calcada do quarteirao mais perto
      const bi = blocoPerto(R, melhor.x, melhor.z);
      if (bi >= 0) {
        const b = R.mapa.blocos[bi];
        const x = (b.x0 + b.x1) / 2;
        const z = b.z0 + PASSEIO;
        if (Math.hypot(x - eu.x, z - eu.z) > vista && longeDosBuracos(R, x, z, 6)) {
          const sentido = R.rng() < 0.5 ? 1 : -1;
          const ia = iaAndante(bi, sentido > 0 ? 1 : 0, sentido, R.rng);
          brotar(R, { peca: sortearPeca(TEMAS[R.tema].grupos.pessoa, R.rng), x, z, ia });
        }
      }
    }
  }
}

/** Carro entra pela ponta de uma rua (fora da vista e longe dos buracos). @param {Rodada} R @param {number} vista */
function carroNaPonta(R, vista) {
  const rb = R.reab;
  const eu = R.buracos[0];
  if (rb.carros < rb.carrosIni * 0.75) {
    const L = R.mapa.linhas;
    const rodando = TEMAS[R.tema].grupos.carro.filter((p) => p.anda && p.forma === 'carro');
    if (L.length && rodando.length) {
      const eixo = R.rng() < 0.5 ? 'h' : 'v';
      const linha = L[Math.floor(R.rng() * L.length)];
      const dir = R.rng() < 0.5 ? 1 : -1;
      const pos = dir > 0 ? L[0] - 1.5 : L[L.length - 1] + 1.5;
      const bloq = R.mapa.bloqueadas.some((/** @type {any} */ q) => q.eixo === eixo && q.L === linha);
      const c = carroRodando(sortearPeca(rodando, R.rng), eixo, linha, dir, pos, R.rng);
      if (!bloq && Math.hypot(c.x - eu.x, c.z - eu.z) > vista && longeDosBuracos(R, c.x, c.z, 5)) {
        // ninguem na frente na mesma faixa
        let livre = true;
        R.grade.perto(c.x, c.z, 3, (id) => {
          const o = R.objetos[id];
          if (o.estado === 0 && o.ia && o.ia.tipo === 'carro' && Math.hypot(o.x - c.x, o.z - c.z) < 3) livre = false;
        });
        if (livre) brotar(R, c);
      }
    }
  }
}

/** Indice do quarteirao que contem (ou esta mais perto de) um ponto. @param {Rodada} R @param {number} x @param {number} z */
function blocoPerto(R, x, z) {
  let melhor = -1;
  let dmin = Infinity;
  R.mapa.blocos.forEach((/** @type {any} */ b, /** @type {number} */ i) => {
    const dx = Math.max(b.x0 - x, 0, x - b.x1);
    const dz = Math.max(b.z0 - z, 0, z - b.z1);
    const d = Math.hypot(dx, dz);
    if (d < dmin) {
      dmin = d;
      melhor = i;
    }
  });
  return dmin < 4 ? melhor : -1;
}

/** @param {Rodada} R @param {Buraco} a @param {Buraco} b */
function engolirBuraco(R, a, b) {
  a.comeuT = R.t;
  const ganho = b.massa * BOCADO + 2;
  a.massa += ganho;
  a.pontos += Math.round(b.pontos * 0.3) + 25;
  a.buracos++;
  b.vivo = false;
  b.morreuEm = R.t;
  b.vx = 0;
  b.vz = 0;
  if (R.modo === 'classico') {
    b.renasce = 2;
    b.massa *= RESTO_AO_RENASCER;
    b.pontos = Math.round(b.pontos * 0.6);
  } else {
    b.fora = true;
  }
  return { tipo: 'engoliu', buraco: a.id, vitima: b.id, x: b.x, z: b.z };
}

/** Renasce no cruzamento mais longe dos buracos maiores. @param {Rodada} R @param {Buraco} b */
function renascer(R, b) {
  let melhor = R.mapa.spawns[0];
  let dist = -1;
  for (const sp of R.mapa.spawns) {
    let dmin = Infinity;
    for (const o of R.buracos) if (o !== b && o.vivo) dmin = Math.min(dmin, Math.hypot(o.x - sp.x, o.z - sp.z) - o.r);
    if (dmin > dist) {
      dist = dmin;
      melhor = sp;
    }
  }
  b.x = melhor.x;
  b.z = melhor.z;
  b.ax = b.x;
  b.az = b.z;
  b.vivo = true;
  b.renasce = 0;
  b.escudo = 3;
  b.r = raioDe(b.massa);
  return { tipo: 'renasceu', buraco: b.id };
}

/** O gigante cai do ceu num cruzamento longe de todos. @param {Rodada} R */
function soltarGigante(R) {
  const peca = TEMAS[R.tema].gigante;
  let melhor = R.mapa.spawns[0];
  let dist = -1;
  for (const sp of R.mapa.spawns) {
    let dmin = Infinity;
    for (const o of R.buracos) if (o.vivo) dmin = Math.min(dmin, Math.hypot(o.x - sp.x, o.z - sp.z));
    if (dmin > dist) {
      dist = dmin;
      melhor = sp;
    }
  }
  // abre espaco: o que estava ali e empurrado para fora do circulo
  R.grade.perto(melhor.x, melhor.z, peca.s + 1, (id) => {
    const o = R.objetos[id];
    if (o.estado !== 0) return;
    const dx = o.x - melhor.x;
    const dz = o.z - melhor.z;
    const d = Math.hypot(dx, dz) || 1;
    if (d < peca.s + o.peca.s) {
      o.x = melhor.x + (dx / d) * (peca.s + o.peca.s + 0.2);
      o.z = melhor.z + (dz / d) * (peca.s + o.peca.s + 0.2);
      R.grade.tirar(o.id, o.cel);
      o.cel = R.grade.por(o.id, o.x, o.z);
    }
  });
  const id = R.objetos.length;
  const o = novoObjeto(id, peca, melhor.x, melhor.z, { nasceu: R.t });
  o.cel = R.grade.por(id, o.x, o.z);
  R.objetos.push(o);
  R.restantes++;
  R.massaTotal += massaDe(peca.s);
  R.gigante = { em: R.gigante ? R.gigante.em : 0, id };
  return { tipo: 'gigante', obj: id, x: o.x, z: o.z };
}

/** Placar: vivos e renascendo por massa (o jogador sempre aparece). @param {Rodada} R */
export function placar(R) {
  return R.buracos.filter((b) => !b.fora || b.jogador).slice().sort((a, b) => b.massa - a.massa);
}

/** Colocacao do jogador (1 = primeiro). Na Batalha, eliminado conta pela ordem de saida. @param {Rodada} R */
export function colocacao(R) {
  const eu = jogador(R);
  if (R.modo === 'batalha') {
    const vivos = R.buracos.filter((b) => !b.fora);
    if (!eu.fora) return 1 + vivos.filter((b) => b !== eu && b.massa > eu.massa).length;
    return 1 + vivos.length + R.buracos.filter((b) => b.fora && b !== eu && b.morreuEm > eu.morreuEm).length;
  }
  return 1 + R.buracos.filter((b) => b !== eu && b.massa > eu.massa).length;
}

/** Fracao comida do mapa (Solo). @param {Rodada} R */
export const fracaoComida = (R) => (R.massaTotal ? R.massaComida / R.massaTotal : 0);
