#!/usr/bin/env node
// Processa toda a arte do jogo de arte/bruto/ (Grok) para src/arte/ (WebP), sempre igual:
//   sprites   grades em fundo chapado -> src/arte/sprites/<grade>-NN.webp (200 a 512 px, com contorno)
//   vida      pessoas: 9 quadros cada (andar 1-4, correr 5-6, susto 7, aceno 8, queda 9), mesma escala
//   fachadas  grades de paredes -> src/arte/fachadas/<grade>-NN.webp (as casas de doce so a parede)
//   skins     amostras de padrao -> src/arte/skins/skin-NN.webp (faixa 256x64 sem emenda)
//   icones    grade -> src/arte/icones/<nome>.webp (128)
// Uso: node tools/arte.mjs [grupo...]   (sem grupo: tudo)
import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = new URL('..', import.meta.url).pathname;
const TMP = join(RAIZ, '.tmp/arte');
const sprite = (...a) => execFileSync('node', [join(RAIZ, 'tools/sprite.mjs'), ...a], { cwd: RAIZ, stdio: ['ignore', 'pipe', 'inherit'] }).toString();
const ff = (...a) => execFileSync('ffmpeg', ['-loglevel', 'error', '-y', ...a], { cwd: RAIZ });
const limpar = (d) => { rmSync(d, { recursive: true, force: true }); mkdirSync(d, { recursive: true }); };
const pedidos = process.argv.slice(2);
const quer = (g) => !pedidos.length || pedidos.includes(g);

/** Recorta uma grade e devolve os PNG separados (na ordem de leitura). */
function separar(grade, extra = []) {
  const d = join(TMP, grade);
  limpar(d);
  sprite('recortar', `arte/bruto/${grade}.jpg`, `${d}/`, '--separar', `--nome=${grade}`, '--tol=0.075', '--suave=0.05', ...extra);
  return readdirSync(d).filter((n) => n.endsWith('.png')).sort().map((n) => join(d, n));
}

/**
 * O Grok pinta a sombra de contato com a cor do fundo (carmim): na base do sprite, pixel escuro e
 * saturado na faixa do magenta vira sombra neutra (os objetos rosa e lilas ficam: so a base e so o escuro).
 */
function neutralizarSombra(png) {
  const [w, h] = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', png]).toString().trim().split(',').map(Number);
  const px = execFileSync('ffmpeg', ['-loglevel', 'error', '-i', png, '-f', 'rawvideo', '-pix_fmt', 'rgba', '-'], { maxBuffer: 1 << 28 });
  // base = ultimo terco das linhas com pixel visivel
  let topo = h;
  let fundo = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (px[(y * w + x) * 4 + 3] > 20) { topo = Math.min(topo, y); fundo = Math.max(fundo, y); }
  const corte = fundo - (fundo - topo) * 0.32;
  let n = 0;
  for (let y = Math.max(0, Math.floor(corte)); y <= fundo; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const r = px[i], g = px[i + 1], b = px[i + 2];
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
      if (px[i + 3] < 10 || mx === 0) continue;
      const sat = (mx - mn) / mx;
      let hue = 0;
      if (mx === r) hue = (60 * ((g - b) / (mx - mn || 1)) + 360) % 360;
      else if (mx === b) hue = 60 * ((r - g) / (mx - mn || 1)) + 240;
      else hue = 60 * ((b - r) / (mx - mn || 1)) + 120;
      if (mx < 175 && sat > 0.4 && hue >= 300 && hue <= 352) {
        const l = Math.round((r + g + b) / 3 * 0.55);
        px[i] = l + 6; px[i + 1] = l; px[i + 2] = l + 10;
        px[i + 3] = Math.round(px[i + 3] * 0.8);
        n++;
      }
    }
  }
  if (n) execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${w}x${h}`, '-i', '-', png], { input: px });
  return n;
}

function webp(png, saida, largura) {
  sprite('reduzir', png, saida, ...(largura ? [`--largura=${largura}`] : []), '--q=84');
}

/** Tamanho (w h) de uma imagem. */
function medida(img) {
  return execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', img]).toString().trim().split(',').map(Number);
}

/** Redimensiona um PNG com alfa (lanczos). */
function escalar(png, saida, largura) {
  ff('-i', png, '-vf', `scale=${Math.max(8, Math.round(largura))}:-1:flags=lanczos,format=rgba`, saida);
}

/**
 * Contorno desenhado no codigo (v0.2.0): um traco lilas escuro em volta do sprite, de largura fixa em pixels,
 * por baixo do desenho. Une as pecas do Grok num estilo so (adesivo de brinquedo) e tira a "cara de IA" do
 * contorno macio que se perde no chao.
 */
function contornar(png, raio = 3, cor = [43, 34, 64], forca = 0.9) {
  const [w0, h0] = medida(png);
  const src = execFileSync('ffmpeg', ['-loglevel', 'error', '-i', png, '-f', 'rawvideo', '-pix_fmt', 'rgba', '-'], { maxBuffer: 1 << 28 });
  const m = raio + 1;
  const w = w0 + 2 * m;
  const h = h0 + 2 * m;
  const a = new Uint8Array(w * h);
  for (let y = 0; y < h0; y++) for (let x = 0; x < w0; x++) a[(y + m) * w + x + m] = src[(y * w0 + x) * 4 + 3];
  const off = [];
  for (let dy = -raio; dy <= raio; dy++) for (let dx = -raio; dx <= raio; dx++) if (dx * dx + dy * dy <= raio * raio + raio * 0.6) off.push(dy * w + dx);
  const out = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      let d = 0;
      if (x >= raio && y >= raio && x < w - raio && y < h - raio) {
        for (const o of off) { const v = a[i + o]; if (v > d) { d = v; if (d === 255) break; } }
      }
      const oa = (d / 255) * forca;
      const sx = x - m;
      const sy = y - m;
      let r = 0, g = 0, b = 0, sa = 0;
      if (sx >= 0 && sy >= 0 && sx < w0 && sy < h0) {
        const j = (sy * w0 + sx) * 4;
        r = src[j]; g = src[j + 1]; b = src[j + 2]; sa = src[j + 3] / 255;
      }
      const ta = sa + oa * (1 - sa);
      const k = i * 4;
      if (ta <= 0) continue;
      out[k] = Math.round((r * sa + cor[0] * oa * (1 - sa)) / ta);
      out[k + 1] = Math.round((g * sa + cor[1] * oa * (1 - sa)) / ta);
      out[k + 2] = Math.round((b * sa + cor[2] * oa * (1 - sa)) / ta);
      out[k + 3] = Math.round(ta * 255);
    }
  }
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${w}x${h}`, '-i', '-', png], { input: out });
}

