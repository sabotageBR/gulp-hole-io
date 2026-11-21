// Vida da cidade (logica pura, ASCII, deterministica pelo rng da rodada):
//   pessoas: andam pela calcada em volta do quarteirao, atravessam a rua na faixa da esquina, conversam em
//            grupinhos e acenam; quando um buraco que as engole chega perto, levam um susto (gritam) e fogem
//            correndo. As da trilha da primeira rodada sao "calmas": acenam para o buraco em vez de fugir.
//   carros:  rodam pela mao direita, escolhem seguir ou virar em cada cruzamento (curva suave), param atras
//            de outro carro, de quem atravessa e antes de um buraco; parados por um buraco, buzinam; se o
//            buraco nao sai da frente, dao meia-volta.
// Eventos: { tipo: 'grito', obj, x, z, v, buraco } e { tipo: 'buzina', obj, x, z, grave }.
import { CABE } from './buraco.js';
import { FAIXA, RUA } from './mapa.js';

/** Velocidade de quem foge (os buracos andam 4,4 ou mais: da para alcancar). */
const CORRIDA = 2.35;
/** Duracao do susto (parado, bracos para cima) antes de correr. */
const SUSTO = 0.45;
/** Distancia alem da borda do buraco em que a pessoa se assusta. */
const MEDO = 2.4;
/** Volta a andar quando o buraco esta mais longe que isto (alem da borda). */
const ALIVIO = 6;
/** Chance de atravessar a rua ao chegar numa esquina. */
const ATRAVESSA = 0.3;

/**
 * Avanca pessoas e carros.
 * @param {any} R rodada @param {number} dt @param {any[]} ev
 */
export function passoVida(R, dt, ev) {
  for (const o of R.objetos) {
    const ia = o.ia;
    if (!ia || o.estado !== 0) continue;
    if (ia.tipo === 'pessoa') pessoa(R, o, ia, dt, ev);
    else carro(R, o, ia, dt, ev);
    const c = R.grade.chave(o.x, o.z);
    if (c !== o.cel) {
      R.grade.tirar(o.id, o.cel);
      o.cel = R.grade.por(o.id, o.x, o.z);
    }
  }
}

// ------------------------------------------------------------------ pessoas

/** O buraco que engole esta pessoa e esta mais perto (distancia ate a borda). @param {any} R @param {any} o */
function ameaca(R, o) {
  let b = null;
  let d = Infinity;
  for (const q of R.buracos) {
    if (!q.vivo || o.peca.s >= q.r * CABE) continue;
    const dd = Math.hypot(o.x - q.x, o.z - q.z) - q.r;
    if (dd < d) {
      d = dd;
      b = q;
    }
  }
  return { b, d };
}

/** Canto k do caminho da calcada do bloco. @param {any} R @param {any} ia */
function canto(R, ia) {
  const b = R.mapa.blocos[ia.blk];
  const p = ia.off;
  const k = ia.canto;
  return { x: k === 0 || k === 3 ? b.x0 + p : b.x1 - p, z: k === 0 || k === 1 ? b.z0 + p : b.z1 - p };
}

/** Travessias possiveis a partir do canto k do bloco blk: [bloco vizinho, canto de chegada]. */
function travessias(R, blk, k) {
  const bs = R.mapa.blocos;
  const n = Math.round(Math.sqrt(bs.length));
  const b = bs[blk];
  const op = [];
  const viz = (i, j, c) => {
    if (i >= 0 && j >= 0 && i < n && j < n) op.push([j * n + i, c]);
  };
  if (k === 0) { viz(b.i, b.j - 1, 3); viz(b.i - 1, b.j, 1); }
  else if (k === 1) { viz(b.i, b.j - 1, 2); viz(b.i + 1, b.j, 0); }
  else if (k === 2) { viz(b.i, b.j + 1, 1); viz(b.i + 1, b.j, 3); }
  else { viz(b.i, b.j + 1, 0); viz(b.i - 1, b.j, 2); }
  return op;
}

/** Depois do susto (ou de um grupinho que resolve passear): anda no quarteirao mais perto. */
function voltarAAndar(R, o, ia) {
  let melhor = 0;
  let dm = Infinity;
  R.mapa.blocos.forEach((b, i) => {
    const d = Math.hypot((b.x0 + b.x1) / 2 - o.x, (b.z0 + b.z1) / 2 - o.z);
    if (d < dm) {
      dm = d;
      melhor = i;
    }
  });
  ia.blk = melhor;
  ia.sentido = R.rng() < 0.5 ? 1 : -1;
  let km = 0;
  dm = Infinity;
  for (let k = 0; k < 4; k++) {
    ia.canto = k;
    const c = canto(R, ia);
    const d = Math.hypot(c.x - o.x, c.z - o.z);
    if (d < dm) {
      dm = d;
      km = k;
    }
  }
  ia.canto = km;
  ia.modo = 'anda';
}

