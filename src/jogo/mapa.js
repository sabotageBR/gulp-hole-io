// Gerador do mapa por semente (logica pura, ASCII). O mundo e um quadrado centrado na origem, cortado por
// ruas em grade (linhas a cada PERIODO). Entre as ruas ficam os quarteiroes, com calcada na borda e um
// miolo de um destes tipos: casas, centro, parque, estacionamento, marco. As pecas vem do catalogo do tema.
// (v0.2.0) Cidade densa: 8 casas por quarteirao, fileiras de lojas e predios, postes e semaforos, faixas de
// pedestre, pessoas andando pelas calcadas (e atravessando nas esquinas) ou paradas em grupinhos, carros
// rodando nas ruas pela mao direita e estacionados junto ao meio-fio.
//
// (v0.3.0) Muito mais coisa para comer, em cachos (sequencias para o combo): obra com cones, feira de barracas,
// mesinhas de cafe, bicicletario, motos na vaga, esquina com lixeira e hidrante, jardim de vasos, fila de gente,
// carrinhos, piquenique. Os pontos dos cachos (`pontos`) servem para o reabastecimento da rodada.
//
// Saida: { tema, lado, linhas, regioes, faixas, blocos, objetos, spawns, trilha, bloqueadas, pontos }
//   regioes: retangulos do chao { x0, z0, x1, z1, tipo: 'rua'|'calcada'|'miolo'|'praca'|'borda' }
//   faixas:  tracos pintados na rua { x0, z0, x1, z1, tipo: 'linha'|'zebra' }
//   blocos:  quarteiroes { i, j, x0, z0, x1, z1, tipo }
//   objetos: { peca, x, z, ang, espelho, ia }  (ia: pessoa ou carro andando; null = parado)
//   spawns:  cruzamentos para os buracos nascerem
//   bloqueadas: ruas onde carro nao entra (a trilha da primeira rodada)
import { criarRng } from '../core/rng.js';
import { TEMAS, sortearPeca, pecaPorId } from './catalogo.js';

export const PERIODO = 18;
export const RUA = 4;
export const CALCADA = 1.2;
/** Do meio da rua ao centro da faixa de rolamento (mao direita). */
export const FAIXA = 0.75;
/** Do meio da rua aos carros estacionados (junto ao meio-fio). */
export const VAGA = 1.5;
/** Do meio-fio ao caminho das pessoas na calcada. */
export const PASSEIO = 0.62;
/** Lado do mapa por modo. */
// Solo era 48 (2x2 quarteiroes): da Doceria em diante parecia que o mapa tinha encolhido (v0.3.1: 66, 3x3)
export const LADO = { classico: 120, batalha: 84, solo: 66 };

/** Meio lado da caixa de uma peca (o raio s da pegada e ~1,2x o meio lado). @param {number} s */
export const meioLado = (s) => s / 1.2;

/** Pessoa andando pela calcada do bloco blk, rumo ao canto k (0 NO, 1 NE, 2 SE, 3 SO). */
export function iaAndante(blk, canto, sentido, r) {
  return { tipo: 'pessoa', modo: 'anda', blk, canto, sentido, off: PASSEIO + (r() - 0.5) * 0.25, vel: 0.75 + r() * 0.3, gx: 0, gz: 0, t: r() * 4, voz: r(), calmo: false, pensa: r() * 0.3 };
}
/** Pessoa parada (grupinho que conversa e acena), virada para (gx, gz). */
export function iaParado(gx, gz, r, calmo = false) {
  return { tipo: 'pessoa', modo: 'parado', blk: -1, canto: 0, sentido: 1, off: PASSEIO, vel: 0.8 + r() * 0.25, gx, gz, t: 2 + r() * 6, voz: r(), calmo, pensa: r() * 0.3 };
}

/**
 * Cachos: o que vai em cada um (papel do tema, minimo, maximo) e como se arrumam.
 *   fila:  em linha na direcao do angulo (calcada, vaga da rua); de lado: um ao lado do outro, de frente para a rua
 *   monte: espalhados num circulo pequeno, sem encostar
 *   feira: barracas em linha, caixotes e gente na frente
 */
