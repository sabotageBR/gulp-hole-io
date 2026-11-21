// Carga da arte (WebP do Grok, ja recortada em src/arte/) e montagem dos atlas por tema:
// - sprites: um atlas por tema (pecas, quadros das pessoas, marcos, gigante), empacotado em prateleiras;
// - fachadas: outro atlas por tema (os telhados e o chao sao desenhados no codigo: src/render/texturas.js);
// - skins da borda e icones: imagens soltas (a borda usa uma textura por buraco).
import * as THREE from 'three';
import { artesDoTema } from '../jogo/catalogo.js';

const BASE = 'src/arte/';

/** @type {Map<string, Promise<HTMLImageElement>>} */
const cacheImg = new Map();

/** @param {string} url */
export function carregarImagem(url) {
  let p = cacheImg.get(url);
  if (!p) {
    p = new Promise((ok, erro) => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => ok(img);
      img.onerror = () => erro(new Error(`arte faltando: ${url}`));
      img.src = url;
    });
    cacheImg.set(url, p);
  }
  return p;
}

/**
 * Carrega varias imagens com progresso.
 * @param {string[]} urls
 * @param {(f: number) => void} [progresso]
 */
export async function carregarTodas(urls, progresso) {
  let feitas = 0;
  return Promise.all(urls.map((u) => carregarImagem(u).then((img) => {
    feitas++;
    if (progresso) progresso(feitas / urls.length);
    return img;
  })));
}

/** Lista de tudo que um tema precisa (para carregar antes). @param {string} tema */
export function urlsDoTema(tema) {
  const a = artesDoTema(tema);
  return [...a.sprites.map((n) => `${BASE}sprites/${n}.webp`), ...a.fachadas.map((n) => `${BASE}fachadas/${n}.webp`)];
}

export const N_SKINS = 18;
export const urlSkin = (/** @type {number} */ k) => `${BASE}skins/skin-${String(k + 1).padStart(2, '0')}.webp`;
export const ICONES = ['coroa', 'trofeu', 'estrela', 'presente', 'cadeado', 'relogio', 'luva', 'alvo', 'medalha'];
export const urlIcone = (/** @type {string} */ n) => `${BASE}icones/${n}.webp`;

/**
 * Empacota imagens num atlas (prateleiras). Devolve a textura e o retangulo UV de cada nome.
 * @param {{ nome: string, img: HTMLImageElement }[]} itens
 * @param {number} [lado]
 */
function montarAtlas(itens, lado = 2048) {
  const tela = document.createElement('canvas');
  tela.width = lado;
  tela.height = lado;
  const g = /** @type {CanvasRenderingContext2D} */ (tela.getContext('2d'));
  const ordem = itens.slice().sort((a, b) => b.img.height - a.img.height);
  /** @type {Record<string, { u: number, v: number, w: number, h: number, aspecto: number, px: number, py: number }>} */
  const rets = {};
  const M = 4;
  let x = M;
  let y = M;
  let alturaFila = 0;
  // escala unica se nao couber (aparelho com atlas menor)
  let esc = 1;
  for (;;) {
    let xx = M;
    let yy = M;
    let af = 0;
    let cabe = true;
    for (const it of ordem) {
      const w = Math.ceil(it.img.width * esc);
      const h = Math.ceil(it.img.height * esc);
      if (xx + w + M > lado) {
        xx = M;
        yy += af + M;
        af = 0;
      }
      if (yy + h + M > lado) {
        cabe = false;
        break;
      }
      xx += w + M;
      af = Math.max(af, h);
    }
    if (cabe) break;
    esc *= 0.9;
  }
  for (const it of ordem) {
    const w = Math.ceil(it.img.width * esc);
    const h = Math.ceil(it.img.height * esc);
    if (x + w + M > lado) {
      x = M;
      y += alturaFila + M;
      alturaFila = 0;
    }
    g.drawImage(it.img, x, y, w, h);
    // repete a borda 1 px para fora (sem fio de outra imagem no mipmap)
    rets[it.nome] = { u: x / lado, v: 1 - (y + h) / lado, w: w / lado, h: h / lado, aspecto: it.img.width / it.img.height, px: it.img.width, py: it.img.height };
    x += w + M;
    alturaFila = Math.max(alturaFila, h);
  }
  const tex = new THREE.CanvasTexture(tela);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.needsUpdate = true;
  return { tex, rets, tela };
}

/** Textura que repete. @param {HTMLImageElement} img */
function texturaRepete(img) {
  const t = new THREE.Texture(img);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  t.needsUpdate = true;
  return t;
}

/** Cor media de um pedaco da imagem (gable das casas). @param {HTMLImageElement} img */
function corMedia(img, fx0 = 0.3, fy0 = 0.05, fx1 = 0.7, fy1 = 0.2) {
  const c = document.createElement('canvas');
  c.width = 8;
  c.height = 8;
  const g = /** @type {CanvasRenderingContext2D} */ (c.getContext('2d'));
  g.drawImage(img, img.width * fx0, img.height * fy0, img.width * (fx1 - fx0), img.height * (fy1 - fy0), 0, 0, 8, 8);
  const d = g.getImageData(0, 0, 8, 8).data;
  let r = 0;
  let gg = 0;
  let b = 0;
  let n = 0;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 200) continue;
    r += d[i];
    gg += d[i + 1];
    b += d[i + 2];
    n++;
  }
  n = n || 1;
  return new THREE.Color(r / n / 255, gg / n / 255, b / n / 255).convertSRGBToLinear();
}

/** @type {Map<string, any>} */
const temas = new Map();

/**
 * Monta (uma vez) os recursos de um tema. As imagens ja devem estar carregadas (ou carrega aqui).
 * @param {string} tema
 */
export async function recursosDoTema(tema) {
  if (temas.has(tema)) return temas.get(tema);
  const a = artesDoTema(tema);
  const sprites = await Promise.all(a.sprites.map(async (nome) => ({ nome, img: await carregarImagem(`${BASE}sprites/${nome}.webp`) })));
  const fachadas = await Promise.all(a.fachadas.map(async (nome) => ({ nome, img: await carregarImagem(`${BASE}fachadas/${nome}.webp`) })));
  const atlasSprites = montarAtlas(sprites);
  const atlasPredios = montarAtlas(fachadas);
  /** @type {Record<string, THREE.Color>} */
  const paredes = {};
  for (const f of fachadas) paredes[f.nome] = corMedia(f.img);
  const r = { tema, atlasSprites, atlasPredios, paredes };
  temas.set(tema, r);
  return r;
}

/** @type {Map<number, THREE.Texture>} */
const skins = new Map();
/** Textura da borda (skin k), repetida em volta do anel. @param {number} k */
export async function texturaSkin(k) {
  let t = skins.get(k);
  if (!t) {
    t = texturaRepete(await carregarImagem(urlSkin(k)));
    t.repeat.set(10, 1);
    skins.set(k, t);
  }
  return t;
}