function pessoa(R, o, ia, dt, ev) {
  ia.t -= dt;
  ia.pensa -= dt;
  if (ia.pensa <= 0) {
    ia.pensa = 0.16 + R.rng() * 0.08;
    const { b, d } = ameaca(R, o);
    ia.perigo = b ? b.id : -1;
    if (b && d < MEDO && ia.modo !== 'foge' && ia.modo !== 'susto') {
      if (ia.calmo) {
        if (ia.modo !== 'acena') {
          ia.volta = ia.modo === 'acena' ? 'parado' : ia.modo;
          ia.modo = 'acena';
          ia.t = 1.4;
        }
      } else {
        ia.modo = 'susto';
        ia.t = SUSTO;
        ia.fx = o.x - b.x;
        ia.fz = o.z - b.z;
        ev.push({ tipo: 'grito', obj: o.id, x: o.x, z: o.z, v: ia.voz, buraco: b.id });
      }
    } else if (ia.modo === 'foge' && (!b || d > ALIVIO)) voltarAAndar(R, o, ia);
  }
  let vx = 0;
  let vz = 0;
  const meio = R.lado / 2;
  if (ia.modo === 'susto') {
    if (ia.t <= 0) ia.modo = 'foge';
  } else if (ia.modo === 'foge') {
    const b = ia.perigo >= 0 ? R.buracos[ia.perigo] : null;
    let fx = ia.fx;
    let fz = ia.fz;
    if (b && b.vivo) {
      fx = o.x - b.x;
      fz = o.z - b.z;
    }
    let n = Math.hypot(fx, fz) || 1;
    fx /= n;
    fz /= n;
    // perto da borda do mapa, desvia para dentro
    if (Math.abs(o.x) > meio - 3) fx -= Math.sign(o.x) * 1.2;
    if (Math.abs(o.z) > meio - 3) fz -= Math.sign(o.z) * 1.2;
    n = Math.hypot(fx, fz) || 1;
    ia.fx = fx;
    ia.fz = fz;
    vx = (fx / n) * CORRIDA;
    vz = (fz / n) * CORRIDA;
  } else if (ia.modo === 'anda' || ia.modo === 'atravessa') {
    const c = canto(R, ia);
    const dx = c.x - o.x;
    const dz = c.z - o.z;
    const d = Math.hypot(dx, dz);
    const v = ia.modo === 'atravessa' ? ia.vel * 1.25 : ia.vel;
    if (d < 0.06 + v * dt) {
      o.x = c.x;
      o.z = c.z;
      if (ia.modo === 'atravessa') {
        ia.modo = 'anda';
        ia.canto = (ia.canto + (ia.sentido > 0 ? 1 : 3)) % 4;
      } else {
        const op = R.rng() < ATRAVESSA ? travessias(R, ia.blk, ia.canto) : [];
        if (op.length) {
          const [blk, k] = op[Math.floor(R.rng() * op.length)];
          ia.blk = blk;
          ia.canto = k;
          ia.modo = 'atravessa';
        } else if (R.rng() < 0.08) {
          // para um pouco na esquina e acena
          ia.volta = 'anda';
          ia.modo = 'acena';
          ia.t = 1.2;
          ia.canto = (ia.canto + (ia.sentido > 0 ? 1 : 3)) % 4;
        } else ia.canto = (ia.canto + (ia.sentido > 0 ? 1 : 3)) % 4;
      }
    } else {
      vx = (dx / d) * v;
      vz = (dz / d) * v;
    }
  } else if (ia.modo === 'parado') {
    if (ia.t <= 0) {
      ia.t = 3 + R.rng() * 7;
      const s = R.rng();
      if (s < 0.4) {
        ia.volta = 'parado';
        ia.modo = 'acena';
        ia.t = 1.2;
      } else if (s < 0.5 && !ia.calmo) voltarAAndar(R, o, ia);
    }
  } else if (ia.modo === 'acena') {
    if (ia.t <= 0) {
      ia.modo = ia.volta || 'parado';
      ia.t = 3 + R.rng() * 6;
    }
  }
  o.vx = vx;
  o.vz = vz;
  if (vx || vz) {
    o.x = Math.max(-meio + 0.6, Math.min(meio - 0.6, o.x + vx * dt));
    o.z = Math.max(-meio + 0.6, Math.min(meio - 0.6, o.z + vz * dt));
    o.ang = Math.atan2(vz, vx);
  } else if (ia.modo === 'parado' || ia.modo === 'acena') {
    // de frente para o grupinho
    if (ia.gx !== o.x || ia.gz !== o.z) o.ang = Math.atan2(ia.gz - o.z, ia.gx - o.x);
  }
}