/** Sprite pronto: escala, contorno e WebP. */
function sprite1(png, saida, largura, raio = 3) {
  const e = png.replace(/\.png$/, '-e.png');
  escalar(png, e, largura);
  contornar(e, raio);
  webp(e, saida);
}

// ------------------------------------------------------------------ sprites
if (quer('sprites')) {
  const dest = join(RAIZ, 'src/arte/sprites');
  limpar(dest);
  /** grade, quantos objetos, largura final, recorta sombra carmim? */
  const grades = [
    ['cid-props', 9, 200, true], ['cid-props2', 9, 200, true], ['cid-nat', 9, 256, true],
    ['pra-props', 9, 200, true], ['pra-props2', 9, 200, true], ['pra-med', 9, 256, true],
    ['doc-props', 9, 200, false], ['doc-props2', 9, 200, false], ['doc-med', 9, 256, false],
    ['cid-marcos', 4, 420, true], ['pra-marcos', 4, 420, true], ['doc-marcos', 4, 420, false],
    ['gigantes', 3, 512, false],
  ];
  for (const [g, esperado, largura, sombra] of grades) {
    const lista = separar(g);
    if (lista.length !== esperado) throw new Error(`${g}: ${lista.length} objetos (esperava ${esperado})`);
    lista.forEach((p, i) => {
      if (sombra) neutralizarSombra(p);
      sprite1(p, join(dest, `${g}-${String(i + 1).padStart(2, '0')}.webp`), largura, largura >= 400 ? 4 : 3);
    });
    process.stdout.write(`sprites ${g}: ${lista.length}\n`);
  }
}

