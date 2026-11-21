// Cena 3D da rodada (three.js r187). Le o estado da rodada (src/jogo/rodada.js) a cada quadro.
// - chao em camadas com textura desenhada no codigo (texturas.js), variacao de tom em escala grande (nada de
//   azulejo repetido a vista), meio-fio com altura, faixas e zebras; tudo some dentro dos buracos (shader);
// - pecas em billboard num InstancedMesh com atlas (com contorno); pessoas animadas pelos quadros (andar,
//   correr, susto, aceno, queda), viradas para onde andam;
// - carros 3D (carros.js), um InstancedMesh por modelo, girando pela direcao do carro;
// - predios em caixas instanciadas com fachada, contorno nas arestas, sombra de contato na base, telhado
//   desenhado no codigo tingido por casa, chamine, ar-condicionado e caixa d'agua; sombra projetada no chao;
// - buraco: borda grossa de skin que respira e incha ao engolir, labio interno, tubo escuro com profundidade,
//   sombra de contato em volta, raio que cresce com mola; pecas tombam na borda antes de cair;
// - particulas: poeira, pedrinhas que caem na boca (tambem quando o buraco anda), balao de susto, buzina;
// - tremor curto de camera ao engolir coisa grande.
import * as THREE from 'three';
import { meioLado } from '../jogo/mapa.js';
import { TEMAS, QUADROS_PESSOA, materialDe } from '../jogo/catalogo.js';
import { CABE } from '../jogo/buraco.js';
import { REABASTECE } from '../jogo/rodada.js';
import { texturaSkin } from './recursos.js';
import { texturaChao, ESCALA_CHAO, texturaTelhados, TELHADOS, texturaParticulas, texturaRachaduras, PART } from './texturas.js';
import { geometriaCarro, coresCarro, carroAlto, medidasCarro } from './carros.js';

const MAX_BURACOS = 12;
/** Inclinacao da camera (abaixo do horizonte). */
const PITCH = (56 * Math.PI) / 180;
/** Altura de cada camada do chao (sem briga de profundidade). */
const CAMADA = { borda: 0, rua: 0.004, calcada: 0.008, miolo: 0.012, praca: 0.016 };
/** Altura de uma pessoa (unidades). */
const ALTURA_PESSOA = 0.8;
/** Sombra projetada dos predios: deslocamento no chao por unidade de altura (sol da esquerda, de frente). */
const SOMBRA_X = 0.42;
const SOMBRA_Z = -0.3;
/** Particulas no maximo. */
const MAX_PART = 720;
/** Pedacos de predio (andares, telhado, entulho) caindo ao mesmo tempo, no maximo (v0.3.0). */
const POOL_PEDACOS = 90;
const POOL_TELHADOS = 12;

const COR_TEMA = {
  cidade: { ceu: '#bfe6ff', meiofio: '#f7eedd', linha: '#ff8f6b', zebra: '#fff8ea', poeira: '#efe3cf', pedra: ['#8c8494', '#a39aa4', '#6f6878'], lasca: ['#7d7584', '#8f8796', '#6c6474'], onda: 0xfff4dc },
  praia: { ceu: '#a8ecff', meiofio: '#f6e7c4', linha: '#fff8ea', zebra: '#fff8ea', poeira: '#f6e2b0', pedra: ['#d9b77a', '#c9a35e', '#e8cc94'], lasca: ['#b98a52', '#c99a5e', '#a87a46'], onda: 0xfffbe8 },
  doceria: { ceu: '#ffd9ec', meiofio: '#fff3f8', linha: '#fffaf2', zebra: '#fffaf2', poeira: '#ffe3ee', pedra: ['#ff8fc8', '#8ff0d0', '#fff07a', '#c9a6ff', '#7a4529'], lasca: ['#7a4529', '#8c5533', '#663a22'], onda: 0xfff0f8 },
};

/** Raio X: o que fica na frente do buraco do jogador vira pontilhado (sem esconder a boca). */
const uniFuro = { uFuro: { value: new THREE.Vector3(0, 0, -1) }, uFuroZ: { value: 0 } };
const GLSL_FURO = /* glsl */ `
uniform vec3 uFuro;
uniform float uFuroZ;
varying float vViewZ;
void raioX(float alto) {
  if (alto < 0.5 || uFuro.z <= 0.0) return;
  if (distance(gl_FragCoord.xy, uFuro.xy) < uFuro.z && vViewZ > uFuroZ) {
    vec2 p = floor(gl_FragCoord.xy / 2.0);
    if (mod(p.x + p.y, 2.0) < 1.0) discard;
  }
}
`;

const GLSL_BURACOS = /* glsl */ `
uniform vec3 uBuracos[${MAX_BURACOS}];
varying vec3 vMundo;
bool dentroDeBuraco() {
  for (int i = 0; i < ${MAX_BURACOS}; i++) {
    vec3 b = uBuracos[i];
    if (b.z > 0.0 && distance(vMundo.xz, b.xy) < b.z) return true;
  }
  return false;
}
`;

/** Ruido de valor (variacao de tom do chao em escala grande: quebra a repeticao da textura). */
const GLSL_RUIDO = /* glsl */ `
float hashR(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float ruido(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hashR(i), hashR(i + vec2(1.0, 0.0)), f.x), mix(hashR(i + vec2(0.0, 1.0)), hashR(i + vec2(1.0, 1.0)), f.x), f.y);
}
`;

/**
 * Material do chao (Lambert) que some dentro dos buracos, com variacao de tom pelo mundo.
 * @param {THREE.Texture|null} mapa @param {{ value: THREE.Vector3[] }} uni @param {number|string} [cor] @param {number} [variar]
 */
