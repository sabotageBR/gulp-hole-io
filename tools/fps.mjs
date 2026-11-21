#!/usr/bin/env node
// Mede fps e custo do quadro no Chrome (headless com Metal, GPU real) com o piloto automatico jogando.
// Uso: node tools/fps.mjs [--tamanho=1280x720] [--escala=1] [--segundos=20] [--params="mapa=cidade&tamanho=3"]
//      (usa o codigo-fonte servido por tools/servir.mjs; nao precisa empacotar)
import { abrirChrome, espera } from './cdp.mjs';
import { servirLivre } from './servir.mjs';

const op = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, ...v] = a.replace(/^--/, '').split('='); return [k, v.join('=') || true]; }));
const [L, A] = String(op.tamanho || '1280x720').split('x').map(Number);
const srv = await servirLivre();
const ch = await abrirChrome({ largura: L, altura: A, escala: Number(op.escala || 1), toque: L < A, args: ['--use-angle=metal', '--ignore-gpu-blocklist'] });
try {
  await ch.ir(`${srv.url}/index.html?novo&semanuncio&auto&${op.params || ''}`, 4000);
  const amostras = [];
  const total = Number(op.segundos || 20);
  for (let s = 0; s < total; s += 2) {
    await espera(2000);
    amostras.push(await ch.avaliar('JSON.stringify({ ...__jogo.medidas, r: __jogo.raio })').then((x) => JSON.parse(x)));
  }
  const fps = amostras.map((a) => a.fps);
  const media = fps.reduce((a, b) => a + b, 0) / fps.length;
  process.stdout.write(`${L}x${A}@${op.escala || 1}: fps medio ${media.toFixed(1)} (min ${Math.min(...fps).toFixed(1)}), desenho ${amostras.at(-1).desenhoMs.toFixed(2)} ms, passo ${amostras.at(-1).passoMs.toFixed(3)} ms, ${amostras.at(-1).calls} draws, ${amostras.at(-1).tri} tri, raio final ${amostras.at(-1).r.toFixed(2)}\n`);
} finally {
  await ch.fechar();
  srv.fechar?.();
  process.exit(0);
}