// ------------------------------------------------------------------ pessoas animadas (9 quadros na mesma escala)
if (quer('sprites') || quer('vida')) {
  const dest = join(RAIZ, 'src/arte/sprites');
  mkdirSync(dest, { recursive: true });
  /** folha do Grok -> nome no jogo (a mulher foi refeita: a primeira trocava a cor da blusa a cada quadro) */
  const folhas = {
    'vida-menino': 'vida-menino', 'vida-menina': 'vida-menina', 'vida-homem': 'vida-homem', 'vida-mulher-b': 'vida-mulher',
    'vida-vovo': 'vida-vovo', 'vida-chef': 'vida-chef', 'vida-banhista': 'vida-banhista', 'vida-turista': 'vida-turista',
    'vida-ursinho': 'vida-ursinho', 'vida-biscoito': 'vida-biscoito',
  };
  for (const [g, nome] of Object.entries(folhas)) {
    const lista = separar(g);
    if (lista.length !== 9) throw new Error(`${g}: ${lista.length} quadros (esperava 9)`);
    const doce = g === 'vida-ursinho' || g === 'vida-biscoito';
    // uma escala so para os 9 quadros (o quadro mais alto fica com 170 px): a pessoa nao muda de tamanho ao andar
    const alturas = lista.map((p) => medida(p)[1]);
    const f = 170 / Math.max(...alturas);
    lista.forEach((p, i) => {
      if (!doce) neutralizarSombra(p);
      sprite1(p, join(dest, `${nome}-${String(i + 1).padStart(2, '0')}.webp`), medida(p)[0] * f, 3);
    });
    process.stdout.write(`pessoa ${nome}: 9 quadros (escala ${f.toFixed(3)})\n`);
  }
}

// ------------------------------------------------------------------ fachadas
if (quer('fachadas')) {
  const dest = join(RAIZ, 'src/arte/fachadas');
  const destS = join(RAIZ, 'src/arte/sprites');
  limpar(dest);
  mkdirSync(destS, { recursive: true });
  for (const g of ['cid-fach', 'pra-fach', 'doc-fach', 'cid-fach2', 'pra-fach2', 'doc-fach2']) {
    const lista = separar(g);
    if (lista.length !== 9) throw new Error(`${g}: ${lista.length} objetos`);
    lista.forEach((p, i) => {
      const nome = `${g}-${String(i + 1).padStart(2, '0')}`;
      if (g === 'doc-fach' && (i === 6 || i === 8)) {
        // bolo de andares e torre de doce: silhueta que nao e caixa -> pecas em billboard (com contorno)
        sprite1(p, join(destS, `${nome}.webp`), 320, 3);
        return;
      }
      if ((g === 'doc-fach' && i <= 2) || (g === 'doc-fach2' && i === 2)) {
        // casas de doce que vieram com telhado desenhado: fica so a parede (metade de baixo)
        const c = join(TMP, `${nome}-parede.png`);
        ff('-i', p, '-vf', 'crop=iw*0.9:ih*0.5:iw*0.05:ih*0.48', c);
        webp(c, join(dest, `${nome}.webp`), 320);
        return;
      }
      webp(p, join(dest, `${nome}.webp`), 320);
    });
    process.stdout.write(`fachadas ${g}: 9\n`);
  }
}

// (v0.2.0) chao e telhados sao desenhados no codigo (src/render/texturas.js): sem textura generica repetida.

// ------------------------------------------------------------------ skins da borda
if (quer('skins')) {
  const dest = join(RAIZ, 'src/arte/skins');
  mkdirSync(dest, { recursive: true });
  let k = 0;
  for (const g of ['skins-1', 'skins-2']) {
    const pngs = separar(g);
    if (pngs.length !== 9) throw new Error(`${g}: ${pngs.length} amostras`);
    for (const p of pngs) {
      k++;
      // skins-1 tem um aro desenhado no meio: usa a faixa de cima; skins-2 e padrao puro: faixa do meio;
      // o arco-iris (18) e listrado na horizontal: a amostra inteira achatada
      const corte = k === 18 ? 'crop=iw*0.84:ih*0.84:iw*0.08:ih*0.08' : g === 'skins-1' ? 'crop=iw*0.8:ih*0.12:iw*0.1:ih*0.035' : 'crop=iw*0.84:ih*0.22:iw*0.08:ih*0.36';
      const f = join(TMP, `skin-${k}-faixa.png`);
      ff('-i', p, '-vf', `${corte},scale=256:64:flags=lanczos`, f);
      const s = join(TMP, `skin-${k}-sem.png`);
      sprite('costurar', f, s, '--banda=0.2');
      webp(s, join(dest, `skin-${String(k).padStart(2, '0')}.webp`));
    }
  }
  process.stdout.write(`skins: ${k}\n`);
}

// ------------------------------------------------------------------ icones
if (quer('icones')) {
  const dest = join(RAIZ, 'src/arte/icones');
  mkdirSync(dest, { recursive: true });
  const nomes = ['coroa', 'trofeu', 'estrela', 'presente', 'cadeado', 'relogio', 'luva', 'alvo', 'medalha'];
  const pngs = separar('icones');
  if (pngs.length !== 9) throw new Error(`icones: ${pngs.length}`);
  pngs.forEach((p, i) => webp(p, join(dest, `${nomes[i]}.webp`), 128));
  process.stdout.write('icones: 9\n');
}