export const CACHOS = {
  obra: { itens: [['cone', 4, 6], ['barreira', 1, 2], ['placa', 1, 1]], arranjo: 'fila' },
  esquina: { itens: [['lixeira', 1, 2], ['caixa', 1, 1], ['hidrante', 1, 1], ['placa', 0, 1]], arranjo: 'fila' },
  jardim: { itens: [['vaso', 2, 4], ['arbusto', 1, 2]], arranjo: 'fila' },
  fila: { itens: [['placa', 1, 1], ['pessoa', 3, 5]], arranjo: 'fila' },
  bicicletario: { itens: [['bike', 4, 6]], arranjo: 'fila' },
  motos: { itens: [['moto', 3, 5]], arranjo: 'lado' },
  carrinhos: { itens: [['carrinho', 2, 4], ['caixote', 1, 2]], arranjo: 'monte' },
  feira: { itens: [['barraca', 2, 3], ['caixote', 3, 5], ['pessoa', 2, 3]], arranjo: 'feira' },
  cafe: { itens: [['mesa', 2, 3], ['vaso', 1, 2], ['pessoa', 2, 3]], arranjo: 'monte' },
  piquenique: { itens: [['mesa', 1, 1], ['caixote', 1, 3], ['banco', 0, 1], ['pessoa', 2, 3]], arranjo: 'monte' },
};
/** Que cachos cabem em cada tipo de lugar. */
export const CACHOS_DO_LUGAR = {
  calcada: ['obra', 'esquina', 'jardim', 'fila', 'bicicletario', 'jardim', 'esquina', 'obra'],
  rua: ['motos', 'obra', 'motos'],
  praca: ['feira', 'cafe', 'piquenique', 'carrinhos', 'feira', 'cafe', 'piquenique'],
};

/**
 * Monta um cacho em volta de (cx, cz), na direcao ang (radianos, 0 = +x). Puro: devolve as pecas
 * { peca, x, z, ang, espelho, ia } sem por no mapa (o gerador e o reabastecimento usam).
 * @param {string} temaId @param {string} nome @param {number} cx @param {number} cz @param {number} ang
 * @param {() => number} r rng @param {number} [maxComp] comprimento maximo da fila
 */
export function montarCacho(temaId, nome, cx, cz, ang, r, maxComp = 99) {
  const tema = TEMAS[temaId] || TEMAS.cidade;
  const def = CACHOS[/** @type {'obra'} */ (nome)] || CACHOS.jardim;
  const papel = (/** @type {string} */ k) => {
    if (k === 'pessoa') return sortearPeca(tema.grupos.pessoa, r);
    const ids = tema.papeis[k] || [];
    return ids.length ? pecaPorId(temaId, ids[Math.floor(r() * ids.length)]) : null;
  };
  /** @type {any[]} */
  const pecas = [];
  for (const [k, a, b] of def.itens) {
    const n = a + Math.floor(r() * (b - a + 1));
    // a mesma peca no cacho todo (cones iguais em fila), com chance de variar um pouco
    let p = papel(k);
    for (let i = 0; i < n; i++) {
      if (i && r() < 0.25) p = papel(k);
      if (p) pecas.push({ papel: k, peca: p });
    }
  }
  const ux = Math.cos(ang);
  const uz = Math.sin(ang);
  /** @type {{ peca: any, x: number, z: number, ang: number, espelho: boolean, ia: any }[]} */
  const out = [];
  const add = (/** @type {any} */ peca, /** @type {number} */ x, /** @type {number} */ z, /** @type {number} */ a, ia = null) => out.push({ peca, x, z, ang: a, espelho: r() < 0.5, ia });
  if (def.arranjo === 'fila' || def.arranjo === 'lado') {
    const lado = def.arranjo === 'lado';
    // espaco de cada peca na fila (de lado: as motos ficam lado a lado, a largura e ~0,55 do raio)
    const passo = pecas.map((q) => (lado ? q.peca.s * 1.25 : q.peca.s * 1.9) + 0.06);
    let comp = passo.reduce((x, y) => x + y, 0);
    while (comp > maxComp && pecas.length > 1) {
      pecas.pop();
      comp -= /** @type {number} */ (passo.pop());
    }
    let t = -comp / 2;
    for (let i = 0; i < pecas.length; i++) {
      const q = pecas[i];
      const c = t + passo[i] / 2;
      t += passo[i];
      const x = cx + ux * c + (r() - 0.5) * 0.06;
      const z = cz + uz * c + (r() - 0.5) * 0.06;
      if (q.papel === 'pessoa') add(q.peca, x, z, ang, iaParado(cx - ux * comp, cz - uz * comp, r));
      else add(q.peca, x, z, lado ? ang + Math.PI / 2 * (r() < 0.5 ? 1 : -1) : ang + (r() < 0.5 ? 0 : Math.PI));
    }
  } else if (def.arranjo === 'feira') {
    const barracas = pecas.filter((q) => q.papel === 'barraca');
    const resto = pecas.filter((q) => q.papel !== 'barraca');
    const w = 1.75;
    barracas.forEach((q, i) => {
      const c = (i - (barracas.length - 1) / 2) * w;
      add(q.peca, cx + ux * c, cz + uz * c, ang + Math.PI / 2);
    });
    // na frente das barracas (lado -perpendicular)
    resto.forEach((q, i) => {
      const c = (i / Math.max(1, resto.length - 1) - 0.5) * w * barracas.length * 0.9;
      const f = 1.15 + (r() - 0.5) * 0.3;
      const x = cx + ux * c + uz * f;
      const z = cz + uz * c - ux * f;
      if (q.papel === 'pessoa') add(q.peca, x, z, 0, iaParado(cx + ux * c, cz + uz * c, r));
      else add(q.peca, x, z, r() * Math.PI * 2);
    });
  } else {
    // monte: espalha num circulo sem encostar (tentativas com rejeicao)
    const raio = 0.45 + 0.28 * pecas.length;
    for (const q of pecas) {
      for (let k = 0; k < 14; k++) {
        const a = r() * Math.PI * 2;
        const d = Math.sqrt(r()) * raio;
        const x = cx + Math.cos(a) * d;
        const z = cz + Math.sin(a) * d;
        if (out.some((o) => Math.hypot(o.x - x, o.z - z) < (o.peca.s + q.peca.s) * 0.85)) continue;
        if (q.papel === 'pessoa') add(q.peca, x, z, 0, iaParado(cx, cz, r));
        else add(q.peca, x, z, r() * Math.PI * 2);
        break;
      }
    }
  }
  return out;
}