// ------------------------------------------------------------------ carros

/** Ponto da faixa (mao direita) na rua eixo/L, sentido dir, coordenada pos ao longo da rua. */
function naFaixa(eixo, L, dir, pos) {
  return eixo === 'h' ? { x: pos, z: L + FAIXA * dir } : { x: L - FAIXA * dir, z: pos };
}

/** Proxima linha de cruzamento a frente. @param {number[]} linhas @param {number} pos @param {number} dir */
function proximaLinha(linhas, pos, dir) {
  let melhor = null;
  let dm = Infinity;
  for (const M of linhas) {
    const d = (M - pos) * dir;
    if (d > 0.01 && d < dm) {
      dm = d;
      melhor = M;
    }
  }
  return melhor;
}

const bloqueada = (R, eixo, L) => R.mapa.bloqueadas.some((/** @type {any} */ q) => q.eixo === eixo && q.L === L);

/** Escolhe seguir, virar ou (sem saida) voltar, e monta a curva do cruzamento C. */
function cruzamento(R, o, ia, C) {
  const lin = R.mapa.linhas;
  const prim = lin[0];
  const ult = lin[lin.length - 1];
  const op = [];
  const segue = ia.dir > 0 ? C < ult : C > prim;
  if (segue && !bloqueada(R, ia.eixo, ia.L)) op.push({ eixo: ia.eixo, L: ia.L, dir: ia.dir, peso: 2.6 });
  const outro = ia.eixo === 'h' ? 'v' : 'h';
  for (const d2 of [-1, 1]) {
    const pode = d2 > 0 ? ia.L < ult : ia.L > prim;
    if (pode && !bloqueada(R, outro, C)) op.push({ eixo: outro, L: C, dir: d2, peso: 1.2 });
  }
  let esc = null;
  if (op.length) {
    let tot = 0;
    for (const q of op) tot += q.peso;
    let x = R.rng() * tot;
    for (const q of op) {
      x -= q.peso;
      if (x <= 0) {
        esc = q;
        break;
      }
    }
    esc = esc || op[op.length - 1];
  }
  const p0 = { x: o.x, z: o.z };
  if (!esc) {
    meiaVolta(o, ia);
    return;
  }
  let p1;
  let p2;
  if (esc.eixo === ia.eixo) {
    p2 = naFaixa(ia.eixo, ia.L, ia.dir, C + (RUA / 2) * ia.dir);
    p1 = { x: (p0.x + p2.x) / 2, z: (p0.z + p2.z) / 2 };
  } else {
    p2 = naFaixa(esc.eixo, C, esc.dir, ia.L + (RUA / 2) * esc.dir);
    p1 = ia.eixo === 'h' ? { x: C - FAIXA * esc.dir, z: ia.L + FAIXA * ia.dir } : { x: ia.L - FAIXA * ia.dir, z: C + FAIXA * esc.dir };
  }
  ia.curva = { p0, p1, p2, t: 0, eixo: esc.eixo, L: esc.L, dir: esc.dir };
}

/** Meia-volta para a outra faixa da mesma rua (sem saida ou buraco que nao sai da frente). */
function meiaVolta(o, ia) {
  const p0 = { x: o.x, z: o.z };
  const p2 = naFaixa(ia.eixo, ia.L, -ia.dir, ia.pos);
  const frente = naFaixa(ia.eixo, ia.L, 0, ia.pos + ia.dir * 1.3);
  ia.curva = { p0, p1: frente, p2, t: 0, eixo: ia.eixo, L: ia.L, dir: -ia.dir };
  ia.espera = 0;
}