function materialChao(mapa, uni, cor = 0xffffff, variar = 0.16) {
  const m = new THREE.MeshLambertMaterial({ map: mapa, color: cor });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uBuracos = uni;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vMundo;')
      .replace('#include <project_vertex>', `#include <project_vertex>
        #ifdef USE_INSTANCING
          vMundo = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
        #else
          vMundo = (modelMatrix * vec4(transformed, 1.0)).xyz;
        #endif`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\n${GLSL_BURACOS}\n${GLSL_RUIDO}`)
      .replace('void main() {', 'void main() {\n  if (dentroDeBuraco()) discard;')
      .replace('#include <map_fragment>', `#include <map_fragment>
        diffuseColor.rgb *= ${(1 - variar / 2).toFixed(3)} + ${variar.toFixed(3)} * (ruido(vMundo.xz * 0.06) * 0.65 + ruido(vMundo.xz * 0.21 + 7.3) * 0.35);`);
  };
  m.customProgramCacheKey = () => `chao-${variar}`;
  return m;
}

/** Cores da mureta da borda por tema: muro, pilar e o pilar alternado (v0.3.1). */
const MURETA = {
  cidade: { muro: '#79c26f', pilar: '#f1e4cc', pilar2: '#f1e4cc', topo: '#5fa55a' },
  praia: { muro: '#e0ad73', pilar: '#b98049', pilar2: '#b98049', topo: '#f3d5a6' },
  doceria: { muro: '#fff1f6', pilar: '#ff5d8f', pilar2: '#fffaf2', topo: '#ffb3cf' },
};

/**
 * Mureta baixa em volta do mapa (fora da area de jogo), com pilares a cada ~4: a borda vira um limite de
 * proposito, nao o mapa cortado. Uma geometria so com cor por vertice.
 * @param {number} lado @param {string} tema
 */
function geometriaMureta(lado, tema) {
  const c = MURETA[/** @type {'cidade'} */ (tema)] || MURETA.cidade;
  const L = lado / 2 + 0.45;
  /** @type {{ x: number, z: number, w: number, h: number, d: number, y: number, cor: string }[]} */
  const caixas = [];
  // muro e o friso de cima, nos 4 lados
  for (const [x, z, w, d] of [[0, -L, lado + 1.6, 0.42], [0, L, lado + 1.6, 0.42], [-L, 0, 0.42, lado + 1.6], [L, 0, 0.42, lado + 1.6]]) {
    caixas.push({ x, z, w, h: 0.42, d, y: 0.21, cor: c.muro });
    caixas.push({ x, z, w: w + (w > 1 ? 0 : 0.1), h: 0.08, d: d + (d > 1 ? 0 : 0.1), y: 0.46, cor: c.topo });
  }
  // pilares
  const n = Math.max(4, Math.round((lado + 0.9) / 4));
  for (let i = 0; i <= n; i++) {
    const v = -L + (2 * L * i) / n;
    const cor = i % 2 ? c.pilar2 : c.pilar;
    for (const [x, z] of [[v, -L], [v, L], [-L, v], [L, v]]) caixas.push({ x, z, w: 0.62, h: 0.72, d: 0.62, y: 0.36, cor });
  }
  const pos = [];
  const nor = [];
  const cor = [];
  const tmp = new THREE.Color();
  for (const k of caixas) {
    const g = new THREE.BoxGeometry(k.w, k.h, k.d).toNonIndexed();
    g.translate(k.x, k.y, k.z);
    const p = g.getAttribute('position');
    const q = g.getAttribute('normal');
    tmp.set(k.cor);
    for (let i = 0; i < p.count; i++) {
      pos.push(p.getX(i), p.getY(i), p.getZ(i));
      nor.push(q.getX(i), q.getY(i), q.getZ(i));
      // o lado de cima um pouco mais claro (contorno de brinquedo)
      const f = q.getY(i) > 0.5 ? 1.08 : 1;
      cor.push(tmp.r * f, tmp.g * f, tmp.b * f);
    }
    g.dispose();
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(cor, 3));
  return g;
}

/**
 * Retangulos do chao viram uma geometria so (UV em coordenadas do mundo).
 * @param {{ x0: number, z0: number, x1: number, z1: number }[]} rets @param {number} y @param {number} esc
 */
function geometriaRetangulos(rets, y, esc) {
  const pos = [];
  const uv = [];
  const nor = [];
  const idx = [];
  let k = 0;
  for (const r of rets) {
    pos.push(r.x0, y, r.z0, r.x1, y, r.z0, r.x1, y, r.z1, r.x0, y, r.z1);
    uv.push(r.x0 / esc, -r.z0 / esc, r.x1 / esc, -r.z0 / esc, r.x1 / esc, -r.z1 / esc, r.x0 / esc, -r.z1 / esc);
    nor.push(0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0);
    idx.push(k, k + 2, k + 1, k, k + 3, k + 2);
    k += 4;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setIndex(idx);
  return g;
}

/** Meio-fio: tiras baixas e arredondadas em volta de cada quarteirao (uma geometria so). */
function geometriaMeioFio(blocos) {
  const partes = [];
  const larg = 0.16;
  const alt = 0.07;
  for (const b of blocos) {
    const w = b.x1 - b.x0;
    const d = b.z1 - b.z0;
    for (const [cx, cz, sx, sz] of [
      [(b.x0 + b.x1) / 2, b.z0 + larg / 2, w, larg], [(b.x0 + b.x1) / 2, b.z1 - larg / 2, w, larg],
      [b.x0 + larg / 2, (b.z0 + b.z1) / 2, larg, d], [b.x1 - larg / 2, (b.z0 + b.z1) / 2, larg, d],
    ]) {
      const g = new THREE.BoxGeometry(sx, alt, sz);
      g.translate(cx, alt / 2, cz);
      partes.push(g.toNonIndexed());
    }
  }
  return juntarGeometrias(partes);
}

function juntarGeometrias(lista) {
  const pos = [];
  const nor = [];
  for (const g of lista) {
    pos.push(...g.attributes.position.array);
    nor.push(...g.attributes.normal.array);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  return g;
}

// ------------------------------------------------------------------ materiais instanciados
function materialSprites(mapa) {
  return new THREE.ShaderMaterial({
    // espelhado (escala x negativa) vira a face: desenha os dois lados
    side: THREE.DoubleSide,
    uniforms: { map: { value: mapa }, ...uniFuro },
    vertexShader: /* glsl */ `
      attribute vec4 aUv;
      attribute float aEsc;
      attribute float aAlto;
      attribute vec3 aTinta;
      varying vec2 vUv;
      varying float vEsc;
      varying float vAlto;
      varying vec3 vTinta;
      varying float vViewZ;
      void main() {
        vUv = aUv.xy + uv * aUv.zw;
        vEsc = aEsc;
        vAlto = aAlto;
        vTinta = aTinta;
        vec4 mv = viewMatrix * modelMatrix * instanceMatrix * vec4(position, 1.0);
        vViewZ = mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D map;
      varying vec2 vUv;
      varying float vEsc;
      varying float vAlto;
      varying vec3 vTinta;
      ${GLSL_FURO}
      void main() {
        raioX(vAlto);
        vec4 c = texture2D(map, vUv);
        if (c.a < 0.5) discard;
        gl_FragColor = vec4(c.rgb * vTinta * vEsc, 1.0);
        #include <colorspace_fragment>
      }`,
  });
}

function materialPredios(mapa, mapaTeto) {
  return new THREE.ShaderMaterial({
    uniforms: { map: { value: mapa }, mapTeto: { value: mapaTeto }, ...uniFuro },
    vertexShader: /* glsl */ `
      varying float vViewZ;
      attribute vec4 aFach;
      attribute vec4 aTeto;
      attribute vec3 aParede;
      attribute vec3 aCorTeto;
      attribute float aEsc;
      attribute float aParte;
      attribute float aRep;
      attribute float aModo;
      attribute float aRacha;
      varying float vRacha;
      varying float vSem;
      varying vec2 vLocal;
      varying vec2 vUv0;
      varying vec4 vRet;
      varying vec4 vTeto;
      varying float vLuz;
      varying float vParte;
      varying float vModo;
      varying vec3 vParede;
      varying vec3 vCorTeto;
      void main() {
        // rachadura (v0.3.0): parte inteira = semente do desenho, fracao = quanto rachou
        vSem = floor(aRacha);
        vRacha = fract(aRacha);
        vParte = aParte;
        vModo = aModo;
        vParede = aParede;
        vCorTeto = aCorTeto;
        vUv0 = uv;
        vLocal = aParte > 0.5 && aParte < 1.5 ? uv * aRep : uv;
        vRet = aFach;
        vTeto = aTeto;
        vec3 n = normalize(mat3(modelMatrix * instanceMatrix) * normal);
        vec3 L = normalize(vec3(-0.45, 0.85, 0.4));
        vLuz = (0.64 + 0.48 * max(dot(n, L), 0.0) + 0.08 * n.y) * aEsc;
        vec4 mv = viewMatrix * modelMatrix * instanceMatrix * vec4(position, 1.0);
        vViewZ = mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D map;
      uniform sampler2D mapTeto;
      varying vec2 vLocal;
      varying vec2 vUv0;
      varying vec4 vRet;
      varying vec4 vTeto;
      varying float vLuz;
      varying float vParte;
      varying float vModo;
      varying vec3 vParede;
      varying vec3 vCorTeto;
      varying float vRacha;
      varying float vSem;
      ${GLSL_FURO}
      ${GLSL_RUIDO}
      void main() {
        // modo: 0 predio, 1 caixinha solida, 2 andar solto (laje cortada em cima), 3 predio caindo (sem raio X)
        raioX(vModo > 1.5 ? 0.0 : 1.0);
        vec3 c;
        bool solido = vModo > 0.5 && vModo < 1.5;
        if (solido || vParte > 1.5) c = vParede;
        else if (vModo > 1.5 && vModo < 2.5 && vParte > 0.5) c = vParede * vec3(0.6, 0.57, 0.64);
        else if (vParte > 0.5) {
          vec2 u = fract(vLocal);
          c = textureGrad(mapTeto, vTeto.xy + u * vTeto.zw, dFdx(vLocal * vTeto.zw), dFdy(vLocal * vTeto.zw)).rgb * vCorTeto;
        } else c = textureGrad(map, vRet.xy + vLocal * vRet.zw, dFdx(vLocal * vRet.zw), dFdy(vLocal * vRet.zw)).rgb * vParede;
        // contorno nas arestas (largura fixa em pixels) e sombra de contato no pe da parede
        if (vParte < 1.5) {
          vec2 e = min(vUv0, 1.0 - vUv0);
          float borda = min(e.x, e.y);
          float w = fwidth(borda);
          c *= mix(0.5, 1.0, smoothstep(w * 0.6, w * 1.8, borda));
        }
        if (vParte < 0.5) c *= mix(0.7, 1.0, smoothstep(0.0, 0.14, vUv0.y));
        // rachaduras na parede: linhas tortas de um ruido, subindo do pe conforme racha
        if (vRacha > 0.004 && vParte < 0.5 && !solido) {
          vec2 p = vUv0 * vec2(3.5, 5.0) + vec2(vSem * 1.7, vSem * 0.9);
          float n = ruido(p) * 0.65 + ruido(p * 2.6 + 3.1) * 0.35;
          float w = 0.018 + 0.03 * vRacha;
          float rc = 1.0 - smoothstep(w * 0.35, w, abs(n - 0.5));
          rc *= 1.0 - smoothstep(vRacha * 1.3 - 0.2, vRacha * 1.3, vUv0.y);
          c = mix(c, vec3(0.12, 0.09, 0.17), rc * 0.92);
        }
        gl_FragColor = vec4(c * vLuz, 1.0);
        #include <colorspace_fragment>
      }`,
  });
}

function materialCarros(alto) {
  return new THREE.ShaderMaterial({
    uniforms: { uAlto: { value: alto ? 1 : 0 }, ...uniFuro },
    vertexShader: /* glsl */ `
      attribute vec3 aCorV;
      attribute float aTinge;
      attribute vec3 aCor1;
      attribute vec3 aCor2;
      attribute float aEsc;
      varying vec3 vCor;
      varying vec3 vN;
      varying vec3 vV;
      varying float vEsc;
      varying float vViewZ;
      void main() {
        vec3 c = aCorV;
        if (aTinge > 0.5 && aTinge < 1.5) c *= aCor1;
        else if (aTinge > 1.5) c *= aCor2;
        vCor = c;
        vEsc = aEsc;
        vN = normalize(mat3(modelMatrix * instanceMatrix) * normal);
        vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0);
        vV = normalize(cameraPosition - w.xyz);
        vec4 mv = viewMatrix * w;
        vViewZ = mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uAlto;
      varying vec3 vCor;
      varying vec3 vN;
      varying vec3 vV;
      varying float vEsc;
      ${GLSL_FURO}
      void main() {
        raioX(uAlto);
        vec3 n = normalize(vN);
        vec3 L = normalize(vec3(-0.45, 0.85, 0.4));
        float luz = 0.58 + 0.5 * max(dot(n, L), 0.0) + 0.1 * n.y;
        // borda escura onde a superficie vira de lado (contorno de brinquedo) e um brilho de plastico
        float borda = smoothstep(0.02, 0.38, dot(n, normalize(vV)));
        vec3 H = normalize(L + normalize(vV));
        float brilho = pow(max(dot(n, H), 0.0), 48.0) * 0.45;
        vec3 c = vCor * luz * mix(0.42, 1.0, borda) + brilho;
        gl_FragColor = vec4(c * vEsc, 1.0);
        #include <colorspace_fragment>
      }`,
  });
}

function materialParticulas(mapa) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { map: { value: mapa } },
    vertexShader: /* glsl */ `
      attribute float aCel;
      attribute vec4 aCor;
      varying vec2 vUv;
      varying vec4 vCor;
      void main() {
        vUv = vec2((aCel + uv.x) / 8.0, uv.y);
        vCor = aCor;
        gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D map;
      varying vec2 vUv;
      varying vec4 vCor;
      void main() {
        vec4 c = texture2D(map, vUv);
        float a = c.a * vCor.a;
        if (a < 0.02) discard;
        gl_FragColor = vec4(c.rgb * vCor.rgb, a);
        #include <colorspace_fragment>
      }`,
  });
}

/** Sombra projetada dos predios: casco da base com a base deslocada pelo sol (aTopo = 1). */
function materialSombraPredio(uni) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: { uBuracos: uni },
    vertexShader: /* glsl */ `
      attribute float aTopo;
      attribute float aAlt;
      varying vec3 vMundo;
      void main() {
        vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0);
        w.xz += vec2(${SOMBRA_X.toFixed(2)}, ${SOMBRA_Z.toFixed(2)}) * aAlt * aTopo;
        vMundo = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `
      ${GLSL_BURACOS}
      void main() {
        if (dentroDeBuraco()) discard;
        gl_FragColor = vec4(0.16, 0.12, 0.24, 0.2);
      }`,
  });
}

/** Caixa de base no chao (0..1 em y) com a parte de cada vertice: 0 parede, 1 teto. */
function geometriaCaixa() {
  const g = new THREE.BoxGeometry(1, 1, 1);
  g.translate(0, 0.5, 0);
  const n = g.attributes.normal;
  const parte = new Float32Array(n.count);
  for (let i = 0; i < n.count; i++) parte[i] = n.getY(i) > 0.5 ? 1 : 0;
  g.setAttribute('aParte', new THREE.BufferAttribute(parte, 1));
  return g;
}

/** Telhado de duas aguas (cumeeira ao longo de x), base 1x1 com beiral, altura 1. Empenas = parte 2. */
function geometriaTelhado() {
  const X = 0.56;
  const Z = 0.6;
  const pos = [];
  const uv = [];
  const parte = [];
  const quad = (a, b, c, d, p) => {
    pos.push(...a, ...b, ...c, ...a, ...c, ...d);
    uv.push(0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1);
    for (let i = 0; i < 6; i++) parte.push(p);
  };
  quad([-X, 0, Z], [X, 0, Z], [X, 1, 0], [-X, 1, 0], 1);
  quad([X, 0, -Z], [-X, 0, -Z], [-X, 1, 0], [X, 1, 0], 1);
  pos.push(X, 0, Z, X, 0, -Z, X, 1, 0, -X, 0, -Z, -X, 0, Z, -X, 1, 0);
  uv.push(0, 0, 1, 0, 0.5, 1, 0, 0, 1, 0, 0.5, 1);
  for (let i = 0; i < 6; i++) parte.push(2);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('aParte', new THREE.Float32BufferAttribute(parte, 1));
  g.computeVertexNormals();
  return g;
}

/** Casco da sombra de uma caixa 1x1 (base e base deslocada). */
function geometriaSombraPredio() {
  // A0 A1 B1 C1 C0 D0 (sombra indo para +x e -z), leque a partir de D0
  const v = [[-0.5, -0.5, 0], [-0.5, -0.5, 1], [0.5, -0.5, 1], [0.5, 0.5, 1], [0.5, 0.5, 0], [-0.5, 0.5, 0]];
  const pos = [];
  const topo = [];
  for (const [a, b, c] of [[5, 0, 1], [5, 1, 2], [5, 2, 3], [5, 3, 4]]) {
    for (const k of [a, b, c]) {
      pos.push(v[k][0], 0, v[k][1]);
      topo.push(v[k][2]);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aTopo', new THREE.Float32BufferAttribute(topo, 1));
  return g;
}

/** Mancha de sombra (gradiente radial desenhado no carregamento). */
function texturaSombra() {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const g = /** @type {CanvasRenderingContext2D} */ (c.getContext('2d'));
  const gr = g.createRadialGradient(32, 32, 4, 32, 32, 31);
  gr.addColorStop(0, 'rgba(40,30,60,0.5)');
  gr.addColorStop(0.55, 'rgba(40,30,60,0.28)');
  gr.addColorStop(1, 'rgba(40,30,60,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Anel de sombra de contato em volta do buraco (alfa por vertice: escuro na borda, some para fora). */
function geometriaAnelSombra() {
  const seg = 72;
  const pos = [];
  const cor = [];
  const idx = [];
  for (let i = 0; i <= seg; i++) {
    const a = (i / seg) * Math.PI * 2;
    for (const [rr, al] of [[1.0, 0.34], [1.55, 0]]) {
      pos.push(Math.cos(a) * rr, 0, Math.sin(a) * rr);
      cor.push(0.16, 0.12, 0.24, al);
    }
  }
  for (let i = 0; i < seg; i++) {
    const a = i * 2;
    idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(cor, 4));
  g.setIndex(idx);
  return g;
}

/** Variacao pequena e fixa por objeto (0..1). @param {number} id @param {number} k */
const sorte = (id, k = 0) => {
  const x = Math.sin(id * 12.9898 + k * 78.233) * 43758.5453;
  return x - Math.floor(x);
};

/**
 * @param {HTMLCanvasElement} tela
 * @param {{ filme?: boolean, leve?: boolean }} o
 */
export function criarCena(tela, o = {}) {
  const renderer = new THREE.WebGLRenderer({
    canvas: tela,
    antialias: !o.leve,
    preserveDrawingBuffer: !!o.filme,
    powerPreference: 'high-performance',
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const cena = new THREE.Scene();
  cena.background = new THREE.Color('#bfe6ff');
  const camera = new THREE.PerspectiveCamera(38, 1, 0.5, 700);
  cena.add(new THREE.HemisphereLight(0xffffff, 0xd9c7a8, 1.9));
  const sol = new THREE.DirectionalLight(0xfff1dc, 1.7);
  sol.position.set(-6, 10, 5);
  cena.add(sol);
  const ladoTex = o.leve ? 256 : 512;

  const uniBuracos = { value: Array.from({ length: MAX_BURACOS }, () => new THREE.Vector3(0, 0, -1)) };
  const raiz = new THREE.Group();
  cena.add(raiz);
  const geoSprite = new THREE.PlaneGeometry(1, 1);
  geoSprite.translate(0, 0.5, 0);
  const geoParticula = new THREE.PlaneGeometry(1, 1);
  const geoCaixa = geometriaCaixa();
  const geoTelhado = geometriaTelhado();
  const geoSombra = new THREE.PlaneGeometry(1, 1);
  geoSombra.rotateX(-Math.PI / 2);
  const matSombra = materialChao(texturaSombra(), uniBuracos, 0xffffff, 0);
  matSombra.transparent = true;
  matSombra.depthWrite = false;
  const geoSombraPredio = geometriaSombraPredio();
  const texTelhados = texturaTelhados();

  // buracos (borda, labio, tubo, fundo, sombra de contato): criados uma vez, reaproveitados
  const geoBorda = new THREE.TorusGeometry(1.1, 0.14, 12, 96);
  geoBorda.rotateX(Math.PI / 2);
  geoBorda.scale(1, 0.72, 1);
  const geoLabio = new THREE.CylinderGeometry(1, 1, 1, 64, 1, true);
  geoLabio.translate(0, -0.5, 0);
  const geoTubo = new THREE.CylinderGeometry(1, 1, 1, 48, 6, true);
  geoTubo.translate(0, -0.5, 0);
  {
    const cor = [];
    const p = geoTubo.attributes.position;
    const topo = new THREE.Color('#2a2140');
    const fundo = new THREE.Color('#040307');
    for (let i = 0; i < p.count; i++) {
      const k = -p.getY(i);
      const c = topo.clone().lerp(fundo, Math.min(1, Math.pow(k / 0.4, 0.8)));
      cor.push(c.r, c.g, c.b);
    }
    geoTubo.setAttribute('color', new THREE.Float32BufferAttribute(cor, 3));
  }
  const matTubo = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide });
  const geoFundo = new THREE.CircleGeometry(1, 40);
  geoFundo.rotateX(-Math.PI / 2);
  const matFundo = new THREE.MeshBasicMaterial({ color: 0x030205 });
  const geoAnel = geometriaAnelSombra();
  const matAnel = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false });
  // rachaduras no asfalto em volta da boca quando o buraco cresce (v0.3.0)
  const geoRacha = new THREE.RingGeometry(1, 1.7, 72, 1);
  geoRacha.rotateX(-Math.PI / 2);
  const texRacha = texturaRachaduras();

  /** Borda com skin que respira e incha ao engolir (deformacao no vertex shader). */
  function materialBorda() {
    const uni = { uT: { value: 0 }, uGole: { value: 0 } };
    const mat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uT = uni.uT;
      sh.uniforms.uGole = uni.uGole;
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uT;\nuniform float uGole;')
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          float angB = atan(transformed.z, transformed.x);
          float wob = 1.0 + 0.011 * sin(angB * 3.0 + uT * 2.1) + 0.008 * sin(angB * 5.0 - uT * 2.9)
            + uGole * 0.075 * (0.6 + 0.4 * sin(angB * 2.0 + uT * 13.0));
          transformed.xz *= wob;
          transformed.y *= 1.0 + uGole * 0.35;`);
    };
    mat.customProgramCacheKey = () => 'borda-buraco';
    return { mat, uni };
  }

  /** @type {any[]} */
  const buracos = [];
  for (let i = 0; i < MAX_BURACOS; i++) {
    const grupo = new THREE.Group();
    const { mat, uni } = materialBorda();
    const matLabio = new THREE.MeshLambertMaterial({ color: 0x8c80a8, side: THREE.BackSide });
    const borda = new THREE.Mesh(geoBorda, mat);
    const labio = new THREE.Mesh(geoLabio, matLabio);
    const tubo = new THREE.Mesh(geoTubo, matTubo);
    const fundo = new THREE.Mesh(geoFundo, matFundo);
    const anel = new THREE.Mesh(geoAnel, matAnel);
    anel.renderOrder = 2;
    const racha = new THREE.Mesh(geoRacha, new THREE.MeshBasicMaterial({ map: texRacha, transparent: true, depthWrite: false, opacity: 0 }));
    racha.renderOrder = 2;
    racha.visible = false;
    grupo.add(anel, racha, borda, labio, tubo, fundo);
    grupo.visible = false;
    cena.add(grupo);
    buracos.push({ grupo, borda, labio, tubo, fundo, anel, racha, skin: -1, mat, matLabio, uni, rv: 0, rvv: 0, vivoAnt: false, gole: 0, acc: 0, rachaT: -1 });
  }

  // pulsos de luz no chao (degrau de tamanho, buraco engolido)
  const geoPulso = new THREE.RingGeometry(0.9, 1, 48);
  geoPulso.rotateX(-Math.PI / 2);
  const pulsos = Array.from({ length: 6 }, () => {
    const m = new THREE.Mesh(geoPulso, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false }));
    m.position.y = 0.03;
    m.visible = false;
    cena.add(m);
    return { m, t: 1, dur: 0.6, r0: 1, r1: 2, x: 0, z: 0, dono: -1 };
  });

  // particulas
  const part = new THREE.InstancedMesh(geoParticula.clone(), materialParticulas(texturaParticulas()), MAX_PART);
  const aCelP = new THREE.InstancedBufferAttribute(new Float32Array(MAX_PART), 1);
  const aCorP = new THREE.InstancedBufferAttribute(new Float32Array(MAX_PART * 4), 4);
  part.geometry.setAttribute('aCel', aCelP);
  part.geometry.setAttribute('aCor', aCorP);
  part.frustumCulled = false;
  part.renderOrder = 5;
  cena.add(part);
  const P = Array.from({ length: MAX_PART }, () => ({ viva: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, t: 0, dur: 1, t0: 0.3, t1: 0.3, g: 0, a: 1, cel: 0, arrasto: 0 }));
  let proxP = 0;
  {
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < MAX_PART; i++) part.setMatrixAt(i, zero);
  }

  /** estado da cena montada */
  let M = /** @type {any} */ (null);
  const tmpM = new THREE.Matrix4();
  const tmpQ = new THREE.Quaternion();
  const tmpQ2 = new THREE.Quaternion();
  const tmpP = new THREE.Vector3();
  const tmpS = new THREE.Vector3();
  const tmpV = new THREE.Vector3();
  const eixoY = new THREE.Vector3(0, 1, 0);
  const eixoZ = new THREE.Vector3(0, 0, 1);
  const qBill = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -PITCH * 0.92);
  const camAlvo = new THREE.Vector3();
  let camDist = 16;
  /** afastamento extra da camera quando o buraco cresce (some devagar) */
  let camExtra = 0;
  /** buraco que a camera segue (o ultimo foco do atualizar) */
  let focoAtual = 0;
  let tremor = 0;
  let tempo = 0;
  const corTmp = new THREE.Color();

  /** Solta uma particula. */
  function soltar(cel, x, y, z, vx, vy, vz, dur, t0, t1, cor, a = 1, g = 0, arrasto = 0) {
    const i = proxP;
    const p = P[i];
    proxP = (proxP + 1) % MAX_PART;
    Object.assign(p, { viva: true, x, y, z, vx, vy, vz, t: 0, dur, t0, t1, g, a, cel, arrasto });
    corTmp.set(cor);
    aCelP.setX(i, cel);
    aCorP.setXYZW(i, corTmp.r, corTmp.g, corTmp.b, a);
    aCelP.needsUpdate = true;
    aCorP.needsUpdate = true;
  }

  /** Poeira e pedrinhas quando uma peca comeca a cair. */
  function poeiraDaQueda(ob, b) {
    if (!M) return;
    const s = ob.peca.s;
    const ct = COR_TEMA[M.R.tema] || COR_TEMA.cidade;
    // poeira levanta na borda (do lado da peca) e sai para fora da boca
    const rv = buracos[b.id] ? buracos[b.id].rv : b.r;
    const a0 = Math.atan2(ob.z - b.z, ob.x - b.x);
    const n = Math.min(10, 2 + Math.round(s * 3));
    for (let k = 0; k < n; k++) {
      const a = a0 + (sorte(ob.id, k) - 0.5) * (0.6 + s * 0.5);
      const rr = rv * 1.08 + sorte(ob.id, k + 9) * 0.25;
      const vf = 0.5 + s * 0.35;
      soltar(0, b.x + Math.cos(a) * rr, 0.1 + s * 0.08, b.z + Math.sin(a) * rr, Math.cos(a) * vf, 0.45 + s * 0.2, Math.sin(a) * vf, 0.65 + s * 0.2, 0.2 + s * 0.25, 0.55 + s * 0.6, ct.poeira, 0.7, 0, 2.4);
    }
    const np = Math.min(12, 2 + Math.round(s * 4));
    for (let k = 0; k < np; k++) {
      const dx = b.x - ob.x;
      const dz = b.z - ob.z;
      const d = Math.hypot(dx, dz) || 1;
      const a = sorte(ob.id, k + 30) * Math.PI * 2;
      const cor = ct.pedra[Math.floor(sorte(ob.id, k + 50) * ct.pedra.length)];
      soltar(1, ob.x + Math.cos(a) * s * 0.5, 0.15 + sorte(ob.id, k) * s * 0.4, ob.z + Math.sin(a) * s * 0.5, (dx / d) * 1.4 + Math.cos(a) * 0.4, 1.5 + sorte(ob.id, k + 70) * 1.5, (dz / d) * 1.4 + Math.sin(a) * 0.4, 1.6, 0.1 + sorte(ob.id, k + 90) * 0.1, 0.1, cor, 1, 16);
    }
  }

  /**
   * Monta a cena de uma rodada.
   * @param {any} R rodada
   * @param {any} rec recursos do tema (recursos.js)
   */
  function montar(R, rec) {
    // limpa a anterior
    while (raiz.children.length) {
      const c = /** @type {any} */ (raiz.children.pop());
      if (c.geometry && c.geometry !== geoSombra && !c.userData.geoFixa) c.geometry.dispose();
      if (c.material && c.material !== matSombra) c.material.dispose();
    }
    const mapa = R.mapa;
    const t = mapa.tema;
    const tema = TEMAS[t];
    const chaoTema = tema.chao;
    const ct = COR_TEMA[t] || COR_TEMA.cidade;
    cena.background = new THREE.Color(ct.ceu);
    // chao: uma malha por tipo de regiao
    /** @type {Record<string, any[]>} */
    const porTipo = {};
    for (const r of mapa.regioes) (porTipo[r.tipo] ||= []).push(r);
    for (const [tipo, rets] of Object.entries(porTipo)) {
      const nomeTex = chaoTema[tipo];
      const esc = ESCALA_CHAO[nomeTex] || 6;
      const g = geometriaRetangulos(rets, CAMADA[tipo] ?? 0, esc);
      raiz.add(new THREE.Mesh(g, materialChao(texturaChao(nomeTex, ladoTex), uniBuracos)));
    }
    // o mundo em volta do mapa (grama, agua na praia, calda na doceria): agua e calda andam
    {
      const nomeTex = chaoTema.fora;
      const L = mapa.lado / 2;
      const fora = [
        { x0: -340, z0: -340, x1: 340, z1: -L }, { x0: -340, z0: L, x1: 340, z1: 340 },
        { x0: -340, z0: -L, x1: -L, z1: L }, { x0: L, z0: -L, x1: 340, z1: L },
      ];
      const tex = texturaChao(nomeTex, ladoTex);
      raiz.add(new THREE.Mesh(geometriaRetangulos(fora, 0, ESCALA_CHAO[nomeTex] || 8), materialChao(tex, uniBuracos, 0xeeeeee)));
      M = { texFora: nomeTex === 'agua' || nomeTex === 'calda' ? tex : null };
    }
    // mureta da borda (v0.3.1): sem ela, a borda do Solo e da Batalha parecia o mapa encolhido e cortado
    {
      const mat = materialChao(null, uniBuracos, 0xffffff, 0.06);
      mat.vertexColors = true;
      raiz.add(new THREE.Mesh(geometriaMureta(mapa.lado, t), mat));
    }
    // meio-fio e faixas pintadas
    raiz.add(new THREE.Mesh(geometriaMeioFio(mapa.blocos), materialChao(null, uniBuracos, ct.meiofio, 0.08)));
    for (const tipo of ['linha', 'zebra']) {
      const rets = mapa.faixas.filter((f) => f.tipo === tipo);
      if (rets.length) raiz.add(new THREE.Mesh(geometriaRetangulos(rets, 0.02, 1), materialChao(null, uniBuracos, tipo === 'linha' ? ct.linha : ct.zebra, 0.1)));
    }

    // contagem por tipo de visual (com folga para o reabastecimento da rodada, v0.3.0)
    const reabastece = R.modo !== 'solo';
    const cap = R.objetos.length + (reabastece ? REABASTECE.extra + 60 : 4);
    /** @type {Record<string, number>} */
    const porModelo = {};
    let nPredios = 0;
    for (const ob of R.objetos) {
      if (ob.peca.forma === 'carro' || ob.peca.forma === 'modelo') porModelo[ob.peca.modelo] = (porModelo[ob.peca.modelo] || 0) + 1;
      else if (ob.peca.forma === 'casa' || ob.peca.forma === 'caixa') nPredios++;
    }
    /** @type {Record<string, number>} */
    const folga = {};
    if (reabastece) {
      for (const p of Object.values(tema.grupos).flat()) {
        if (p.forma !== 'carro' && p.forma !== 'modelo') continue;
        porModelo[p.modelo] = porModelo[p.modelo] || 0;
        folga[p.modelo] = p.forma === 'modelo' ? 260 : 40;
      }
    }
    const capPredios = nPredios * 4 + 8;
    const capC = capPredios + POOL_PEDACOS;
    const capT = nPredios + 4 + POOL_TELHADOS;
    const atlasS = rec.atlasSprites;
    const atlasP = rec.atlasPredios;
    // sprites e pessoas
    const sprites = new THREE.InstancedMesh(geoSprite.clone(), materialSprites(atlasS.tex), cap);
    const aUv = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4);
    const aEscS = new THREE.InstancedBufferAttribute(new Float32Array(cap).fill(1), 1);
    const aAlto = new THREE.InstancedBufferAttribute(new Float32Array(cap), 1);
    const aTinta = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3).fill(1), 3);
    sprites.geometry.setAttribute('aUv', aUv);
    sprites.geometry.setAttribute('aEsc', aEscS);
    sprites.geometry.setAttribute('aAlto', aAlto);
    sprites.geometry.setAttribute('aTinta', aTinta);
    sprites.frustumCulled = false;
    // predios (paredes + detalhes) e telhados de duas aguas
    const matP = materialPredios(atlasP.tex, texTelhados);
    const caixas = new THREE.InstancedMesh(geoCaixa.clone(), matP, capC);
    const telhados = new THREE.InstancedMesh(geoTelhado.clone(), matP, capT);
    const attrs = (/** @type {THREE.InstancedMesh} */ im, n) => {
      const a = {
        fach: new THREE.InstancedBufferAttribute(new Float32Array(n * 4), 4),
        teto: new THREE.InstancedBufferAttribute(new Float32Array(n * 4), 4),
        parede: new THREE.InstancedBufferAttribute(new Float32Array(n * 3).fill(1), 3),
        corTeto: new THREE.InstancedBufferAttribute(new Float32Array(n * 3).fill(1), 3),
        esc: new THREE.InstancedBufferAttribute(new Float32Array(n).fill(1), 1),
        rep: new THREE.InstancedBufferAttribute(new Float32Array(n).fill(1), 1),
        modo: new THREE.InstancedBufferAttribute(new Float32Array(n), 1),
        racha: new THREE.InstancedBufferAttribute(new Float32Array(n), 1),
      };
      im.geometry.setAttribute('aRacha', a.racha);
      im.geometry.setAttribute('aRep', a.rep);
      im.geometry.setAttribute('aFach', a.fach);
      im.geometry.setAttribute('aTeto', a.teto);
      im.geometry.setAttribute('aParede', a.parede);
      im.geometry.setAttribute('aCorTeto', a.corTeto);
      im.geometry.setAttribute('aEsc', a.esc);
      im.geometry.setAttribute('aModo', a.modo);
      im.frustumCulled = false;
      return a;
    };
    const aCx = attrs(caixas, capC);
    const aTl = attrs(telhados, capT);
    const sombrasP = new THREE.InstancedMesh(geoSombraPredio.clone(), materialSombraPredio(uniBuracos), nPredios + 4);
    const aAlt = new THREE.InstancedBufferAttribute(new Float32Array(nPredios + 4), 1);
    sombrasP.geometry.setAttribute('aAlt', aAlt);
    sombrasP.frustumCulled = false;
    sombrasP.renderOrder = 1;
    // carros: um InstancedMesh por modelo
    /** @type {Record<string, any>} */
    const carros = {};
    for (const [modelo, n0] of Object.entries(porModelo)) {
      const n = n0 + (folga[modelo] || 0);
      if (n <= 0) continue;
      const im = new THREE.InstancedMesh(geometriaCarro(modelo), materialCarros(carroAlto(modelo)), n);
      im.userData.geoFixa = true;
      const a1 = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3);
      const a2 = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3);
      const ae = new THREE.InstancedBufferAttribute(new Float32Array(n).fill(1), 1);
      // atributos por instancia numa copia da geometria (a original e compartilhada entre rodadas)
      im.geometry = im.geometry.clone();
      im.userData.geoFixa = false;
      im.geometry.setAttribute('aCor1', a1);
      im.geometry.setAttribute('aCor2', a2);
      im.geometry.setAttribute('aEsc', ae);
      im.frustumCulled = false;
      im.count = 0;
      carros[modelo] = { im, a1, a2, ae, n: 0, cap: n, ids: /** @type {number[]} */ ([]), med: medidasCarro(modelo) };
      raiz.add(im);
    }
    const sombras = new THREE.InstancedMesh(geoSombra, matSombra, cap);
    sombras.frustumCulled = false;
    sombras.renderOrder = 1;
    raiz.add(sombrasP, sombras, sprites, caixas, telhados);
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < cap; i++) {
      sprites.setMatrixAt(i, zero);
      sombras.setMatrixAt(i, zero);
    }
    for (let i = 0; i < capC; i++) caixas.setMatrixAt(i, zero);
    for (let i = 0; i < capT; i++) telhados.setMatrixAt(i, zero);
    for (let i = 0; i < nPredios + 4; i++) sombrasP.setMatrixAt(i, zero);
    sprites.count = 0;
    // caixas e telhados desenham a capacidade toda: o fim e o estoque de pedacos de predio caindo
    caixas.count = capC;
    telhados.count = capT;
    sombrasP.count = 0;
    sombras.count = cap;

    // quadros das pessoas: escala pela altura do quadro 2 (de pe)
    /** @type {Record<string, any[]>} */
    const quadros = {};
    for (const p of Object.values(tema.grupos).flat()) {
      if (p.forma !== 'pessoa' || quadros[p.arte]) continue;
      quadros[p.arte] = Array.from({ length: QUADROS_PESSOA }, (_, k) => atlasS.rets[`${p.arte}-${String(k + 1).padStart(2, '0')}`]);
    }

    const texFora = M.texFora;
    M = {
      R, rec, sprites, caixas, telhados, sombras, sombrasP, aAlt, aUv, aEscS, aAlto, aTinta, aCx, aTl, carros, cap, quadros,
      ct, texFora, tema,
      /** por objeto: visual */
      vis: [],
      nS: 0,
      nC: 0,
      nT: 0,
      nSP: 0,
      /** objetos que andam (pessoas, carros) */
      mov: [],
      /** inclinacao na borda neste quadro e no anterior */
      pre: new Map(),
      preAnt: new Map(),
      /** pedacos de predio caindo (andares, telhado, entulho) e as vagas livres nos estoques */
      pedacos: /** @type {any[]} */ ([]),
      livresC: Array.from({ length: POOL_PEDACOS }, (_, k) => capPredios + k),
      livresT: Array.from({ length: POOL_TELHADOS }, (_, k) => nPredios + 4 + k),
      /** onda no chao quando o buraco do jogador cresce */
      onda: /** @type {any} */ (null),
      /** objetos que a onda levantou no quadro anterior (voltam ao chao) */
      ondaAnt: /** @type {Set<number>} */ (new Set()),
      /** predios com rachadura desenhada (a rachadura some quando a boca sai de baixo) */
      rachados: /** @type {Set<number>} */ (new Set()),
    };
    for (const ob of R.objetos) registrar(ob);
    sprites.instanceMatrix.needsUpdate = true;
    caixas.instanceMatrix.needsUpdate = true;
    telhados.instanceMatrix.needsUpdate = true;
    sombras.instanceMatrix.needsUpdate = true;
    sombrasP.instanceMatrix.needsUpdate = true;
    for (const c of Object.values(carros)) c.im.instanceMatrix.needsUpdate = true;
    // todos os buracos visuais comecam escondidos: os que sobram de uma rodada com mais bots (Solo depois do
    // Classico, Batalha depois de 9 bots) ficavam congelados no chao, parecendo bots parados (bug da v0.3.0)
    for (const b of buracos) {
      b.grupo.visible = false;
      b.skin = -1;
      b.rv = 0;
      b.rvv = 0;
      b.vivoAnt = false;
      b.gole = 0;
      b.acc = 0;
      b.rachaT = -1;
      b.racha.visible = false;
    }
    camExtra = 0;
    for (const p of pulsos) p.m.visible = false;
    for (const p of P) p.viva = false;
    const eu = R.buracos[0];
    camAlvo.set(eu.x, 0, eu.z);
    camDist = distanciaCamera(eu.r);
    tremor = 0;
  }

  /** Cria o visual de uma peca (na montagem e quando o gigante aparece). */
  function registrar(ob) {
    const p = ob.peca;
    if (p.forma === 'sprite' || p.forma === 'pessoa') {
      const i = M.nS++;
      M.sprites.count = M.nS;
      let w;
      let h;
      if (p.forma === 'pessoa') {
        const qs = M.quadros[p.arte];
        const q = qs && qs[1];
        const k = q ? ALTURA_PESSOA / q.py : 0.01;
        h = ALTURA_PESSOA;
        w = q ? q.px * k : 0.5;
        if (q) M.aUv.setXYZW(i, q.u, q.v, q.w, q.h);
        M.vis[ob.id] = { tipo: 'p', i, w, h, k, q: 1, esp: ob.espelho, modoAnt: '' };
      } else {
        const r = M.rec.atlasSprites.rets[p.arte];
        const asp = r ? r.aspecto : 1;
        // largura pela pegada; o gigante tem altura fixa no catalogo
        h = p.h ? p.h : (p.s * 2.25) / asp;
        w = h * asp;
        if (r) M.aUv.setXYZW(i, r.u, r.v, r.w, r.h);
        M.vis[ob.id] = { tipo: 's', i, w, h };
      }
      M.aAlto.setX(i, h > 3.2 ? 1 : 0);
      // variacao de cor por objeto: brilho e um tiquinho de matiz
      const v = 0.95 + sorte(ob.id) * 0.09;
      M.aTinta.setXYZ(i, v * (0.98 + sorte(ob.id, 1) * 0.04), v, v * (0.98 + sorte(ob.id, 2) * 0.04));
      M.aAlto.needsUpdate = true;
      M.aUv.needsUpdate = true;
      M.aTinta.needsUpdate = true;
    } else if (p.forma === 'carro' || p.forma === 'modelo') {
      const c = M.carros[p.modelo];
      if (!c || c.n >= c.cap) return;
      const i = c.n++;
      c.im.count = c.n;
      c.ids[i] = ob.id;
      const [c1, c2] = coresCarro(p.modelo, M.tema.cores.carro, ob.id);
      c.a1.setXYZ(i, c1.r, c1.g, c1.b);
      c.a2.setXYZ(i, c2.r, c2.g, c2.b);
      c.a1.needsUpdate = true;
      c.a2.needsUpdate = true;
      M.vis[ob.id] = { tipo: 'v', i, c, buzinaAnt: ob.ia ? ob.ia.buzina : -9 };
    } else {
      const rf = M.rec.atlasPredios.rets[p.arte];
      const estilo = Math.max(0, TELHADOS.indexOf(p.telhado || 'plano'));
      const a = meioLado(p.s);
      // altura pela proporcao da fachada (a imagem manda)
      const h = rf ? Math.max(1.2, Math.min(14, (2 * a) / rf.aspecto)) : p.h || 2;
      const i = M.nC++;
      const ins = 0.012;
      const tetoRet = [estilo / 4 + 0.002, 0.004, 0.25 - 0.004, 0.992];
      if (rf) M.aCx.fach.setXYZW(i, rf.u + rf.w * ins, rf.v + rf.h * ins, rf.w * (1 - 2 * ins), rf.h * (1 - 2 * ins));
      M.aCx.teto.setXYZW(i, ...tetoRet);
      const plano = p.forma === 'caixa';
      // laje (com a mureta desenhada) numa repeticao so; palha e glace repetem pelo tamanho
      M.aCx.rep.setX(i, plano && p.telhado === 'plano' ? 1 : Math.max(1, Math.round((2 * a) / 1.5)));
      const varP = 0.94 + sorte(ob.id, 3) * 0.1;
      M.aCx.parede.setXYZ(i, varP, varP, varP);
      const paleta = M.tema.cores.teto;
      const corTeto = new THREE.Color(paleta[Math.floor(sorte(ob.id, 4) * paleta.length)]);
      if (plano && p.telhado === 'plano') corTeto.setRGB(1, 1, 1);
      if (p.telhado === 'palha') corTeto.setRGB(1, 0.97, 0.92);
      const vt = 0.92 + sorte(ob.id, 5) * 0.12;
      M.aCx.corTeto.setXYZ(i, corTeto.r * vt, corTeto.g * vt, corTeto.b * vt);
      const cor = M.rec.paredes[p.arte];
      M.aCx.racha.setX(i, ob.id % 89);
      let ti = -1;
      if (p.forma === 'casa') {
        ti = M.nT++;
        if (rf) M.aTl.fach.setXYZW(ti, rf.u + rf.w * ins, rf.v + rf.h * ins, rf.w * (1 - 2 * ins), rf.h * (1 - 2 * ins));
        M.aTl.teto.setXYZW(ti, ...tetoRet);
        M.aTl.rep.setX(ti, Math.max(1, Math.round((2 * a) / 1.5)));
        if (cor) M.aTl.parede.setXYZ(ti, cor.r * varP, cor.g * varP, cor.b * varP);
        M.aTl.corTeto.setXYZ(ti, corTeto.r * vt, corTeto.g * vt, corTeto.b * vt);
      }
      // detalhes feitos no codigo: chamine, ar-condicionado, caixa d'agua, antena
      const det = [];
      const caixinha = (lx, ly, lz, sx, sy, sz, corHex) => {
        const di = M.nC++;
        M.aCx.modo.setX(di, 1);
        corTmp.set(corHex);
        M.aCx.parede.setXYZ(di, corTmp.r, corTmp.g, corTmp.b);
        M.aCx.teto.setXYZW(di, ...tetoRet);
        det.push({ i: di, l: new THREE.Vector3(lx, ly, lz), s: new THREE.Vector3(sx, sy, sz) });
      };
      const sd = (k) => sorte(ob.id, 10 + k);
      if (p.forma === 'casa') {
        if (p.telhado === 'telha' && sd(0) < 0.65) caixinha(a * (sd(1) < 0.5 ? 0.45 : -0.45), h + a * 0.42, -a * 0.28, 0.3, 0.62, 0.3, M.tema.id === 'doceria' ? '#fff3f8' : '#b8574a');
      } else if (p.forma === 'caixa') {
        const cinza = M.tema.id === 'doceria' ? '#fff3f8' : '#d4cfd8';
        if (h > 4) {
          caixinha(-a * 0.35, h, -a * 0.3, 0.95, 0.75, 0.95, M.tema.id === 'cidade' ? '#9fcfe8' : M.tema.id === 'praia' ? '#f2e3c4' : '#ffc3da');
          caixinha(a * 0.4, h, a * 0.25, 0.55, 0.32, 0.42, cinza);
          if (h > 8) caixinha(a * 0.35, h, -a * 0.4, 0.08, 1.6, 0.08, '#6f6878');
        } else {
          caixinha(a * (sd(2) < 0.5 ? 0.35 : -0.35), h, a * (sd(3) < 0.5 ? 0.25 : -0.25), 0.55, 0.32, 0.42, cinza);
          if (sd(4) < 0.5) caixinha(-a * 0.2, h, -a * 0.35, 0.5, 0.3, 0.4, cinza);
        }
      }
      for (const k of ['fach', 'teto', 'parede', 'rep', 'corTeto', 'modo', 'racha']) {
        M.aCx[k].needsUpdate = true;
        M.aTl[k].needsUpdate = true;
      }
      // sombra projetada
      const si = M.nSP++;
      M.sombrasP.count = M.nSP;
      M.aAlt.setX(si, h + (p.forma === 'casa' ? a * 1.05 : 0));
      M.aAlt.needsUpdate = true;
      // cumeeira apontando para a camera: aparece a empena e as duas aguas (de lado, o telhado vira um cubo de telha)
      M.vis[ob.id] = { tipo: 'c', i, a, h, telhado: ti, ht: a * 1.05, det, si, giroTeto: Math.PI / 2 };
    }
    if (ob.ia || ob.nasceu >= 0 || ob.brota >= 0) M.mov.push(ob.id);
    // brotou (reabastecimento) a vista: uma nuvenzinha no chao
    if (ob.brota >= 0 && Math.abs(ob.x - camAlvo.x) < camDist && Math.abs(ob.z - camAlvo.z) < camDist) {
      soltar(PART.poeira, ob.x, 0.12, ob.z, 0, 0.35, 0, 0.6, 0.2, 0.5 + p.s, M.ct.poeira, 0.6, 0, 1.5);
    }
    pousar(ob, 0);
  }

  /** Quadro da pessoa pelo que ela esta fazendo (1-4 andar, 5-6 correr, 7 susto, 8 aceno, 9 queda). */
  function quadroPessoa(ob, t) {
    if (ob.estado === 1) return 9;
    const ia = ob.ia;
    if (!ia) return 2;
    const fase = sorte(ob.id) * 4;
    if (ia.modo === 'anda' || ia.modo === 'atravessa') return 1 + (Math.floor(t * 7.5 * (ia.vel / 0.85) + fase) % 4);
    if (ia.modo === 'foge') return 5 + (Math.floor(t * 9 + fase) % 2);
    if (ia.modo === 'susto') return 7;
    if (ia.modo === 'acena') return 8;
    return 2;
  }

  /** Atualiza a matriz de uma peca. @param {any} ob @param {number} t */
  function pousar(ob, t) {
    const v = M.vis[ob.id];
    if (!v) return;
    if (ob.estado === 2 || v.quebrado) {
      if (!v.oculto) esconder(v, ob.id);
      return;
    }
    let x = ob.x;
    let y = ob.y;
    let z = ob.z;
    let incl = 0;
    let eixo = 0;
    let giro = 0;
    let esc = 1;
    if (ob.nasceu >= 0) {
      // o gigante cai do ceu com um quique
      const k = (M.R.t - ob.nasceu) / 0.9;
      if (k < 1) y += Math.pow(1 - k, 2) * 28;
      else if (k < 1.5) y += Math.abs(Math.sin((k - 1) * Math.PI * 2)) * 1.2 * (1.5 - k);
    }
    if (ob.estado === 1) {
      incl = ob.incl;
      eixo = ob.eixo;
      giro = ob.giro;
      // escurece com a profundidade (o fundo do buraco e breu)
      esc = Math.max(0.04, Math.min(1, Math.exp(y * 0.32)));
    } else {
      const pt = M.pre.get(ob.id);
      if (pt) {
        incl = pt.a;
        eixo = pt.eixo;
        x += pt.dx;
        z += pt.dz;
        y += pt.dy;
      }
      // grande demais na boca: balanca (mais quanto mais rachou)
      if (ob.treme > 0) x += Math.sin(t * 70 + ob.id) * (0.03 + ob.dano * 0.05);
      // onda do crescimento passando: pula (o pequeno pula mais)
      const o = M.onda;
      if (o) {
        const dd = Math.hypot(ob.x - o.x, ob.z - o.z) - o.frente;
        if (dd > -1.2 && dd < 1.2) {
          const k = Math.cos((dd / 1.2) * Math.PI * 0.5);
          y += k * k * o.amp / (0.7 + ob.peca.s);
          M.ondaAnt.add(ob.id);
        }
      }
    }
    // brotou agora (reabastecimento): cresce do chao com um quique
    let bro = 1;
    if (ob.brota >= 0) {
      const k = (M.R.t - ob.brota) / 0.45;
      // "ease out back": passa um pouco do tamanho e volta
      const u = Math.max(0, Math.min(1, k)) - 1;
      bro = Math.max(0.001, 1 + 2.7 * u * u * u + 1.7 * u * u);
    }
    tmpP.set(x, y, z);
    // tomba para o centro do buraco (eixo no chao, perpendicular a direcao do centro)
    tmpQ.identity();
    if (incl > 0) {
      const dx = -Math.cos(eixo);
      const dz = -Math.sin(eixo);
      tmpQ.setFromAxisAngle(tmpS.set(dz, 0, -dx).normalize(), incl);
    }
    let sombraEsc = 0;
    let sombraW = 0;
    let sombraD = 0;
    let sombraAng = 0;
    if (v.tipo === 's' || v.tipo === 'p') {
      let w = v.w;
      let h = v.h;
      let esp = ob.espelho;
      if (v.tipo === 'p') {
        const k = quadroPessoa(ob, t);
        if (k !== v.q) {
          v.q = k;
          const q = M.quadros[ob.peca.arte][k - 1];
          if (q) {
            M.aUv.setXYZW(v.i, q.u, q.v, q.w, q.h);
            M.aUv.needsUpdate = true;
            v.qw = q.px * v.k;
            v.qh = q.py * v.k;
          }
        }
        if (v.qw) {
          w = v.qw;
          h = v.qh;
        }
        // os quadros olham para a esquerda: espelha quando anda para a direita
        const cx = Math.cos(ob.ang);
        if (ob.ia && Math.abs(cx) > 0.2) v.esp = cx > 0;
        esp = !!v.esp;
        const ia = ob.ia;
        if (ob.estado === 0 && ia) {
          if (ia.modo === 'anda' || ia.modo === 'atravessa') tmpP.y += Math.abs(Math.sin(t * 7.5 * Math.PI * (ia.vel / 0.85) * 0.5 + ob.id)) * 0.03;
          else if (ia.modo === 'susto') tmpP.y += Math.abs(Math.sin(t * 16 + ob.id)) * 0.08;
          // balao de susto quando entra no susto
          if (ia.modo === 'susto' && v.modoAnt !== 'susto') soltar(2, ob.x, h + 0.35, ob.z, 0, 0.5, 0, 0.85, 0.5, 0.62, '#ffffff', 1, 0, 0);
          v.modoAnt = ia.modo;
        }
      }
      tmpQ.multiply(qBill);
      if (ob.estado === 1) tmpQ.multiply(tmpQ2.setFromAxisAngle(eixoZ, giro * 0.7));
      else if (v.tipo === 'p' && ob.ia && ob.ia.modo === 'acena') tmpQ.multiply(tmpQ2.setFromAxisAngle(eixoZ, Math.sin(t * 11 + ob.id) * 0.12));
      tmpS.set((esp ? -w : w) * bro, h * bro, 1);
      tmpM.compose(tmpP, tmpQ, tmpS);
      M.sprites.setMatrixAt(v.i, tmpM);
      M.aEscS.setX(v.i, esc);
      M.aEscS.needsUpdate = true;
      M.sprites.instanceMatrix.needsUpdate = true;
      sombraEsc = 1;
      sombraW = v.tipo === 'p' ? 0.55 : ob.peca.s * 2.1;
      sombraD = sombraW * 0.8;
    } else if (v.tipo === 'v') {
      tmpQ.multiply(tmpQ2.setFromAxisAngle(eixoY, -ob.ang + (ob.estado === 1 ? giro * 0.6 : 0)));
      tmpS.set(bro, bro, bro);
      tmpM.compose(tmpP, tmpQ, tmpS);
      v.c.im.setMatrixAt(v.i, tmpM);
      v.c.ae.setX(v.i, esc);
      v.c.ae.needsUpdate = true;
      v.c.im.instanceMatrix.needsUpdate = true;
      sombraEsc = 1;
      sombraW = v.c.med.comp * 1.12;
      sombraD = v.c.med.larg * 1.3;
      sombraAng = -ob.ang;
      // buzinou: tracinhos de som em cima do capo
      if (ob.ia && ob.ia.buzina !== v.buzinaAnt) {
        v.buzinaAnt = ob.ia.buzina;
        soltar(3, ob.x + Math.cos(ob.ang) * v.c.med.comp * 0.5, v.c.med.alt + 0.35, ob.z + Math.sin(ob.ang) * v.c.med.comp * 0.5, 0, 0.6, 0, 0.7, 0.55, 0.75, '#ffffff', 1, 0, 0);
      }
    } else {
      if (ob.estado === 1) tmpQ.multiply(tmpQ2.setFromAxisAngle(eixoY, giro * 0.25));
      tmpS.set(v.a * 2, v.h, v.a * 2);
      tmpM.compose(tmpP, tmpQ, tmpS);
      M.caixas.setMatrixAt(v.i, tmpM);
      M.aCx.esc.setX(v.i, esc);
      M.aCx.esc.needsUpdate = true;
      if (v.telhado >= 0) {
        // telhado em cima da parede, girando junto
        tmpV.set(0, v.h, 0).applyQuaternion(tmpQ).add(tmpP);
        tmpS.set(v.a * 2, v.ht, v.a * 2);
        tmpQ2.setFromAxisAngle(eixoY, v.giroTeto);
        tmpM.compose(tmpV, tmpQ2.premultiply(tmpQ), tmpS);
        M.telhados.setMatrixAt(v.telhado, tmpM);
        M.aTl.esc.setX(v.telhado, esc);
        M.aTl.esc.needsUpdate = true;
        M.telhados.instanceMatrix.needsUpdate = true;
      }
      for (const d of v.det) {
        tmpV.copy(d.l).applyQuaternion(tmpQ).add(tmpP);
        tmpM.compose(tmpV, tmpQ, d.s);
        M.caixas.setMatrixAt(d.i, tmpM);
        M.aCx.esc.setX(d.i, esc);
      }
      M.caixas.instanceMatrix.needsUpdate = true;
      // sombra projetada so com o predio em pe
      if (ob.estado === 0 && incl < 0.05) tmpM.compose(tmpV.set(x, 0.021, z), tmpQ2.identity(), tmpS.set(v.a * 2, 1, v.a * 2));
      else tmpM.makeScale(0, 0, 0);
      M.sombrasP.setMatrixAt(v.si, tmpM);
      M.sombrasP.instanceMatrix.needsUpdate = true;
    }
    // mancha de sombra so no chao
    if (sombraEsc && ob.estado === 0) {
      tmpQ.setFromAxisAngle(eixoY, sombraAng);
      tmpM.compose(tmpP.set(x + sombraW * 0.06, 0.022, z + sombraW * 0.04), tmpQ, tmpS.set(sombraW, 1, sombraD));
      M.sombras.setMatrixAt(ob.id, tmpM);
    } else M.sombras.setMatrixAt(ob.id, tmpM.makeScale(0, 0, 0));
    M.sombras.instanceMatrix.needsUpdate = true;
  }

  function esconder(v, id) {
    tmpM.makeScale(0, 0, 0);
    if (v.tipo === 's' || v.tipo === 'p') {
      M.sprites.setMatrixAt(v.i, tmpM);
      M.sprites.instanceMatrix.needsUpdate = true;
    } else if (v.tipo === 'v') {
      // tira da lista: o ultimo ocupa a vaga e a contagem encurta (carro e adereco engolido nao custa mais nada)
      const c = v.c;
      const ult = c.n - 1;
      if (v.i >= 0 && v.i <= ult) {
        if (v.i !== ult) {
          const idU = c.ids[ult];
          const vU = M.vis[idU];
          c.im.getMatrixAt(ult, tmpM);
          c.im.setMatrixAt(v.i, tmpM);
          c.a1.setXYZ(v.i, c.a1.getX(ult), c.a1.getY(ult), c.a1.getZ(ult));
          c.a2.setXYZ(v.i, c.a2.getX(ult), c.a2.getY(ult), c.a2.getZ(ult));
          c.ae.setX(v.i, c.ae.getX(ult));
          c.ids[v.i] = idU;
          if (vU) vU.i = v.i;
          c.a1.needsUpdate = true;
          c.a2.needsUpdate = true;
          c.ae.needsUpdate = true;
        }
        c.im.setMatrixAt(ult, tmpM.makeScale(0, 0, 0));
        c.n = ult;
        c.im.count = c.n;
        c.im.instanceMatrix.needsUpdate = true;
      }
      v.i = -1;
    } else {
      M.caixas.setMatrixAt(v.i, tmpM);
      for (const d of v.det) M.caixas.setMatrixAt(d.i, tmpM);
      M.caixas.instanceMatrix.needsUpdate = true;
      if (v.telhado >= 0) {
        M.telhados.setMatrixAt(v.telhado, tmpM);
        M.telhados.instanceMatrix.needsUpdate = true;
      }
      M.sombrasP.setMatrixAt(v.si, tmpM);
      M.sombrasP.instanceMatrix.needsUpdate = true;
    }
    M.sombras.setMatrixAt(id, tmpM);
    M.sombras.instanceMatrix.needsUpdate = true;
    v.oculto = true;
  }

  // ------------------------------------------------------------------ predio que se parte (v0.3.0)
  /** Transformacao atual de um predio caindo (como o pousar faz), em tmpP e tmpQ. */
  function poseDoPredio(ob) {
    tmpP.set(ob.x, ob.y, ob.z);
    const dx = -Math.cos(ob.eixo);
    const dz = -Math.sin(ob.eixo);
    tmpQ.setFromAxisAngle(tmpS.set(dz, 0, -dx).normalize(), ob.incl);
    tmpQ.multiply(tmpQ2.setFromAxisAngle(eixoY, ob.giro * 0.25));
  }

  /**
   * Um pedaco novo (andar, telhado, entulho) com a fisica dele. A posicao fica relativa ao centro do buraco (ox,
   * oz), como a queda da logica: o buraco andando leva os pedacos junto e ninguem fica para tras na rua.
   */
  function novoPedaco(o) {
    const p = {
      vivo: true, t: 0, x: 0, y: 0, z: 0, ox: 0, oz: 0, vx: 0, vy: 0, vz: 0, q: new THREE.Quaternion(), w: new THREE.Vector3(),
      sx: 1, sy: 1, sz: 1, i: -1, ti: -1, dono: 0, proprio: false, hx: 0, hz: 0, ...o,
    };
    const b = M.R.buracos[p.dono];
    p.hx = b ? b.x : p.x;
    p.hz = b ? b.z : p.z;
    p.ox = p.x - p.hx;
    p.oz = p.z - p.hz;
    M.pedacos.push(p);
  }

  /**
   * O predio passou do ponto na borda: some a caixa inteira e nascem os andares (cada um com a fatia da fachada),
   * o telhado, o entulho, os cacos de vidro e a poeira da base; tudo cai com fisica para dentro da boca.
   */
  function quebrar(ob, v, foco) {
    v.quebrado = true;
    esconder(v, ob.id);
    M.rachados.delete(ob.id);
    const b = M.R.buracos[ob.dono];
    if (!b) return;
    const casa = v.telhado >= 0;
    poseDoPredio(ob);
    const P0 = tmpP.clone();
    const Q0 = tmpQ.clone();
    // para o centro do buraco e eixo do tombo
    const cx = -Math.cos(ob.eixo);
    const cz = -Math.sin(ob.eixo);
    const eixoT = new THREE.Vector3(cz, 0, -cx).normalize();
    const omega = Math.max(0.8, ob.vincl);
    const s = ob.peca.s;
    const nA = casa ? 2 : Math.max(2, Math.min(5, Math.round(v.h / 1.5)));
    const hk = v.h / nA;
    const f = [M.aCx.fach.getX(v.i), M.aCx.fach.getY(v.i), M.aCx.fach.getZ(v.i), M.aCx.fach.getW(v.i)];
    const corP = [M.aCx.parede.getX(v.i), M.aCx.parede.getY(v.i), M.aCx.parede.getZ(v.i)];
    const lp = new THREE.Vector3();
    for (let k = 0; k < nA; k++) {
      const i = M.livresC.pop();
      if (i === undefined) break;
      const topo = k === nA - 1 && !casa;
      M.aCx.fach.setXYZW(i, f[0], f[1] + f[3] * (k / nA), f[2], f[3] / nA);
      M.aCx.teto.setXYZW(i, M.aCx.teto.getX(v.i), M.aCx.teto.getY(v.i), M.aCx.teto.getZ(v.i), M.aCx.teto.getW(v.i));
      M.aCx.parede.setXYZ(i, corP[0], corP[1], corP[2]);
      M.aCx.corTeto.setXYZ(i, M.aCx.corTeto.getX(v.i), M.aCx.corTeto.getY(v.i), M.aCx.corTeto.getZ(v.i));
      M.aCx.rep.setX(i, M.aCx.rep.getX(v.i));
      M.aCx.modo.setX(i, topo ? 3 : 2);
      M.aCx.racha.setX(i, ((ob.id + k * 13) % 89) + 0.55 + Math.random() * 0.35);
      lp.set(0, k * hk, 0).applyQuaternion(Q0).add(P0);
      // o tombo continua: quanto mais alto o andar, mais rapido vai para o centro; os de cima se soltam
      const alt = k * hk + hk * 0.5;
      const solta = k / Math.max(1, nA - 1);
      const vh = omega * alt * 0.55 + 0.5 + Math.random() * 0.5;
      novoPedaco({
        i, x: lp.x, y: lp.y, z: lp.z, dono: b.id,
        vx: cx * vh + (Math.random() - 0.5) * 0.8 * solta, vz: cz * vh + (Math.random() - 0.5) * 0.8 * solta,
        vy: ob.vy + solta * (0.4 + Math.random() * 0.9),
        q: Q0.clone(), sx: v.a * 2, sy: hk, sz: v.a * 2,
        w: eixoT.clone().multiplyScalar(omega * (0.45 + solta * 0.5) + Math.random() * 0.3).add(new THREE.Vector3((Math.random() - 0.5) * solta, (Math.random() - 0.5) * 2 * solta, (Math.random() - 0.5) * solta)),
      });
    }
    // telhado de duas aguas: pula, gira e cai por ultimo
    if (casa) {
      const ti = M.livresT.pop();
      if (ti !== undefined) {
        for (const kk of ['fach', 'teto']) M.aTl[kk].setXYZW(ti, M.aTl[kk].getX(v.telhado), M.aTl[kk].getY(v.telhado), M.aTl[kk].getZ(v.telhado), M.aTl[kk].getW(v.telhado));
        for (const kk of ['parede', 'corTeto']) M.aTl[kk].setXYZ(ti, M.aTl[kk].getX(v.telhado), M.aTl[kk].getY(v.telhado), M.aTl[kk].getZ(v.telhado));
        M.aTl.rep.setX(ti, M.aTl.rep.getX(v.telhado));
        M.aTl.modo.setX(ti, 3);
        for (const kk of ['fach', 'teto', 'parede', 'corTeto', 'rep', 'modo']) M.aTl[kk].needsUpdate = true;
        lp.set(0, v.h, 0).applyQuaternion(Q0).add(P0);
        novoPedaco({
          ti, x: lp.x, y: lp.y, z: lp.z, dono: b.id, vx: cx * (1.2 + omega * v.h * 0.5), vz: cz * (1.2 + omega * v.h * 0.5), vy: 1.3 + Math.random() * 0.8,
          q: Q0.clone().multiply(new THREE.Quaternion().setFromAxisAngle(eixoY, v.giroTeto)), sx: v.a * 2, sy: v.ht, sz: v.a * 2,
          w: eixoT.clone().multiplyScalar(1.6 + Math.random() * 1.4).add(new THREE.Vector3(0, (Math.random() - 0.5) * 3, 0)),
        });
      }
    }
    // chamine, ar-condicionado e caixa d'agua viram entulho voando (as caixinhas sao do proprio predio)
    for (const d of v.det) {
      lp.copy(d.l).applyQuaternion(Q0).add(P0);
      novoPedaco({
        i: d.i, proprio: true, x: lp.x, y: lp.y, z: lp.z, dono: b.id, q: Q0.clone(), sx: d.s.x, sy: d.s.y, sz: d.s.z,
        vx: cx * 1.5 + (Math.random() - 0.5) * 2.5, vz: cz * 1.5 + (Math.random() - 0.5) * 2.5, vy: 1.5 + Math.random() * 1.5,
        w: new THREE.Vector3((Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8),
      });
    }
    // blocos de entulho (caixinhas solidas na cor da parede, um pouco mais escuras)
    const nE = Math.min(10, 4 + Math.round(s * 2));
    for (let k = 0; k < nE; k++) {
      const i = M.livresC.pop();
      if (i === undefined) break;
      const e = 0.72 + Math.random() * 0.2;
      M.aCx.modo.setX(i, 1);
      M.aCx.parede.setXYZ(i, corP[0] * e, corP[1] * e, corP[2] * e);
      M.aCx.racha.setX(i, 0);
      const ang = Math.random() * Math.PI * 2;
      lp.set(Math.cos(ang) * v.a, Math.random() * v.h, Math.sin(ang) * v.a).applyQuaternion(Q0).add(P0);
      const tam = 0.14 + Math.random() * 0.26 * Math.min(1.6, s * 0.6);
      novoPedaco({
        i, x: lp.x, y: lp.y, z: lp.z, dono: b.id, q: new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.random() * 3, Math.random() * 3, Math.random() * 3)),
        sx: tam, sy: tam * (0.6 + Math.random() * 0.6), sz: tam * (0.7 + Math.random() * 0.5),
        vx: Math.cos(ang) * (0.8 + Math.random() * 1.6) + cx * 0.8, vz: Math.sin(ang) * (0.8 + Math.random() * 1.6) + cz * 0.8, vy: 0.8 + Math.random() * 2.2,
        w: new THREE.Vector3((Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10),
      });
    }
    for (const kk of ['fach', 'teto', 'parede', 'corTeto', 'rep', 'modo', 'racha']) M.aCx[kk].needsUpdate = true;
    // cacos de vidro saindo das janelas e brilhos
    const vidro = materialDe(M.R.tema, ob.peca) === 'vidro';
    const nC = Math.min(26, Math.round((vidro ? 10 : 4) + v.h * (vidro ? 1.6 : 0.6)));
    for (let k = 0; k < nC; k++) {
      const ang = Math.random() * Math.PI * 2;
      const hh = 0.3 + Math.random() * (v.h - 0.3);
      lp.set(Math.cos(ang) * v.a * 1.02, hh, Math.sin(ang) * v.a * 1.02).applyQuaternion(Q0).add(P0);
      const vf = 1 + Math.random() * 1.6;
      soltar(PART.caco, lp.x, lp.y, lp.z, Math.cos(ang) * vf, 0.6 + Math.random() * 1.8, Math.sin(ang) * vf, 0.9 + Math.random() * 0.5, 0.14 + Math.random() * 0.14, 0.12, Math.random() < 0.5 ? '#d8f4ff' : '#ffffff', 1, 13, 0.4);
      if (k % 4 === 0) soltar(PART.brilho, lp.x, lp.y, lp.z, 0, 0.2, 0, 0.35, 0.35, 0.05, '#ffffff', 1, 0, 0);
    }
    // poeira levantando em volta da base, so do lado de fora da boca (dentro ela vira neblina cinza no breu)
    const ct = M.ct;
    const rvb = buracos[b.id] ? buracos[b.id].rv : b.r;
    const nP = Math.min(20, 10 + Math.round(s * 3));
    for (let k = 0; k < nP; k++) {
      const ang = (k / nP) * Math.PI * 2 + Math.random() * 0.3;
      const rr = v.a * 1.2;
      const px = ob.x + Math.cos(ang) * rr;
      const pz = ob.z + Math.sin(ang) * rr;
      if (Math.hypot(px - b.x, pz - b.z) < rvb * 1.05) continue;
      const vf = 0.6 + Math.random() * 0.7;
      soltar(PART.poeira, px, 0.2, pz, Math.cos(ang) * vf, 0.3 + Math.random() * 0.4, Math.sin(ang) * vf, 1.2 + Math.random() * 0.5, 0.4 + s * 0.1, 1.0 + s * 0.3, ct.poeira, 0.7, 0, 1.4);
    }
    // tremor rapido (so o do jogador ou um predio perto da camera)
    if (b.id === foco || Math.hypot(ob.x - camAlvo.x, ob.z - camAlvo.z) < camDist * 0.6) tremer(Math.min(0.42, 0.1 + s * 0.08));
  }

  /** Caquinhos e poeira saindo de um predio que esta rachando em cima da boca. */
  function entulhoDaRacha(ob, v) {
    const ang = Math.random() * Math.PI * 2;
    const hh = Math.random() * v.h * Math.min(1, 0.4 + ob.dano);
    const x = ob.x + Math.cos(ang) * v.a * 1.02;
    const z = ob.z + Math.sin(ang) * v.a * 1.02;
    const cor = M.ct.pedra[Math.floor(Math.random() * M.ct.pedra.length)];
    soltar(Math.random() < 0.5 ? PART.bloco : PART.pedra, x, hh, z, Math.cos(ang) * 0.4, 0.3, Math.sin(ang) * 0.4, 1.2, 0.1 + Math.random() * 0.12, 0.1, cor, 1, 14);
    if (Math.random() < 0.3) soltar(PART.poeira, x, 0.2, z, Math.cos(ang) * 0.4, 0.3, Math.sin(ang) * 0.4, 0.9, 0.3, 1.0, M.ct.poeira, 0.6, 0, 1.6);
  }

  /** Fisica dos pedacos de predio: gravidade, puxados para o centro da boca, sem atravessar o asfalto. */
  function passoPedacos(dt) {
    if (!M.pedacos.length) return;
    const R = M.R;
    let mudouC = false;
    let mudouT = false;
    for (const p of M.pedacos) {
      if (!p.vivo) continue;
      p.t += dt;
      const b = R.buracos[p.dono];
      const vb = buracos[p.dono];
      const rv = vb ? Math.max(0.3, vb.rv) : 1;
      if (b && b.vivo) {
        p.hx = b.x;
        p.hz = b.z;
      }
      p.vy -= 20 * dt;
      // puxado para o centro da boca (relativo ao buraco)
      let d = Math.hypot(p.ox, p.oz);
      if (d > 0.02) {
        const acc = 9 * Math.min(1.2, d / rv);
        p.vx -= (p.ox / d) * acc * dt;
        p.vz -= (p.oz / d) * acc * dt;
      }
      const ar = Math.exp(-dt * 0.9);
      p.vx *= ar;
      p.vz *= ar;
      p.ox += p.vx * dt;
      p.y += p.vy * dt;
      p.oz += p.vz * dt;
      d = Math.hypot(p.ox, p.oz);
      const meia = Math.hypot(p.sx, p.sz) * 0.5;
      // com o centro fora da boca nao afunda no asfalto: fica no chao (e a puxada leva para dentro); com o centro
      // dentro, afunda cortado pelo plano do chao
      if (p.y < 0 && d > rv && p.y > -0.6) {
        p.y = 0;
        p.vy = Math.max(0, -p.vy * 0.15);
      }
      // dentro do tubo: a parede segura
      const dMax = Math.max(0, rv - meia * 0.6);
      if (p.y < -0.4 && d > dMax && d > 0) {
        const k = dMax / d;
        p.ox *= k;
        p.oz *= k;
        p.vx *= 0.5;
        p.vz *= 0.5;
      }
      p.x = p.hx + p.ox;
      p.z = p.hz + p.oz;
      const wl = p.w.length();
      if (wl > 1e-4) {
        tmpQ2.setFromAxisAngle(tmpV.copy(p.w).divideScalar(wl), wl * dt);
        p.q.premultiply(tmpQ2);
      }
      p.w.multiplyScalar(Math.exp(-dt * 0.25));
      // ao entrar na boca o pedaco aperta para caber (sem atravessar o asfalto da borda)
      const caber = Math.min(1, (rv * 0.82) / Math.max(0.01, meia));
      const kk = Math.max(0, Math.min(1, (0.3 - p.y) / 1.3));
      const sq = 1 + (caber - 1) * kk;
      const esc = Math.max(0.04, Math.min(1, Math.exp(p.y * 0.32)));
      const fim = p.y < -8 || p.t > 4;
      if (fim) {
        p.vivo = false;
        tmpM.makeScale(0, 0, 0);
      } else tmpM.compose(tmpP.set(p.x, p.y, p.z), p.q, tmpS.set(p.sx * sq, p.sy, p.sz * sq));
      if (p.ti >= 0) {
        M.telhados.setMatrixAt(p.ti, tmpM);
        M.aTl.esc.setX(p.ti, esc);
        mudouT = true;
        if (fim) M.livresT.push(p.ti);
      } else {
        M.caixas.setMatrixAt(p.i, tmpM);
        M.aCx.esc.setX(p.i, esc);
        mudouC = true;
        if (fim && !p.proprio) M.livresC.push(p.i);
      }
    }
    if (mudouC) {
      M.caixas.instanceMatrix.needsUpdate = true;
      M.aCx.esc.needsUpdate = true;
    }
    if (mudouT) {
      M.telhados.instanceMatrix.needsUpdate = true;
      M.aTl.esc.needsUpdate = true;
    }
    if (M.pedacos.length > 40) M.pedacos = M.pedacos.filter((p) => p.vivo);
  }

  /**
   * O buraco cresceu um degrau: o raio passa do ponto e assenta (mola), o asfalto racha e esfarela para dentro
   * (lascas e poeira caindo na boca), uma onda corre pelo chao levantando as pecas e a camera afasta um pouco.
   * @param {number} id buraco
   */
  function crescer(id) {
    if (!M) return;
    const b = M.R.buracos[id];
    const vb = buracos[id];
    if (!b || !vb || !b.vivo) return;
    const perto = Math.abs(b.x - camAlvo.x) < camDist * 1.2 && Math.abs(b.z - camAlvo.z) < camDist * 1.2;
    vb.rvv += Math.max(1.2, b.r * 1.7);
    vb.gole = 1;
    vb.rachaT = 0;
    vb.racha.rotation.y = Math.random() * Math.PI * 2;
    if (!perto) return;
    const ct = M.ct;
    const rv = Math.max(vb.rv, b.r);
    const n = Math.min(40, 14 + Math.round(b.r * 4));
    for (let k = 0; k < n; k++) {
      const a = Math.random() * Math.PI * 2;
      const rr = rv * (1.02 + Math.random() * 0.22);
      const vf = 1.0 + Math.random() * 1.4;
      const tam = (0.16 + Math.random() * 0.2) * (0.8 + b.r * 0.1);
      soltar(PART.lasca, b.x + Math.cos(a) * rr, 0.05, b.z + Math.sin(a) * rr, -Math.cos(a) * vf, 0.5 + Math.random() * 1.2, -Math.sin(a) * vf, 1.6, tam, tam * 0.8, ct.lasca[k % ct.lasca.length], 1, 14);
    }
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2 + Math.random() * 0.4;
      const rr = rv * 1.25 + 0.2;
      soltar(PART.poeira, b.x + Math.cos(a) * rr, 0.12, b.z + Math.sin(a) * rr, Math.cos(a) * 1.0, 0.3, Math.sin(a) * 1.0, 1.0, 0.35 + rv * 0.06, 0.8 + rv * 0.14, ct.poeira, 0.55, 0, 1.6);
    }
    if (id === focoAtual) {
      M.onda = { x: b.x, z: b.z, t0: tempo, r0: rv * 1.05, v: 9 + b.r * 1.6, dur: 0.9, frente: rv, amp: 0.42 };
      pulso(b.x, b.z, rv * 1.05, rv * 1.05 + 0.9 * (9 + b.r * 1.6), ct.onda, 0.9, -1);
      camExtra = Math.max(camExtra, 1.4 + b.r * 0.45);
      tremer(0.14);
    }
  }

  const distanciaCamera = (/** @type {number} */ r) => {
    const asp = camera.aspect || 1;
    const retrato = Math.pow(Math.max(1, 1.0 / asp), 0.7);
    return (14 + r * 4.9) * retrato;
  };

  /**
   * Atualiza a cena pelo estado da rodada.
   * @param {number} dt tempo real do quadro (s)
   * @param {number} t relogio do jogo (s)
   * @param {{ foco?: number }} [op]
   */
  function atualizar(dt, t, op = {}) {
    if (!M) return;
    const R = M.R;
    tempo += dt;
    const foco = op.foco ?? 0;
    focoAtual = foco;
    // pecas novas (o gigante)
    for (let id = M.vis.length; id < R.objetos.length; id++) registrar(R.objetos[id]);

    // raio visivel dos buracos (mola: cresce com um leve passar do ponto) e borda que incha ao engolir
    for (const b of R.buracos) {
      const vb = buracos[b.id];
      if (!vb) continue;
      if (b.vivo && (!vb.vivoAnt || vb.rv <= 0)) {
        vb.rv = b.r;
        vb.rvv = 0;
      }
      vb.vivoAnt = b.vivo;
      if (b.vivo) {
        const k = 170;
        const c = 2 * 0.42 * Math.sqrt(k);
        vb.rvv += (k * (b.r - vb.rv) - c * vb.rvv) * Math.min(dt, 0.05);
        vb.rv += vb.rvv * Math.min(dt, 0.05);
      }
      vb.gole *= Math.exp(-dt * 4.5);
    }

    // inclinacao na borda (antes de cair) e balanco do que nao cabe
    const ant = M.preAnt;
    M.preAnt = M.pre;
    M.pre = ant;
    M.pre.clear();
    for (const b of R.buracos) {
      if (!b.vivo) continue;
      const rv = buracos[b.id] ? buracos[b.id].rv : b.r;
      R.grade.perto(b.x, b.z, rv + 4.5, (id) => {
        const ob = R.objetos[id];
        if (ob.estado !== 0) return;
        const s = ob.peca.s;
        const dx = ob.x - b.x;
        const dz = ob.z - b.z;
        const d = Math.hypot(dx, dz) || 1e-4;
        if (s < b.r * CABE) {
          const over = Math.max(0, Math.min(1, (rv + s * 0.6 - d) / (s * 1.0 + 0.2)));
          if (over <= 0) return;
          const atual = M.pre.get(id);
          if (atual && atual.a >= over * 0.3) return;
          M.pre.set(id, { a: over * 0.3, eixo: Math.atan2(dz, dx), dx: (-dx / d) * over * 0.12, dz: (-dz / d) * over * 0.12, dy: -over * 0.04 });
        } else if (d < rv + s * 0.35) {
          // grande demais: balanca para a boca, e quanto mais racha mais pende e afunda
          const dn = ob.dano || 0;
          const a = (0.045 + 0.11 * dn) * (0.65 + 0.35 * Math.sin(t * (8 + dn * 5) + id));
          M.pre.set(id, { a, eixo: Math.atan2(dz, dx), dx: (-dx / d) * dn * 0.12, dz: (-dz / d) * dn * 0.12, dy: -dn * 0.12 });
        }
      });
    }

    // pecas: o que anda, o que cai, o que inclina; pessoas longe da camera ficam paradas no visual
    const raioVista = camDist * 1.35 + 8;
    const vistos = new Set();
    const ver = (ob) => {
      if (vistos.has(ob.id)) return;
      vistos.add(ob.id);
      const v = M.vis[ob.id];
      if (!v || v.oculto) return;
      if (ob.estado === 1 && !v.caindo) {
        v.caindo = true;
        const b = R.buracos[ob.dono];
        if (b) {
          poeiraDaQueda(ob, b);
          const vb = buracos[b.id];
          if (vb) {
            vb.gole = Math.min(1, vb.gole + ob.peca.s * 0.22);
            // respira: cada peca engolida empurra a borda um tiquinho para fora (a mola assenta)
            vb.rvv += Math.min(1.1, 0.22 + ob.peca.s * 0.5);
          }
          if (b.id === foco && ob.peca.s >= 1.2) tremer(Math.min(0.34, 0.05 + ob.peca.s * 0.055));
        }
      }
      // predio: tomba inteiro na borda (fora do raio X) e se parte quando passa do ponto
      if (v.tipo === 'c' && ob.estado === 1 && !v.semRaio) {
        v.semRaio = true;
        M.aCx.modo.setX(v.i, 3);
        M.aCx.modo.needsUpdate = true;
        if (v.telhado >= 0) {
          M.aTl.modo.setX(v.telhado, 3);
          M.aTl.modo.needsUpdate = true;
        }
      }
      if (v.tipo === 'c' && ob.estado === 1 && !v.quebrado && (ob.incl > 0.62 || ob.y < -0.02)) quebrar(ob, v, foco);
      // rachando (grande demais com a boca embaixo): desenho da rachadura e caquinhos caindo
      if (v.tipo === 'c' && ob.estado === 0) {
        const dn = Math.min(0.999, ob.dano || 0);
        if (Math.abs((v.dn || 0) - dn) > 0.01) {
          v.dn = dn;
          M.aCx.racha.setX(v.i, (ob.id % 89) + dn);
          M.aCx.racha.needsUpdate = true;
        }
        if (dn > 0.2 && Math.random() < dt * (3 + dn * 12)) entulhoDaRacha(ob, v);
        if (dn > 0) M.rachados.add(ob.id);
        else M.rachados.delete(ob.id);
      }
      // o gigante bate no chao: nuvem de poeira e tremor se estiver perto
      if (ob.nasceu >= 0 && !v.pousou && R.t - ob.nasceu >= 0.9) {
        v.pousou = true;
        nuvem(ob.x, ob.z, ob.peca.s * 0.8);
        if (Math.hypot(ob.x - camAlvo.x, ob.z - camAlvo.z) < camDist) tremer(0.3);
      }
      pousar(ob, t);
    };
    for (const id of M.mov) {
      const ob = R.objetos[id];
      if (ob.estado !== 0 || Math.abs(ob.x - camAlvo.x) < raioVista && Math.abs(ob.z - camAlvo.z) < raioVista) ver(ob);
    }
    for (const id of M.pre.keys()) ver(R.objetos[id]);
    for (const id of M.preAnt.keys()) ver(R.objetos[id]);
    for (const id of M.rachados) ver(R.objetos[id]);
    for (const ob of R.objetos) {
      if (ob.estado === 0 && ob.treme <= 0 && !M.vis[ob.id]?.tremia) continue;
      const v = M.vis[ob.id];
      if (!v || v.oculto) continue;
      ver(ob);
      v.tremia = ob.treme > 0;
    }

    // onda do crescimento: quem esta na frente da onda pula; quem pulou no quadro anterior volta ao chao
    if (M.onda) {
      const o = M.onda;
      const el = tempo - o.t0;
      o.frente = o.r0 + o.v * el;
      o.amp = 0.42 * Math.max(0, 1 - el / o.dur);
      const ant = M.ondaAnt;
      M.ondaAnt = new Set();
      if (o.amp <= 0) M.onda = null;
      else {
        const fora = o.frente + 1.3;
        const dentro = Math.max(0, o.frente - 1.3);
        R.grade.perto(o.x, o.z, fora, (id) => {
          const ob = R.objetos[id];
          if (ob.estado !== 0) return;
          const d = Math.hypot(ob.x - o.x, ob.z - o.z);
          if (d > dentro && d < fora) ver(ob);
        });
      }
      for (const id of ant) if (!M.ondaAnt.has(id)) ver(R.objetos[id]);
    }
    passoPedacos(dt);

    // buracos (os visuais sem buraco nesta rodada ficam escondidos)
    for (let i = R.buracos.length; i < buracos.length; i++) buracos[i].grupo.visible = false;
    let k = 0;
    for (const b of R.buracos) {
      const vb = buracos[b.id];
      if (!vb) continue;
      let r = vb.rv;
      const x = b.x;
      const z = b.z;
      let vis = b.vivo;
      if (!b.vivo && !b.fora && b.renasce <= 0) vis = false;
      if (!b.vivo) {
        // encolhe onde foi engolido
        const e = Math.max(0, 1 - (R.t - b.morreuEm) / 0.35);
        if (e > 0) {
          vis = true;
          r = b.r * e;
        }
      }
      vb.grupo.visible = vis && r > 0.02;
      if (!vb.grupo.visible) continue;
      if (vb.skin !== b.skin) {
        vb.skin = b.skin;
        const mat = vb.mat;
        const ml = vb.matLabio;
        texturaSkin(b.skin).then((tx) => {
          mat.map = tx;
          mat.needsUpdate = true;
          ml.map = tx;
          ml.needsUpdate = true;
        }).catch(() => {});
      }
      const prof = Math.max(4, r * 2.6);
      vb.grupo.position.set(x, 0, z);
      vb.borda.scale.set(r, r, r);
      vb.borda.position.y = 0.03;
      vb.labio.scale.set(r * 1.005, 0.22 + r * 0.05, r * 1.005);
      vb.labio.position.y = 0.03;
      vb.tubo.scale.set(r, prof, r);
      vb.fundo.scale.set(r, 1, r);
      vb.fundo.position.y = -prof;
      vb.anel.scale.set(r, 1, r);
      vb.anel.position.y = 0.024;
      // rachaduras do crescimento: aparecem rapido e somem devagar
      if (vb.rachaT >= 0) {
        vb.rachaT += dt;
        const f = vb.rachaT;
        const op = f < 0.08 ? f / 0.08 : Math.max(0, 1 - (f - 0.7) / 1.1);
        vb.racha.visible = op > 0;
        /** @type {any} */ (vb.racha.material).opacity = op * 0.9;
        vb.racha.scale.set(r, 1, r);
        vb.racha.position.y = 0.026;
        if (op <= 0 && f > 0.7) vb.rachaT = -1;
      } else vb.racha.visible = false;
      vb.uni.uT.value = tempo + b.id * 1.7;
      vb.uni.uGole.value = vb.gole;
      // escudo: pisca
      vb.borda.visible = !(b.escudo > 0 && Math.floor(t * 8) % 2 === 0);
      if (k < MAX_BURACOS) uniBuracos.value[k++].set(x, z, r);
      // a borda esfarela quando o buraco anda: pedrinhas caem na boca pela frente
      const vel = Math.hypot(b.vx, b.vz);
      if (b.vivo && vel > 1.5 && Math.abs(x - camAlvo.x) < raioVista && Math.abs(z - camAlvo.z) < raioVista) {
        vb.acc += dt * vel * (0.5 + r * 0.45);
        while (vb.acc >= 1) {
          vb.acc -= 1;
          const a = Math.atan2(b.vz, b.vx) + (Math.random() - 0.5) * 1.8;
          const ct = M.ct;
          soltar(1, x + Math.cos(a) * r * 1.02, 0.06, z + Math.sin(a) * r * 1.02, -Math.cos(a) * 0.6 + b.vx * 0.3, 0.6 + Math.random(), -Math.sin(a) * 0.6 + b.vz * 0.3, 1.4, 0.07 + Math.random() * 0.08, 0.07, ct.pedra[Math.floor(Math.random() * ct.pedra.length)], 1, 14);
        }
      }
    }
    for (; k < MAX_BURACOS; k++) uniBuracos.value[k].set(0, 0, -1);
    // agua e calda em volta andam devagar
    if (M.texFora) M.texFora.offset.set(tempo * 0.012, tempo * 0.006);
    // pulsos
    for (const p of pulsos) {
      if (!p.m.visible) continue;
      p.t += dt;
      const f = p.t / p.dur;
      if (f >= 1) {
        p.m.visible = false;
        continue;
      }
      const dono = p.dono >= 0 ? R.buracos[p.dono] : null;
      if (dono) p.m.position.set(dono.x, 0.03, dono.z);
      const r = p.r0 + (p.r1 - p.r0) * f;
      p.m.scale.set(r, 1, r);
      /** @type {any} */ (p.m.material).opacity = (1 - f) * 0.8;
    }
    // particulas
    let mudou = false;
    for (let i = 0; i < MAX_PART; i++) {
      const p = P[i];
      if (!p.viva) continue;
      mudou = true;
      p.t += dt;
      if (p.t >= p.dur || p.y < -6) {
        p.viva = false;
        part.setMatrixAt(i, tmpM.makeScale(0, 0, 0));
        continue;
      }
      const ar = Math.exp(-p.arrasto * dt);
      p.vx *= ar;
      p.vz *= ar;
      p.vy = p.vy * ar - p.g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      const f = p.t / p.dur;
      const tam = p.t0 + (p.t1 - p.t0) * f;
      // pedrinha, lasca, caco e entulho escurecem e somem com a profundidade; o resto esmaece no fim
      const solido = p.cel === PART.pedra || p.cel === PART.lasca || p.cel === PART.caco || p.cel === PART.bloco;
      const alfa = solido ? Math.max(0.05, Math.min(1, Math.exp(p.y * 0.4))) * (1 - Math.pow(f, 6)) : p.a * (1 - f * f);
      aCorP.setW(i, alfa);
      tmpM.compose(tmpP.set(p.x, p.y, p.z), qBill, tmpS.set(tam, tam, tam));
      part.setMatrixAt(i, tmpM);
    }
    if (mudou) {
      part.instanceMatrix.needsUpdate = true;
      aCorP.needsUpdate = true;
    }
    // camera segue o foco (com tremor curto)
    const eu = R.buracos[foco];
    camExtra *= Math.exp(-dt * 0.9);
    const alvoD = distanciaCamera(buracos[foco] ? Math.max(eu.r, buracos[foco].rv) : eu.r) + camExtra;
    const kk = 1 - Math.exp(-dt * 6);
    camAlvo.x += (eu.x - camAlvo.x) * kk;
    camAlvo.z += (eu.z - camAlvo.z) * kk;
    camDist += (alvoD - camDist) * (1 - Math.exp(-dt * 2));
    tremor *= Math.exp(-dt * 7);
    const tx = tremor > 0.002 ? Math.sin(tempo * 47) * tremor : 0;
    const tz = tremor > 0.002 ? Math.cos(tempo * 41 + 1.3) * tremor : 0;
    camera.position.set(camAlvo.x + tx, camDist * Math.sin(PITCH) + tz * 0.5, camAlvo.z + camDist * Math.cos(PITCH) + tz);
    camera.lookAt(camAlvo.x + tx * 0.6, 0, camAlvo.z + tz * 0.6);
    camera.updateMatrixWorld();
    // raio X em volta do buraco do jogador (px do framebuffer, origem embaixo)
    if (eu.vivo) {
      const dpr = renderer.getPixelRatio();
      const r = buracos[foco] ? buracos[foco].rv : eu.r;
      const c = v3.set(eu.x, 0, eu.z).project(camera);
      const cx = (c.x * 0.5 + 0.5) * W * dpr;
      const cy = (c.y * 0.5 + 0.5) * H * dpr;
      const b = v3.set(eu.x + r * 1.5 + 0.6, 0, eu.z).project(camera);
      const rp = Math.abs((b.x * 0.5 + 0.5) * W * dpr - cx);
      uniFuro.uFuro.value.set(cx, cy, rp);
      uniFuro.uFuroZ.value = v3.set(eu.x, 0, eu.z + r).applyMatrix4(camera.matrixWorldInverse).z;
    } else uniFuro.uFuro.value.z = -1;
  }

  /** Tremor curto de camera (forca em unidades do mundo). */
  function tremer(forca = 0.15) {
    tremor = Math.max(tremor, forca);
  }

  /** Pulso de luz no chao. */
  function pulso(x, z, r0, r1, cor = 0xffffff, dur = 0.6, dono = -1) {
    const p = pulsos.find((q) => !q.m.visible) || pulsos[0];
    p.m.visible = true;
    p.t = 0;
    p.dur = dur;
    p.r0 = r0;
    p.r1 = r1;
    p.dono = dono;
    p.m.position.set(x, 0.03, z);
    /** @type {any} */ (p.m.material).color.set(cor);
  }

  /** Nuvem de poeira grande (buraco engolido, gigante caindo). */
  function nuvem(x, z, raio) {
    if (!M) return;
    const n = 16;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2;
      soltar(0, x + Math.cos(a) * raio, 0.2, z + Math.sin(a) * raio, Math.cos(a) * 1.6, 0.6, Math.sin(a) * 1.6, 1.0, raio * 0.4 + 0.4, raio * 0.6 + 1.2, M.ct.poeira, 0.8, 0, 2);
    }
  }

  /** Posicao na tela (px CSS) de um ponto do mundo. */
  const v3 = new THREE.Vector3();
  let W = 1;
  let H = 1;
  function projetar(x, y, z) {
    v3.set(x, y, z).project(camera);
    return { x: (v3.x * 0.5 + 0.5) * W, y: (-v3.y * 0.5 + 0.5) * H, dentro: v3.z < 1 && Math.abs(v3.x) <= 1 && Math.abs(v3.y) <= 1, nx: v3.x, ny: v3.y };
  }

  /** @param {number} w @param {number} h @param {number} dpr */
  function medir(w, h, dpr) {
    W = w;
    H = h;
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  return {
    renderer,
    camera,
    cena,
    montar,
    atualizar,
    pulso,
    tremer,
    nuvem,
    crescer,
    projetar,
    medir,
    desenhar() { renderer.render(cena, camera); },
    get montada() { return !!M; },
    /** quantos buracos estao desenhados agora (provas: nenhum fantasma de rodada anterior) */
    get buracosVisiveis() { return buracos.filter((b) => b.grupo.visible).length; },
    /** estado interno (so para depurar em localhost) */
    get interno() { return M; },
  };
}
