// Carros 3D feitos no codigo (v0.2.0) e aderecos parados (v0.3.0: moto, placa, barraca, caixote, presente,
// carrinho de compras, mesa com guarda-sol): cada modelo e uma geometria so (caixas arredondadas, cilindros, cones),
// com a cor de cada vertice e um "tinge" (0 cor fixa, 1 cor do carro, 2 segunda cor). Assim o carro aparece
// de qualquer angulo, vira nas esquinas e tomba no buraco de verdade. Frente em +x, chao em y = 0.
import * as THREE from 'three';

const VIDRO = '#7cc8f0';
const PNEU = '#2b2433';
const CALOTA = '#dcd8e4';
const FAROL = '#fff3c4';
const LANTERNA = '#ff4a4a';
const PARACHOQUE = '#e9e5ee';
const ESCURO = '#3a3148';
const BRANCO = '#fffaf0';

/** Caixa de cantos arredondados (normais suaves nos cantos), centrada na origem. */
function caixaRedonda(w, h, d, r, seg = 1) {
  r = Math.min(r, w / 2 - 1e-3, h / 2 - 1e-3, d / 2 - 1e-3);
  const g = new THREE.BoxGeometry(w, h, d, seg * 2, seg * 2, seg * 2);
  // seg 1: so os 8 cantos arredondados (48 triangulos); seg 2: arredondado de verdade (192)
  const p = g.attributes.position;
  const n = g.attributes.normal;
  const hw = w / 2 - r;
  const hh = h / 2 - r;
  const hd = d / 2 - r;
  const v = new THREE.Vector3();
  const c = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    c.set(Math.max(-hw, Math.min(hw, v.x)), Math.max(-hh, Math.min(hh, v.y)), Math.max(-hd, Math.min(hd, v.z)));
    v.sub(c);
    if (v.lengthSq() > 1e-9) {
      v.normalize();
      n.setXYZ(i, v.x, v.y, v.z);
      v.multiplyScalar(r).add(c);
      p.setXYZ(i, v.x, v.y, v.z);
    }
  }
  return g;
}

/** Caixa simples (12 triangulos) para pecinhas: farol, lanterna, para-choque. */
const caixa = (w, h, d) => new THREE.BoxGeometry(w, h, d);

/** Cilindro deitado (eixo z: roda) ou de pe. */
function cilindro(raio, alt, seg = 12, deitado = true) {
  const g = new THREE.CylinderGeometry(raio, raio, alt, seg);
  if (deitado) g.rotateX(Math.PI / 2);
  return g;
}