/**
 * Carro rodando na faixa da mao direita da rua (eixo, L), no sentido dir, na posicao pos ao longo da rua.
 * @param {any} peca @param {string} eixo @param {number} L @param {number} dir @param {number} pos @param {() => number} r
 */
export function carroRodando(peca, eixo, L, dir, pos, r) {
  const cruz = 2.3 + r() * 0.9;
  const ia = { tipo: 'carro', eixo, L, dir, pos, vel: cruz, cruz, curva: null, buzina: -9, espera: 0, pensa: r() * 0.2 };
  if (eixo === 'h') return { peca, x: pos, z: L + FAIXA * dir, ang: dir > 0 ? 0 : Math.PI, ia };
  return { peca, x: L - FAIXA * dir, z: pos, ang: dir > 0 ? Math.PI / 2 : -Math.PI / 2, ia };
}

/**
 * @param {{ tema: string, modo?: string, semente: number, roteiro?: boolean }} o
 */
export function gerarMapa(o) {
  const tema = TEMAS[o.tema] || TEMAS.cidade;
  const modo = o.modo || 'classico';
  const lado = LADO[/** @type {'classico'} */ (modo)] || LADO.classico;
  const r = criarRng((o.semente >>> 0) ^ 0x9e3779b9);
  const meio = lado / 2;
  const g = tema.grupos;

  // linhas das ruas: simetricas em volta da origem, a 6 unidades da borda no minimo
  // a ultima rua fica a 6 da borda: classico (54) e batalha (36) cruzam na origem; solo (27) nao (3x3)
  const desloc = (meio - 6) % PERIODO === 0 ? 0 : PERIODO / 2;
  /** @type {number[]} */
  const linhas = [];
  for (let v = -meio; v <= meio; v += 0.5) {
    if (Math.abs(((v - desloc) % PERIODO + PERIODO) % PERIODO) < 1e-6 && Math.abs(v) <= meio - 6) linhas.push(v);
  }
  const prim = linhas[0];
  const ult = linhas[linhas.length - 1];
  const nb = linhas.length - 1;

  /** @type {{ x0: number, z0: number, x1: number, z1: number, tipo: string }[]} */
  const regioes = [];
  /** @type {{ x0: number, z0: number, x1: number, z1: number, tipo: string }[]} */
  const faixas = [];
  /** @type {{ peca: import('./catalogo.js').Peca, x: number, z: number, ang: number, espelho: boolean, ia: any }[]} */
  const objetos = [];
  const por = (/** @type {any} */ peca, /** @type {number} */ x, /** @type {number} */ z, extra = {}) => {
    if (!peca || Math.abs(x) > meio - 0.5 || Math.abs(z) > meio - 0.5) return null;
    const ob = { peca, x, z, ang: 0, espelho: r() < 0.5, ia: null, ...extra };
    objetos.push(ob);
    return ob;
  };
  const sortear = (/** @type {string} */ grupo) => sortearPeca(g[grupo] || g.calcada, r);
  /** pontos dos cachos (o reabastecimento da rodada volta neles) */
  /** @type {{ x: number, z: number, ang: number, lugar: string, comp: number }[]} */
  const pontos = [];
  const cacho = (/** @type {string} */ lugar, /** @type {number} */ x, /** @type {number} */ z, /** @type {number} */ ang, comp = 99, nome = '') => {
    const lista = CACHOS_DO_LUGAR[/** @type {'rua'} */ (lugar)];
    const n = nome || lista[Math.floor(r() * lista.length)];
    pontos.push({ x, z, ang, lugar, comp });
    for (const q of montarCacho(tema.id, n, x, z, ang, r, comp)) por(q.peca, q.x, q.z, { ang: q.ang, espelho: q.espelho, ia: q.ia });
  };
  const jitter = (/** @type {number} */ a) => (r() - 0.5) * 2 * a;
  /** grupinho de n pessoas em roda em volta de (cx, cz) */
  const grupo = (/** @type {number} */ cx, /** @type {number} */ cz, /** @type {number} */ n, calmo = false) => {
    const a0 = r() * Math.PI * 2;
    for (let k = 0; k < n; k++) {
      const a = a0 + (k / n) * Math.PI * 2;
      const x = cx + Math.cos(a) * 0.42;
      const z = cz + Math.sin(a) * 0.42;
      por(sortear('pessoa'), x, z, { ia: iaParado(cx, cz, r, calmo), espelho: x < cx });
    }
  };

  // chao: borda inteira, ruas por cima (o render desenha na ordem)
  regioes.push({ x0: -meio, z0: -meio, x1: meio, z1: meio, tipo: 'borda' });
  for (const L of linhas) {
    regioes.push({ x0: prim - RUA / 2, z0: L - RUA / 2, x1: ult + RUA / 2, z1: L + RUA / 2, tipo: 'rua' });
    regioes.push({ x0: L - RUA / 2, z0: prim - RUA / 2, x1: L + RUA / 2, z1: ult + RUA / 2, tipo: 'rua' });
    if (tema.faixa) {
      for (let v = prim + RUA; v < ult - RUA + 0.01; v += 2) {
        if (linhas.some((M) => Math.abs(v + 0.5 - M) < RUA / 2 + 1.6)) continue;
        faixas.push({ x0: v, z0: L - 0.07, x1: v + 1, z1: L + 0.07, tipo: 'linha' });
        faixas.push({ x0: L - 0.07, z0: v, x1: L + 0.07, z1: v + 1, tipo: 'linha' });
      }
    }
  }
  // faixas de pedestre antes de cada cruzamento (menos na praia, onde a rua e um deck)
  if (tema.id !== 'praia') {
    for (const L of linhas) {
      for (const C of linhas) {
        for (const lado2 of [-1, 1]) {
          if ((lado2 < 0 && C === prim) || (lado2 > 0 && C === ult)) continue;
          const a = C + lado2 * (RUA / 2 + 0.25);
          const b = C + lado2 * (RUA / 2 + 1.05);
          for (let w = -RUA / 2 + 0.3; w < RUA / 2 - 0.3; w += 0.5) {
            // rua horizontal L cruzando a vertical C, e a vertical L cruzando a horizontal C
            faixas.push({ x0: Math.min(a, b), z0: L + w, x1: Math.max(a, b), z1: L + w + 0.26, tipo: 'zebra' });
            faixas.push({ x0: L + w, z0: Math.min(a, b), x1: L + w + 0.26, z1: Math.max(a, b), tipo: 'zebra' });
          }
        }
      }
    }
  }

  // quarteiroes e seus tipos (dois marcos no Classico, um nos outros)
  /** @type {{ i: number, j: number, x0: number, z0: number, x1: number, z1: number, tipo: string }[]} */
  const blocos = [];
  for (let j = 0; j < nb; j++) {
    for (let i = 0; i < nb; i++) {
      const x0 = linhas[i] + RUA / 2;
      const x1 = linhas[i + 1] - RUA / 2;
      const z0 = linhas[j] + RUA / 2;
      const z1 = linhas[j + 1] - RUA / 2;
      const s = r();
      let tipo = s < 0.38 ? 'casas' : s < 0.68 ? 'centro' : s < 0.86 ? 'parque' : 'estacionamento';
      blocos.push({ i, j, x0, z0, x1, z1, tipo });
    }
  }
  const trilhaBloco = (/** @type {any} */ b) => b.x0 > 0 && b.z0 > 0 && b.x0 < PERIODO && b.z0 < PERIODO;
  {
    const nMarcos = modo === 'classico' ? 2 : 1;
    const livres = blocos.filter((b) => !trilhaBloco(b));
    for (let k = 0; k < nMarcos && livres.length; k++) livres.splice(Math.floor(r() * livres.length), 1)[0].tipo = 'marco';
  }
  // o quarteirao a nordeste da origem e sempre de casas (a casinha do roteiro mora nele)
  for (const b of blocos) if (trilhaBloco(b)) b.tipo = 'casas';
  const marcos = (g.marco || []).slice();
  for (let i = marcos.length - 1; i > 0; i--) {
    const k = Math.floor(r() * (i + 1));
    [marcos[i], marcos[k]] = [marcos[k], marcos[i]];
  }

  for (const b of blocos) {
    const pavimentado = b.tipo === 'centro' || b.tipo === 'estacionamento' || b.tipo === 'marco';
    regioes.push({ x0: b.x0, z0: b.z0, x1: b.x1, z1: b.z1, tipo: 'calcada' });
    regioes.push({ x0: b.x0 + CALCADA, z0: b.z0 + CALCADA, x1: b.x1 - CALCADA, z1: b.z1 - CALCADA, tipo: pavimentado ? 'praca' : 'miolo' });
  }

  for (const b of blocos) {
    const ix0 = b.x0 + CALCADA;
    const iz0 = b.z0 + CALCADA;
    const ix1 = b.x1 - CALCADA;
    const iz1 = b.z1 - CALCADA;
    const tam = ix1 - ix0;
    const cx = (b.x0 + b.x1) / 2;
    const cz = (b.z0 + b.z1) / 2;
    const len = b.x1 - b.x0;
    const bi = blocos.indexOf(b);

    // calcada: postes perto do meio-fio, semaforo em duas esquinas, coisinhas junto aos lotes, gente andando
    for (const t of [len * 0.5]) {
      por(sortear('poste'), b.x0 + t, b.z0 + 0.28);
      por(sortear('poste'), b.x0 + t, b.z1 - 0.28);
      por(sortear('poste'), b.x0 + 0.28, b.z0 + t);
      por(sortear('poste'), b.x1 - 0.28, b.z0 + t);
    }
    if (g.semaforo) {
      por(sortear('semaforo'), b.x0 + 0.32, b.z0 + 0.32);
      por(sortear('semaforo'), b.x1 - 0.32, b.z1 - 0.32);
    }
    // faixa de dentro da calcada (junto aos lotes): cachos (obra, esquina, jardim, fila, bicicletario...) e
    // coisinhas soltas entre eles; o caminho de quem anda (PASSEIO) fica livre
    for (let lado2 = 0; lado2 < 4; lado2++) {
      const ponto = (/** @type {number} */ t) => [[b.x0 + t, b.z0 + 0.98], [b.x0 + t, b.z1 - 0.98], [b.x0 + 0.98, b.z0 + t], [b.x1 - 0.98, b.z0 + t]][lado2];
      const angL = lado2 < 2 ? 0 : Math.PI / 2;
      let t = 1.6 + r() * 0.8;
      while (t < len - 1.6) {
        if (r() < 0.62) {
          const comp = Math.min(3.4, len - 1.6 - t);
          if (comp > 1.2) {
            const [x, z] = ponto(t + comp / 2);
            cacho('calcada', x, z, angL, comp);
          }
          t += comp + 0.9 + r() * 1.2;
        } else {
          const [x, z] = ponto(t);
          por(sortear('calcada'), x + (lado2 < 2 ? jitter(0.2) : 0), z + (lado2 < 2 ? 0 : jitter(0.2)));
          t += 1.1 + r() * 0.8;
        }
      }
    }
    const nAnda = 3 + Math.floor(r() * 3);
    for (let k = 0; k < nAnda; k++) {
      // comeca no meio de um lado, rumo a um canto
      const lado2 = Math.floor(r() * 4);
      const sentido = r() < 0.5 ? 1 : -1;
      const f = 0.15 + r() * 0.7;
      const ia = iaAndante(bi, sentido > 0 ? (lado2 + 1) % 4 : lado2, sentido, r);
      const p = ia.off;
      const pos = [[b.x0 + p + f * (len - 2 * p), b.z0 + p], [b.x1 - p, b.z0 + p + f * (len - 2 * p)], [b.x1 - p - f * (len - 2 * p), b.z1 - p], [b.x0 + p, b.z1 - p - f * (len - 2 * p)]][lado2];
      por(sortear('pessoa'), pos[0], pos[1], { ia });
    }

    if (b.tipo === 'casas') {
      // 3 casas em cima, 3 embaixo, 1 de cada lado; quintal no meio
      const casa = () => (r() < 0.22 ? sortear('casinha') : sortear('casa'));
      for (const dz of [-1, 1]) {
        for (const dx of [-1, 0, 1]) {
          const c = casa();
          const a = meioLado(c.s);
          por(c, cx + dx * 3.85 + jitter(0.06), dz < 0 ? iz0 + a + 0.25 : iz1 - a - 0.25);
        }
      }
      for (const dx of [-1, 1]) {
        const c = casa();
        const a = meioLado(c.s);
        por(c, dx < 0 ? ix0 + a + 0.25 : ix1 - a - 0.25, cz + jitter(0.1));
      }
      // quintal: arvore de um lado, piquenique, cafe ou jardim do outro
      const ld = r() < 0.5 ? -1 : 1;
      por(sortear('arvore'), cx + ld * 1.7 + jitter(0.3), cz + jitter(0.4));
      cacho('praca', cx - ld * 1.4, cz + jitter(0.3), 0, 3, r() < 0.55 ? 'piquenique' : r() < 0.6 ? 'cafe' : 'jardim');
      if (r() < 0.5) grupo(cx + ld * 1.6, cz + (r() < 0.5 ? -1.5 : 1.5), 2);
    } else if (b.tipo === 'centro') {
      const v = r();
      if (v < 0.4) {
        // fileira de lojas em cima, dois predios embaixo, pracinha entre eles
        for (const dx of [-1, 0, 1]) {
          const c = sortear('loja');
          por(c, cx + dx * 3.85, iz0 + meioLado(c.s) + 0.25);
        }
        for (const dx of [-1, 1]) {
          const c = sortear('predio');
          por(c, cx + dx * 2.9, iz1 - meioLado(c.s) - 0.15);
        }
        // pracinha entre as lojas e os predios: feira ou cafe
        cacho('praca', cx + jitter(0.6), cz - 0.4, 0, 6, r() < 0.55 ? 'feira' : 'cafe');
        por(sortear('poste'), cx + 4.4, cz - 0.7);
      } else if (v < 0.75) {
        // quatro lotes: dois predios e duas lojas
        const ordem = r() < 0.5 ? ['predio', 'loja', 'loja', 'predio'] : ['loja', 'predio', 'predio', 'loja'];
        [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([dx, dz], k) => {
          const c = sortear(ordem[k]);
          por(c, cx + dx * (tam / 4), cz + dz * (tam / 4));
        });
        por(sortear('calcada'), cx + jitter(0.3), cz + jitter(0.3));
        if (r() < 0.5) grupo(cx, cz, 2);
      } else {
        // torre no meio e arvores nos cantos
        por(sortear('torre'), cx, cz);
        for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
          por(sortear('arvore'), cx + dx * (tam / 2 - 0.9), cz + dz * (tam / 2 - 0.9));
        }
        grupo(cx - tam / 2 + 1.0, cz, 2);
        grupo(cx + tam / 2 - 1.0, cz, 2);
        cacho('calcada', cx, cz - tam / 2 + 0.75, 0, 4.4);
        cacho('calcada', cx, cz + tam / 2 - 0.75, 0, 4.4);
      }
    } else if (b.tipo === 'parque') {
      // caminhos em cruz, chafariz no meio, roda de arvores, bancos, postes e gente
      regioes.push({ x0: ix0, z0: cz - 0.7, x1: ix1, z1: cz + 0.7, tipo: 'praca' });
      regioes.push({ x0: cx - 0.7, z0: iz0, x1: cx + 0.7, z1: iz1, tipo: 'praca' });
      regioes.push({ x0: cx - 1.9, z0: cz - 1.9, x1: cx + 1.9, z1: cz + 1.9, tipo: 'praca' });
      por(sortear('medio'), cx, cz);
      for (let k = 0; k < 8; k++) {
        const a = (k + 0.5) * (Math.PI / 4);
        por(sortear(k % 3 === 2 ? 'medio' : 'arvore'), cx + Math.cos(a) * 4.1, cz + Math.sin(a) * 4.1);
      }
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        por(sortear('pequeno'), cx + dx * 2.6 + dz * 1.05, cz + dz * 2.6 + dx * 1.05);
        por(sortear('poste'), cx + dx * 2.4 - dz * 1.0, cz + dz * 2.4 - dx * 1.0);
      }
      cacho('praca', cx + 2.5, cz + 2.5, 0, 3, 'piquenique');
      cacho('praca', cx - 2.5, cz - 2.5, 0, 3, r() < 0.5 ? 'cafe' : 'piquenique');
      grupo(cx + 2.5, cz - 2.5, 2);
      for (let k = 0; k < 4; k++) por(sortear('calcada'), cx + jitter(4.5), cz + jitter(4.5));
    } else if (b.tipo === 'estacionamento') {
      if (g.barco) {
        // marina: barcos em fileiras e um grande no meio
        for (const dz of [-1, 1]) for (let k = 0; k < 4; k++) por(sortear('barco'), ix0 + 1.5 + k * ((tam - 3) / 3), cz + dz * 3.0, { espelho: dz > 0 });
        por(sortear('grande'), cx, cz, { ang: 0 });
      } else {
        // duas fileiras de carros de frente para o meio e um grande deitado no corredor
        for (const dz of [-1, 1]) {
          for (let k = 0; k < 5; k++) {
            if (r() < 0.15) continue;
            por(sortear('carro'), ix0 + 1.3 + k * ((tam - 2.6) / 4), cz + dz * 3.2, { ang: dz < 0 ? Math.PI / 2 : -Math.PI / 2 });
          }
        }
        por(sortear('grande'), cx, cz, { ang: r() < 0.5 ? 0 : Math.PI });
      }
      for (let k = 0; k < 4; k++) por(sortear('calcada'), ix0 + 0.6 + r() * (tam - 1.2), cz + (r() < 0.5 ? -1 : 1) * (1.2 + r() * 0.4));
      cacho('praca', ix0 + 1.7, iz0 + 1.3, 0, 3, 'carrinhos');
      if (!g.barco) cacho('rua', cx, iz1 - 0.75, 0, 6, 'motos');
      grupo(ix1 - 1.3, iz0 + 0.9, 2);
    } else if (b.tipo === 'marco') {
      por(marcos.length ? marcos.shift() : sortear('torre'), cx, cz);
      for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        por(sortear('arvore'), cx + dx * (tam / 2 - 0.8), cz + dz * (tam / 2 - 0.8));
        por(sortear('poste'), cx + dx * (tam / 2 - 2.2), cz + dz * (tam / 2 - 0.45));
      }
      grupo(cx - 3.6, cz + 4.0, 3);
      grupo(cx + 3.4, cz + 4.2, 2);
      por(sortear('pequeno'), cx, iz1 - 0.6);
      cacho('praca', cx, cz - 4.4, 0, 6, 'feira');
    }
  }

  // ruas: carros estacionados junto ao meio-fio, dos dois lados, nas horizontais e nas verticais
  const longeDoCruzamento = (/** @type {number} */ v, /** @type {number} */ d) => !linhas.some((M) => Math.abs(v - M) < RUA / 2 + d);
  for (const L of linhas) {
    for (const eixo of ['h', 'v']) {
      for (let v = prim + RUA; v < ult - RUA; v += 3.4 + r() * 2.2) {
        if (!longeDoCruzamento(v, 1.6)) continue;
        if (r() > 0.4) continue;
        const lado2 = r() < 0.5 ? -1 : 1;
        // motos na vaga ou obra junto ao meio-fio no lugar de um carro
        if (r() < 0.3 && longeDoCruzamento(v, 3.4)) {
          if (eixo === 'h') cacho('rua', v, L + lado2 * (VAGA + 0.08), 0, 3.4);
          else cacho('rua', L + lado2 * (VAGA + 0.08), v, Math.PI / 2, 3.4);
          continue;
        }
        const c = sortear(r() < 0.1 ? 'grande' : 'carro');
        if (c.forma !== 'carro') continue;
        // estacionado na mao: de frente para o sentido da faixa daquele lado
        if (eixo === 'h') por(c, v, L + lado2 * VAGA, { ang: lado2 > 0 ? 0 : Math.PI });
        else por(c, L + lado2 * VAGA, v, { ang: lado2 > 0 ? -Math.PI / 2 : Math.PI / 2 });
      }
    }
  }

  // carros rodando: um ou dois por rua, longe dos cruzamentos e de outro carro na mesma faixa
  /** @type {{ eixo: string, L: number }[]} */
  const bloqueadas = o.roteiro ? [{ eixo: 'h', L: 0 }, { eixo: 'v', L: 18 }] : [];
  const rodando = g.carro.filter((p) => p.anda && p.forma === 'carro');
  const grandes = (g.grande || []).filter((p) => p.anda && p.forma === 'carro');
  const porRua = modo === 'classico' ? 2 : 1;
  for (const L of linhas) {
    for (const eixo of ['h', 'v']) {
      if (bloqueadas.some((q) => q.eixo === eixo && q.L === L) || !rodando.length) continue;
      for (let k = 0; k < porRua; k++) {
        const dir = r() < 0.5 ? 1 : -1;
        let pos = prim + r() * (ult - prim);
        for (let t = 0; t < 8 && !longeDoCruzamento(pos, 1.2); t++) pos = prim + r() * (ult - prim);
        if (!longeDoCruzamento(pos, 1.2)) continue;
        const peca = grandes.length && r() < 0.14 ? sortearPeca(grandes, r) : sortearPeca(rodando, r);
        const c = carroRodando(peca, eixo, L, dir, pos, r);
        por(c.peca, c.x, c.z, { ang: c.ang, ia: c.ia });
      }
    }
  }

  // borda: arvores e arbustos
  for (let v = -meio + 2; v < meio - 2; v += 3.2) {
    for (const [x, z, a] of [[v, -meio + 2.2, 0], [v, meio - 2.2, Math.PI], [-meio + 2.2, v, Math.PI / 2], [meio - 2.2, v, -Math.PI / 2]]) {
      const q = r();
      if (q < 0.2 && Math.abs(v) < meio - 6) cacho('praca', x, z, a, 3);
      else if (q < 0.7) por(sortear(r() < 0.65 ? 'arvore' : 'pequeno'), x + jitter(0.5), z + jitter(0.5));
    }
  }

  // spawns: cruzamentos, em ordem embaralhada (o primeiro e a origem quando ela e cruzamento)
  /** @type {{ x: number, z: number }[]} */
  const spawns = [];
  for (const a of linhas) for (const b of linhas) spawns.push({ x: a, z: b });
  for (let i = spawns.length - 1; i > 0; i--) {
    const k = Math.floor(r() * (i + 1));
    [spawns[i], spawns[k]] = [spawns[k], spawns[i]];
  }
  spawns.sort((p, q2) => (p.x === 0 && p.z === 0 ? -1 : q2.x === 0 && q2.z === 0 ? 1 : 0));

  const ehCarroRodando = (/** @type {any} */ ob) => ob.ia && ob.ia.tipo === 'carro';
  const limparPerto = (/** @type {number} */ x, /** @type {number} */ z, /** @type {number} */ raio) => {
    for (let i = objetos.length - 1; i >= 0; i--) {
      const ob = objetos[i];
      if (Math.hypot(ob.x - x, ob.z - z) < raio + ob.peca.s && !ehCarroRodando(ob)) objetos.splice(i, 1);
    }
  };
  // um montinho de pecas pequenas nas quatro esquinas de cada spawn (todo buraco comeca com o que comer)
  for (const sp of spawns) {
    limparPerto(sp.x, sp.z, 1.6);
    for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const x = sp.x + dx * (RUA / 2 + 0.55);
      const z = sp.z + dz * (RUA / 2 + 0.55);
      por(sortear('calcada'), x + dx * 0.15, z - dz * 0.35);
      por(sortear('pessoa'), x - dx * 0.35, z + dz * 0.15, { ia: iaParado(x, z, r) });
    }
  }

  // roteiro da primeira rodada: trilha em L a leste da origem ate a casinha (o "uau" dos ~12 s). A mao-guia
  // segue os pontos de `trilha`. As pessoas da trilha ficam calmas (acenam em vez de fugir).
  /** @type {{ x: number, z: number }[]} */
  const trilha = [];
  if (o.roteiro) {
    for (const [x, z, rr] of [[4, 0, 3.6], [11, 0, 3.6], [17, 0, 3], [18, 5, 3.6], [13.4, 9.5, 2.6]]) limparPerto(x, z, rr);
    for (let x = 1.3; x < 13.6; x += 0.7) {
      por(sortear('calcada'), x, -0.55 + jitter(0.1));
      if (x < 5) por(sortear('calcada'), x + 0.35, 0.55 + jitter(0.1));
      else por(sortear('pessoa'), x + 0.35, 0.55 + jitter(0.1), { ia: iaParado(x + 0.35, 2, r, true) });
    }
    for (const [x, z] of [[14.6, -0.6], [15.8, 0.6], [17.0, -0.4]]) por(sortear('pequeno'), x, z);
    const carros = g.carro.filter((p) => p.s <= 0.95 && p.forma === 'carro');
    for (const z of [2.6, 5.0, 7.4]) por(sortearPeca(carros.length ? carros : g.carro, r), 18 + (z === 5.0 ? 0.8 : -0.8), z, { ang: z === 5.0 ? -Math.PI / 2 : Math.PI / 2 });
    por(g.casinha[0], 13.4, 9.5);
    for (let k = 0; k < 4; k++) por(sortear('pessoa'), 16.2 + (k % 2) * 0.5, 9.0 + k * 0.5, { ia: iaParado(15.4, 9.75, r, true) });
    trilha.push({ x: 5, z: 0 }, { x: 12, z: 0 }, { x: 17.2, z: 0 }, { x: 18, z: 6 }, { x: 13.4, z: 9.5 });
  }

  return { tema: tema.id, lado, linhas, regioes, faixas, blocos, objetos, spawns, trilha, bloqueadas, pontos };
}
