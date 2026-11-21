#!/usr/bin/env node
// Fotos do jogo rodando no Chrome headless com GPU (Metal), para conferir a olho sem o painel do navegador.
// Uso: node tools/olhar.mjs <saida-prefixo> [--tamanho=1280x720] [--escala=1] [--params="auto&mapa=praia"]
//      [--tempos=4,10,20] [--js="__jogo.avancar(30)"]   (uma foto em cada tempo, em s desde a carga)
import { writeFileSync } from 'node:fs';
import { abrirChrome, espera } from './cdp.mjs';
import { servirLivre } from './servir.mjs';

const args = process.argv.slice(2);
const op = Object.fromEntries(args.filter((a) => a.startsWith('--')).map((a) => { const [k, ...v] = a.slice(2).split('='); return [k, v.join('=') || true]; }));
const saida = args.find((a) => !a.startsWith('--')) || '.tmp/olhar';
const [L, A] = String(op.tamanho || '1280x720').split('x').map(Number);
const tempos = String(op.tempos || '6').split(',').map(Number);
const srv = await servirLivre();
const ch = await abrirChrome({ largura: L, altura: A, escala: Number(op.escala || 1), toque: L < A, args: ['--use-angle=metal', '--ignore-gpu-blocklist'] });
try {
  await ch.ir(`${srv.url}/index.html?novo&semanuncio&${op.params || 'auto'}`, 2500);
  if (op.js) await ch.avaliar(String(op.js));
  let t = 0;
  for (const [k, alvo] of tempos.entries()) {
    await espera(Math.max(0, alvo - t) * 1000);
    t = alvo;
    const png = await ch.print();
    writeFileSync(`${saida}-${k + 1}.png`, png);
    const m = await ch.avaliar('JSON.stringify(__jogo.medidas)').catch(() => '{}');
    process.stdout.write(`${saida}-${k + 1}.png  ${m}\n`);
  }
} finally {
  await ch.fechar();
  srv.fechar?.();
  process.exit(0);
}