/** Junta as partes numa geometria so: { geo, cor, tinge, x, y, z }. */
function juntar(partes) {
  const pos = [];
  const nor = [];
  const cor = [];
  const tin = [];
  const c = new THREE.Color();
  for (const pt of partes) {
    const g = pt.geo.index ? pt.geo.toNonIndexed() : pt.geo;
    g.translate(pt.x || 0, pt.y || 0, pt.z || 0);
    c.set(pt.cor);
    const p = g.attributes.position;
    const n = g.attributes.normal;
    for (let i = 0; i < p.count; i++) {
      pos.push(p.getX(i), p.getY(i), p.getZ(i));
      nor.push(n.getX(i), n.getY(i), n.getZ(i));
      cor.push(c.r, c.g, c.b);
      tin.push(pt.tinge || 0);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('aCorV', new THREE.Float32BufferAttribute(cor, 3));
  g.setAttribute('aTinge', new THREE.Float32BufferAttribute(tin, 1));
  g.computeBoundingSphere();
  return g;
}

const P = (geo, cor, tinge = 0, x = 0, y = 0, z = 0) => ({ geo, cor, tinge, x, y, z });

/** Quatro rodas (ou mais) nas posicoes x, com calota. */
function rodas(xs, meiaLarg, raio = 0.17) {
  const out = [];
  for (const x of xs) {
    for (const s of [-1, 1]) {
      out.push(P(cilindro(raio, 0.15, 8), PNEU, 0, x, raio, s * meiaLarg));
      out.push(P(cilindro(raio * 0.5, 0.16, 6), CALOTA, 0, x, raio, s * meiaLarg));
    }
  }
  return out;
}

/** Farois na frente e lanternas atras. */
function luzes(meioComp, y, meiaLarg) {
  const out = [];
  for (const s of [-1, 1]) {
    out.push(P(caixa(0.06, 0.09, 0.16), FAROL, 0, meioComp, y, s * meiaLarg));
    out.push(P(caixa(0.06, 0.08, 0.14), LANTERNA, 0, -meioComp, y, s * meiaLarg));
  }
  return out;
}

function parachoques(meioComp, larg) {
  return [P(caixa(0.1, 0.1, larg), PARACHOQUE, 0, meioComp, 0.2, 0), P(caixa(0.1, 0.1, larg), PARACHOQUE, 0, -meioComp, 0.2, 0)];
}

/** Carro de passeio: comprimento L, largura W, cabine de comprimento c deslocada dx. */
function passeio(L, W, c, dx, { teto = 1, altCorpo = 0.36 } = {}) {
  const yb = 0.14 + altCorpo / 2;
  const topo = 0.14 + altCorpo;
  return [
    P(caixaRedonda(L, altCorpo, W, 0.12, 2), '#ffffff', 1, 0, yb, 0),
    P(caixaRedonda(c, 0.3, W - 0.1, 0.1), VIDRO, 0, dx, topo + 0.13, 0),
    P(caixaRedonda(c - 0.04, 0.07, W - 0.06, 0.035), '#ffffff', teto, dx, topo + 0.3, 0),
    ...luzes(L / 2 - 0.01, yb + 0.03, W / 2 - 0.16),
    ...parachoques(L / 2, W - 0.06),
    ...rodas([L * 0.32, -L * 0.32], W / 2 - 0.05),
  ];
}

/** Modelos: geometria e como pintar (cor2: 'branco' | 'igual' | cor fixa). */
const MODELOS = {
  hatch: { partes: () => passeio(1.55, 0.86, 0.85, -0.15), cor2: 'igual' },
  sedan: { partes: () => passeio(1.85, 0.88, 0.85, -0.1), cor2: 'igual' },
  taxi: {
    partes: () => [
      ...passeio(1.85, 0.88, 0.85, -0.1),
      P(caixaRedonda(0.34, 0.12, 0.2, 0.04), BRANCO, 0, -0.1, 0.92, 0),
      P(caixaRedonda(1.5, 0.07, 0.9, 0.03), ESCURO, 0, 0, 0.36, 0),
    ],
    cor1: '#ffd23f', cor2: 'igual',
  },
  mini: {
    partes: () => [
      P(caixaRedonda(1.15, 0.36, 0.8, 0.16, 2), '#ffffff', 1, 0, 0.32, 0),
      P(caixaRedonda(0.7, 0.34, 0.72, 0.16, 2), VIDRO, 0, -0.05, 0.62, 0),
      P(caixaRedonda(0.62, 0.06, 0.66, 0.03), '#ffffff', 2, -0.05, 0.8, 0),
      ...luzes(0.57, 0.36, 0.24),
      ...rodas([0.36, -0.36], 0.36, 0.15),
    ],
    cor2: 'branco',
  },
  perua: {
    partes: () => [
      P(caixaRedonda(1.85, 0.62, 0.92, 0.14, 2), '#ffffff', 1, 0, 0.45, 0),
      P(caixaRedonda(1.5, 0.22, 0.94, 0.06), VIDRO, 0, -0.08, 0.66, 0),
      P(caixaRedonda(1.7, 0.07, 0.88, 0.03), '#ffffff', 2, -0.05, 0.79, 0),
      ...luzes(0.92, 0.36, 0.3),
      ...parachoques(0.93, 0.86),
      ...rodas([0.6, -0.6], 0.42),
    ],
    cor2: 'branco',
  },
  picape: {
    partes: () => [
      P(caixaRedonda(1.9, 0.32, 0.9, 0.1), '#ffffff', 1, 0, 0.3, 0),
      P(caixaRedonda(0.62, 0.3, 0.82, 0.09), VIDRO, 0, 0.22, 0.6, 0),
      P(caixaRedonda(0.58, 0.07, 0.86, 0.03), '#ffffff', 1, 0.22, 0.77, 0),
      P(caixaRedonda(0.85, 0.06, 0.78, 0.02), ESCURO, 0, -0.5, 0.47, 0),
      P(caixaRedonda(0.85, 0.16, 0.06, 0.02), '#ffffff', 1, -0.5, 0.54, 0.42),
      P(caixaRedonda(0.85, 0.16, 0.06, 0.02), '#ffffff', 1, -0.5, 0.54, -0.42),
      P(caixaRedonda(0.06, 0.16, 0.9, 0.02), '#ffffff', 1, -0.92, 0.54, 0),
      ...luzes(0.95, 0.34, 0.3),
      ...parachoques(0.96, 0.86),
      ...rodas([0.6, -0.6], 0.42),
    ],
    cor2: 'igual',
  },
  onibus: {
    partes: () => [
      P(caixaRedonda(3.4, 0.86, 1.0, 0.14, 2), '#ffffff', 1, 0, 0.6, 0),
      P(caixaRedonda(3.0, 0.3, 1.02, 0.06), VIDRO, 0, -0.1, 0.8, 0),
      P(caixaRedonda(0.06, 0.36, 0.86, 0.03), VIDRO, 0, 1.7, 0.78, 0),
      P(caixaRedonda(3.2, 0.08, 0.96, 0.04), '#ffffff', 2, 0, 1.06, 0),
      P(caixaRedonda(0.5, 0.1, 0.5, 0.04), '#ffffff', 2, -0.8, 1.13, 0),
      ...luzes(1.7, 0.36, 0.34),
      ...parachoques(1.71, 0.96),
      ...rodas([1.1, -1.1], 0.46, 0.2),
    ],
    cor2: 'branco',
    alto: true,
  },
  caminhao: {
    partes: () => [
      P(caixaRedonda(0.8, 0.7, 0.95, 0.12), '#ffffff', 1, 1.05, 0.55, 0),
      P(caixaRedonda(0.06, 0.28, 0.82, 0.03), VIDRO, 0, 1.45, 0.72, 0),
      P(caixaRedonda(0.5, 0.24, 0.97, 0.05), VIDRO, 0, 1.12, 0.72, 0),
      P(caixaRedonda(2.1, 1.0, 1.0, 0.07), '#ffffff', 2, -0.42, 0.72, 0),
      P(caixaRedonda(2.9, 0.12, 0.8, 0.03), ESCURO, 0, 0.05, 0.22, 0),
      ...luzes(1.45, 0.36, 0.32),
      ...rodas([1.05, -0.2, -1.0], 0.44, 0.19),
    ],
    cor2: 'branco',
    alto: true,
  },
  bombeiros: {
    partes: () => {
      const out = [
        P(caixaRedonda(3.0, 0.62, 1.0, 0.12), '#ffffff', 1, 0, 0.5, 0),
        P(caixaRedonda(0.62, 0.32, 1.02, 0.06), VIDRO, 0, 1.05, 0.86, 0),
        P(caixaRedonda(0.66, 0.08, 0.96, 0.03), '#ffffff', 1, 1.05, 1.05, 0),
        P(caixaRedonda(0.14, 0.08, 0.3, 0.03), '#4fb3ff', 0, 1.05, 1.12, 0.12),
        P(caixaRedonda(0.14, 0.08, 0.3, 0.03), LANTERNA, 0, 1.05, 1.12, -0.12),
        P(caixaRedonda(2.3, 0.05, 0.05, 0.02), '#d9d6e2', 0, -0.35, 0.92, 0.26),
        P(caixaRedonda(2.3, 0.05, 0.05, 0.02), '#d9d6e2', 0, -0.35, 0.92, -0.26),
        P(caixaRedonda(2.4, 0.08, 0.9, 0.03), BRANCO, 0, -0.35, 0.84, 0),
        ...luzes(1.5, 0.36, 0.34),
        ...parachoques(1.51, 0.96),
        ...rodas([1.0, -0.4, -1.0], 0.46, 0.19),
      ];
      for (let k = 0; k < 9; k++) out.push(P(caixa(0.04, 0.04, 0.5), '#d9d6e2', 0, -1.4 + k * 0.26, 0.93, 0));
      return out;
    },
    cor1: '#e8483c', cor2: 'igual',
    alto: true,
  },
  buggy: {
    partes: () => [
      P(caixaRedonda(1.4, 0.3, 0.8, 0.13), '#ffffff', 1, 0, 0.38, 0),
      P(caixaRedonda(0.34, 0.2, 0.62, 0.06), ESCURO, 0, -0.18, 0.56, 0),
      P(caixaRedonda(0.08, 0.22, 0.7, 0.03), VIDRO, 0, 0.3, 0.64, 0),
      P(cilindro(0.035, 0.5, 8, false), ESCURO, 0, -0.42, 0.78, 0.3),
      P(cilindro(0.035, 0.5, 8, false), ESCURO, 0, -0.42, 0.78, -0.3),
      P(cilindro(0.035, 0.66, 8, true), ESCURO, 0, -0.42, 1.03, 0),
      ...luzes(0.69, 0.42, 0.24),
      ...rodas([0.48, -0.48], 0.42, 0.22),
    ],
    cor2: 'igual',
  },
  kombi: {
    partes: () => [
      P(caixaRedonda(1.75, 0.38, 0.9, 0.16, 2), '#ffffff', 1, 0, 0.35, 0),
      P(caixaRedonda(1.75, 0.42, 0.9, 0.18, 2), '#ffffff', 2, 0, 0.7, 0),
      P(caixaRedonda(1.5, 0.2, 0.92, 0.06), VIDRO, 0, -0.05, 0.72, 0),
      P(caixaRedonda(0.06, 0.2, 0.7, 0.03), VIDRO, 0, 0.88, 0.72, 0),
      P(cilindro(0.07, 0.04, 10, false).rotateZ(Math.PI / 2), FAROL, 0, 0.88, 0.42, 0.28),
      P(cilindro(0.07, 0.04, 10, false).rotateZ(Math.PI / 2), FAROL, 0, 0.88, 0.42, -0.28),
      ...parachoques(0.88, 0.84),
      ...rodas([0.56, -0.56], 0.41),
    ],
    cor2: 'branco',
  },
  jipe: {
    partes: () => [
      P(caixaRedonda(1.5, 0.4, 0.88, 0.08), '#ffffff', 1, 0, 0.4, 0),
      P(caixaRedonda(0.06, 0.26, 0.8, 0.02), VIDRO, 0, 0.25, 0.73, 0),
      P(caixaRedonda(0.5, 0.18, 0.7, 0.05), ESCURO, 0, -0.25, 0.66, 0),
      P(cilindro(0.03, 0.42, 8, false), ESCURO, 0, -0.55, 0.82, 0.34),
      P(cilindro(0.03, 0.42, 8, false), ESCURO, 0, -0.55, 0.82, -0.34),
      P(cilindro(0.03, 0.72, 8, true), ESCURO, 0, -0.55, 1.03, 0),
      P(cilindro(0.2, 0.12, 14, true).rotateY(Math.PI / 2), PNEU, 0, -0.8, 0.5, 0),
      ...luzes(0.75, 0.46, 0.28),
      ...rodas([0.48, -0.48], 0.44, 0.2),
    ],
    cor2: 'igual',
  },
  sorvete: {
    partes: () => [
      P(caixaRedonda(1.85, 0.66, 0.92, 0.16, 2), '#ffffff', 2, 0, 0.48, 0),
      P(caixaRedonda(1.85, 0.16, 0.94, 0.06), '#ffffff', 1, 0, 0.3, 0),
      P(caixaRedonda(0.5, 0.24, 0.94, 0.05), VIDRO, 0, 0.6, 0.68, 0),
      P(caixaRedonda(0.6, 0.26, 0.95, 0.04), ESCURO, 0, -0.25, 0.62, 0),
      P(new THREE.ConeGeometry(0.2, 0.42, 14).rotateX(Math.PI), '#e9b26a', 0, -0.2, 1.02, 0),
      P(new THREE.SphereGeometry(0.22, 14, 10), '#ffffff', 1, -0.2, 1.28, 0),
      ...luzes(0.93, 0.36, 0.3),
      ...rodas([0.6, -0.6], 0.42),
    ],
    cor2: 'branco',
  },
  doce: {
    partes: () => [
      P(caixaRedonda(1.3, 0.42, 0.84, 0.2, 2), '#ffffff', 1, 0, 0.36, 0),
      P(caixaRedonda(0.72, 0.36, 0.76, 0.18, 2), VIDRO, 0, -0.08, 0.68, 0),
      P(caixaRedonda(0.66, 0.1, 0.72, 0.05), '#ffffff', 2, -0.08, 0.88, 0),
      P(cilindro(0.02, 0.42, 6, false), BRANCO, 0, -0.3, 1.1, 0),
      P(new THREE.SphereGeometry(0.13, 12, 8), '#ffffff', 2, -0.3, 1.34, 0),
      ...luzes(0.64, 0.4, 0.26),
      ...rodas([0.42, -0.42], 0.38, 0.16),
    ],
    cor2: 'outra',
  },
  trem: {
    partes: () => [
      P(caixaRedonda(2.6, 0.2, 0.9, 0.06), ESCURO, 0, -0.1, 0.3, 0),
      P(cilindro(0.34, 1.4, 16, true).rotateY(Math.PI / 2), '#ffffff', 1, 0.45, 0.72, 0),
      P(caixaRedonda(0.8, 0.95, 0.92, 0.12), '#ffffff', 2, -0.75, 0.86, 0),
      P(caixaRedonda(0.5, 0.3, 0.94, 0.06), VIDRO, 0, -0.75, 1.05, 0),
      P(caixaRedonda(0.96, 0.1, 1.04, 0.05), '#ffffff', 1, -0.75, 1.38, 0),
      P(cilindro(0.12, 0.38, 12, false), ESCURO, 0, 0.85, 1.2, 0),
      P(cilindro(0.17, 0.08, 12, false), '#ffffff', 2, 0.85, 1.42, 0),
      P(cilindro(0.36, 0.06, 16, true).rotateY(Math.PI / 2), '#ffffff', 2, 1.16, 0.72, 0),
      ...luzes(1.2, 0.5, 0.2),
      ...rodas([0.8, 0.2, -0.6], 0.44, 0.2),
    ],
    cor2: 'outra',
    alto: true,
  },
};

// ------------------------------------------------------------------ aderecos parados (v0.3.0)
const MADEIRA = '#c98b52';
const MADEIRA_ESC = '#9a6236';
const METAL = '#c9d0dc';
const POSTE = '#8f889c';

/** Faixas alternadas (cor do tema e branco) ao longo de z: toldo da barraca. */
function listras(n, larg, comp, esp, x, y, incl = 0) {
  const out = [];
  const w = larg / n;
  for (let k = 0; k < n; k++) {
    const g = caixa(comp, esp, w + 0.002);
    if (incl) g.rotateZ(incl);
    out.push(P(g, k % 2 ? BRANCO : '#ffffff', k % 2 ? 0 : 1, x, y, -larg / 2 + (k + 0.5) * w));
  }
  return out;
}

/** Guarda-sol de gomos alternados. */
function guardaSol(raio, alt, y, gomos = 8) {
  const out = [];
  for (let k = 0; k < gomos; k++) {
    const g = new THREE.ConeGeometry(raio, alt, 1, 1, true, (k / gomos) * Math.PI * 2, (Math.PI * 2) / gomos);
    out.push(P(g, k % 2 ? BRANCO : '#ffffff', k % 2 ? 0 : 1, 0, y, 0));
  }
  return out;
}

const ADERECOS = {
  // poucos triangulos: sao centenas no mapa (caixas simples, cilindros de 6 lados, nada de esfera)
  moto: {
    partes: () => [
      P(caixaRedonda(0.62, 0.22, 0.26, 0.09), '#ffffff', 1, -0.05, 0.36, 0),
      P(caixa(0.4, 0.05, 0.24), ESCURO, 0, 0.06, 0.24, 0),
      P(caixa(0.36, 0.08, 0.22), ESCURO, 0, -0.14, 0.51, 0),
      P(caixa(0.11, 0.42, 0.24), '#ffffff', 1, 0.3, 0.44, 0),
      P(caixa(0.05, 0.05, 0.48), ESCURO, 0, 0.31, 0.68, 0),
      P(caixa(0.04, 0.07, 0.1), FAROL, 0, 0.37, 0.57, 0),
      P(cilindro(0.13, 0.09, 6), PNEU, 0, 0.33, 0.13, 0),
      P(cilindro(0.13, 0.09, 6), PNEU, 0, -0.33, 0.13, 0),
    ],
    cor2: 'igual',
  },
  placa: {
    partes: () => [
      P(cilindro(0.035, 1.45, 5, false), POSTE, 0, 0, 0.72, 0),
      P(caixa(0.05, 0.5, 0.56), BRANCO, 0, 0, 1.25, 0),
      P(caixa(0.06, 0.42, 0.48), '#ffffff', 1, 0, 1.25, 0),
      P(caixa(0.07, 0.07, 0.3), BRANCO, 0, 0, 1.25, 0),
    ],
    cor2: 'igual',
  },
  barraca: {
    partes: () => [
      P(caixa(0.7, 0.55, 1.4), MADEIRA, 0, 0.05, 0.3, 0),
      P(caixa(0.78, 0.05, 1.48), '#e8b77d', 0, 0.05, 0.6, 0),
      P(caixa(0.2, 0.12, 0.32), '#ff6f61', 0, 0.22, 0.68, -0.46),
      P(caixa(0.2, 0.12, 0.32), '#ffd23f', 0, 0.22, 0.68, 0),
      P(caixa(0.2, 0.12, 0.32), '#5fd3a8', 0, 0.22, 0.68, 0.46),
      P(caixa(0.06, 0.2, 1.4), MADEIRA_ESC, 0, 0.42, 0.42, 0),
      ...[[-0.38, -0.7], [-0.38, 0.7], [0.4, -0.7], [0.4, 0.7]].map(([x, z]) => P(caixa(0.05, 1.36, 0.05), MADEIRA_ESC, 0, x, 0.68, z)),
      ...listras(5, 1.6, 1.04, 0.05, 0.02, 1.42, -0.2),
      ...listras(5, 1.6, 0.04, 0.17, 0.53, 1.27),
    ],
    cor2: 'igual',
  },
  caixote: {
    partes: () => [
      P(caixa(0.44, 0.3, 0.44), MADEIRA, 0, 0, 0.15, 0),
      P(caixa(0.46, 0.04, 0.46), MADEIRA_ESC, 0, 0, 0.09, 0),
      P(caixa(0.46, 0.04, 0.46), MADEIRA_ESC, 0, 0, 0.23, 0),
      P(caixa(0.36, 0.26, 0.36).rotateY(0.45), MADEIRA, 0, 0.03, 0.43, 0.02),
      P(caixa(0.16, 0.1, 0.16).rotateY(0.3), '#ffffff', 1, -0.04, 0.61, 0.05),
      P(caixa(0.14, 0.09, 0.14).rotateY(1.1), '#ffffff', 2, 0.09, 0.6, -0.05),
    ],
    cor2: 'outra',
  },
  presente: {
    partes: () => [
      P(caixa(0.46, 0.36, 0.46), '#ffffff', 1, 0, 0.18, 0),
      P(caixa(0.48, 0.37, 0.08), '#ffffff', 2, 0, 0.18, 0),
      P(caixa(0.08, 0.37, 0.48), '#ffffff', 2, 0, 0.18, 0),
      P(caixa(0.3, 0.22, 0.3).rotateY(0.5), '#ffffff', 2, 0.02, 0.47, 0.01),
      P(caixa(0.32, 0.23, 0.06).rotateY(0.5), '#ffffff', 1, 0.02, 0.47, 0.01),
      P(caixa(0.2, 0.08, 0.05).rotateZ(0.6), '#ffffff', 1, -0.05, 0.63, 0),
      P(caixa(0.2, 0.08, 0.05).rotateZ(-0.6), '#ffffff', 1, 0.09, 0.63, 0),
    ],
    cor2: 'outra',
  },
  carrinho: {
    partes: () => [
      P(caixa(0.52, 0.03, 0.38), METAL, 0, 0, 0.36, 0),
      P(caixa(0.52, 0.3, 0.025), METAL, 0, 0, 0.5, 0.18),
      P(caixa(0.52, 0.3, 0.025), METAL, 0, 0, 0.5, -0.18),
      P(caixa(0.025, 0.3, 0.38), METAL, 0, 0.26, 0.5, 0),
      P(caixa(0.025, 0.34, 0.38), METAL, 0, -0.26, 0.52, 0),
      P(caixa(0.05, 0.05, 0.44), '#ffffff', 1, -0.33, 0.72, 0),
      P(caixa(0.18, 0.2, 0.16), '#ffffff', 2, 0.08, 0.5, 0.06),
      P(caixa(0.14, 0.24, 0.12), '#ffd23f', 0, -0.1, 0.52, -0.06),
      ...[[0.22, 0.16], [0.22, -0.16], [-0.22, 0.16], [-0.22, -0.16]].map(([x, z]) => P(caixa(0.03, 0.36, 0.03), METAL, 0, x, 0.18, z)),
      ...[[0.22, 0.16], [0.22, -0.16], [-0.22, 0.16], [-0.22, -0.16]].map(([x, z]) => P(caixa(0.09, 0.09, 0.04), PNEU, 0, x, 0.045, z)),
    ],
    cor2: 'outra',
  },
  'mesa-sol': {
    partes: () => [
      P(cilindro(0.03, 0.5, 5, false), POSTE, 0, 0, 0.26, 0),
      P(cilindro(0.33, 0.04, 10, false), BRANCO, 0, 0, 0.52, 0),
      ...[-1, 1].flatMap((sx) => [
        P(caixa(0.24, 0.05, 0.24), '#ffffff', 2, sx * 0.48, 0.3, 0),
        P(caixa(0.04, 0.28, 0.24), '#ffffff', 2, sx * 0.6, 0.46, 0),
        P(caixa(0.04, 0.28, 0.04), POSTE, 0, sx * 0.48, 0.14, 0),
      ]),
      P(cilindro(0.018, 1.25, 4, false), POSTE, 0, 0, 1.0, 0),
      ...guardaSol(0.68, 0.3, 1.52),
    ],
    cor2: 'outra',
  },
};
Object.assign(MODELOS, ADERECOS);

/** @type {Map<string, THREE.BufferGeometry>} */
const cache = new Map();
/** Geometria (uma vez) de um modelo. @param {string} modelo */
export function geometriaCarro(modelo) {
  let g = cache.get(modelo);
  if (!g) {
    g = juntar((MODELOS[modelo] || MODELOS.hatch).partes());
    cache.set(modelo, g);
  }
  return g;
}

/** Cores (lineares) de um carro: a da paleta do tema pela id, ou a fixa do modelo. */
export function coresCarro(modelo, paleta, id) {
  const m = MODELOS[modelo] || MODELOS.hatch;
  const c1 = new THREE.Color(m.cor1 || paleta[(id * 7 + 3) % paleta.length]);
  let c2;
  if (m.cor2 === 'branco') c2 = new THREE.Color(BRANCO);
  else if (m.cor2 === 'outra') c2 = new THREE.Color(paleta[(id * 7 + 6) % paleta.length]);
  else c2 = c1.clone();
  return [c1, c2];
}

/** O modelo e alto (onibus, caminhao): entra no raio X. @param {string} modelo */
export const carroAlto = (modelo) => !!(MODELOS[modelo] && MODELOS[modelo].alto);

/** Comprimento e largura do modelo (sombra no chao). @param {string} modelo */
export function medidasCarro(modelo) {
  const g = geometriaCarro(modelo);
  if (!g.boundingBox) g.computeBoundingBox();
  const b = /** @type {THREE.Box3} */ (g.boundingBox);
  return { comp: b.max.x - b.min.x, larg: b.max.z - b.min.z, alt: b.max.y };
}