function carro(R, o, ia, dt, ev) {
  ia.pensa -= dt;
  if (ia.ignora > 0) ia.ignora -= dt;
  if (ia.pensa <= 0) {
    ia.pensa = 0.12;
    const hx = Math.cos(o.ang);
    const hz = Math.sin(o.ang);
    let bloq = 0;
    for (const b of R.buracos) {
      if (!b.vivo) continue;
      const rx = b.x - o.x;
      const rz = b.z - o.z;
      const ah = rx * hx + rz * hz;
      const lat = Math.abs(rx * hz - rz * hx);
      if (ah > -0.2 && ah < b.r + o.peca.s + 2.4 && lat < b.r + 0.85) {
        bloq = 2;
        break;
      }
    }
    if (!bloq && !(ia.ignora > 0)) {
      R.grade.perto(o.x + hx * 1.8, o.z + hz * 1.8, 2.4 + (R.gigante && R.gigante.id >= 0 ? 4 : 0), (id) => {
        if (bloq || id === o.id) return;
        const q = R.objetos[id];
        // o que anda (carro, pessoa) e o gigante que caiu no meio da rua
        const gig = !q.ia && q.peca.s > 2.5;
        if (q.estado !== 0 || (!q.ia && !gig)) return;
        const rx = q.x - o.x;
        const rz = q.z - o.z;
        const ah = rx * hx + rz * hz;
        const lat = Math.abs(rx * hz - rz * hx);
        const pes = !gig && q.ia.tipo === 'pessoa';
        const lim = o.peca.s * 1.1 + (pes ? 0.7 : q.peca.s * 1.1 + 0.35);
        if (ah > 0.15 && ah < lim && lat < (pes ? 0.85 : gig ? q.peca.s * 0.8 : 0.62)) bloq = gig ? 2 : 1;
      });
    }
    ia.bloq = bloq;
  }
  const alvo = ia.bloq ? 0 : ia.cruz;
  const dv = alvo - ia.vel;
  ia.vel += Math.max(-9 * dt, Math.min(2.6 * dt, dv));
  if (ia.bloq && ia.vel < 0.25) {
    ia.espera += dt;
    if (ia.espera > (ia.bloq === 2 ? 0.25 : 2.2) && R.t - ia.buzina > 3.2) {
      ia.buzina = R.t;
      ev.push({ tipo: 'buzina', obj: o.id, x: o.x, z: o.z, grave: o.peca.s > 1.3 });
    }
    // fila travada (dois carros se olhando no cruzamento): um passa
    if (ia.bloq === 1 && ia.espera > 3) {
      ia.ignora = 1.4;
      ia.espera = 0;
    }
    // buraco plantado na frente: meia-volta
    if (ia.bloq === 2 && ia.espera > 4.5 && !ia.curva) {
      meiaVolta(o, ia);
      ia.bloq = 0;
    }
  } else if (!ia.bloq) ia.espera = 0;

  if (ia.curva) {
    const c = ia.curva;
    const dx = 2 * (1 - c.t) * (c.p1.x - c.p0.x) + 2 * c.t * (c.p2.x - c.p1.x);
    const dz = 2 * (1 - c.t) * (c.p1.z - c.p0.z) + 2 * c.t * (c.p2.z - c.p1.z);
    const dl = Math.hypot(dx, dz) || 1;
    c.t = Math.min(1, c.t + (ia.vel * dt) / dl);
    const u = 1 - c.t;
    o.x = u * u * c.p0.x + 2 * u * c.t * c.p1.x + c.t * c.t * c.p2.x;
    o.z = u * u * c.p0.z + 2 * u * c.t * c.p1.z + c.t * c.t * c.p2.z;
    const ex = 2 * u * (c.p1.x - c.p0.x) + 2 * c.t * (c.p2.x - c.p1.x);
    const ez = 2 * u * (c.p1.z - c.p0.z) + 2 * c.t * (c.p2.z - c.p1.z);
    if (ex || ez) o.ang = Math.atan2(ez, ex);
    if (c.t >= 1) {
      ia.eixo = c.eixo;
      ia.L = c.L;
      ia.dir = c.dir;
      ia.pos = c.eixo === 'h' ? o.x : o.z;
      ia.curva = null;
      o.ang = c.eixo === 'h' ? (c.dir > 0 ? 0 : Math.PI) : (c.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
    }
    return;
  }
  ia.pos += ia.dir * ia.vel * dt;
  const p = naFaixa(ia.eixo, ia.L, ia.dir, ia.pos);
  o.x = p.x;
  o.z = p.z;
  const C = proximaLinha(R.mapa.linhas, ia.pos, ia.dir);
  if (C !== null && (C - ia.pos) * ia.dir <= RUA / 2) cruzamento(R, o, ia, C);
}
