#!/usr/bin/env node
// Quadro a quadro do jogo rodando do codigo-fonte (sem build), no Chrome headless com GPU: abre
// index.html?filme=<fps>&semanuncio&novo&<params>, roda o --js (monta a cena) e grava N quadros (JPEG) numa pasta,
// mais uma folha de contato (ffmpeg) para olhar a animacao de uma vez.
// Uso: node tools/quadros.mjs <pasta> [--tamanho=1280x720] [--fps=30] [--segundos=2] [--params="auto&mapa=cidade"]
//      [--js="..."] [--pular=0] [--js2="..."] [--pular2=0] [--cada=2] [--colunas=6]   (--js2 roda depois do --pular;
//      pode ser uma promessa, ex.: acabar a rodada e clicar em Jogar; --pular2 joga mais N s depois dele)
//   --pular: segundos jogados (quadros descartados) antes de gravar; --cada: um quadro da folha a cada N;
//   --log="expr": avalia a expressao depois de cada quadro e grava em log.txt (ex.: o raio do jogador).
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { abrirChrome } from './cdp.mjs';
import { servirLivre } from './servir.mjs';

const args = process.argv.slice(2);
const op = Object.fromEntries(args.filter((a) => a.startsWith('--')).map((a) => { const [k, ...v] = a.slice(2).split('='); return [k, v.join('=') || true]; }));
const pasta = resolve(args.find((a) => !a.startsWith('--')) || '.tmp/quadros');
const [L, A] = String(op.tamanho || '1280x720').split('x').map(Number);
const fps = Number(op.fps || 30);
const N = Math.round(Number(op.segundos || 2) * fps);
const pular = Math.round(Number(op.pular || 0) * fps);
const pular2 = Math.round(Number(op.pular2 || 0) * fps);
rmSync(pasta, { recursive: true, force: true });
mkdirSync(pasta, { recursive: true });
const srv = await servirLivre();
const ch = await abrirChrome({ largura: L, altura: A, escala: 1, toque: L < A, args: ['--use-angle=metal', '--ignore-gpu-blocklist'] });
try {
  await ch.ir(`${srv.url}/index.html?filme=${fps}&semanuncio&novo&${op.params || ''}`, 3500);
  if (op.js) await ch.avaliar(String(op.js));
  for (let i = 0; i < pular; i++) await ch.avaliar(`void window.__jogo.quadro(${fps})`);
  if (op.js2) await ch.avaliar(String(op.js2));
  for (let i = 0; i < pular2; i++) await ch.avaliar(`void window.__jogo.quadro(${fps})`);
  const log = [];
  for (let i = 0; i < N; i++) {
    const url = await ch.avaliar(`window.__jogo.quadro(${fps})`);
    writeFileSync(join(pasta, `q${String(i).padStart(4, '0')}.jpg`), Buffer.from(String(url).split(',')[1], 'base64'));
    if (op.log) log.push(`${i} ${await ch.avaliar(`JSON.stringify(${op.log})`)}`);
  }
  if (log.length) writeFileSync(join(pasta, 'log.txt'), `${log.join('\n')}\n`);
  if (ch.erros.length) process.stdout.write(`erros no console: ${ch.erros.slice(0, 5).join(' | ')}\n`);
} finally {
  await ch.fechar();
  srv.fechar?.();
}
const cada = Number(op.cada || 2);
const col = Number(op.colunas || 6);
const lin = Math.ceil(N / cada / col);
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', join(pasta, 'q%04d.jpg'), '-vf', `select='not(mod(n\\,${cada}))',scale=${Math.round(1920 / col) - 8}:-1,pad=iw+8:ih+8:4:4:white,drawtext=text='%{n}':x=6:y=6:fontsize=18:fontcolor=white:box=1:boxcolor=black@0.5,tile=${col}x${lin}`, '-frames:v', '1', join(pasta, 'folha.jpg')]);
process.stdout.write(`${N} quadros em ${pasta} (folha.jpg)\n`);
process.exit(0);
