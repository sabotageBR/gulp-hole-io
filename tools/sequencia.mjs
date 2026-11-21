#!/usr/bin/env node
// Partida em sequencia como o jogador joga (perfil novo, ordem real de mapas e modos), no Chrome headless com GPU:
// cada rodada roda --segundos no relogio real com o piloto automatico, acaba (terminarRodada) e o "Jogar" e
// clicado. A cada segundo grava modo, mapa, lado, bots (andou, cresceu), buracos desenhados, camera e erros do
// console; no fim confere (sai com 1 se falhar):
//   - nenhum buraco desenhado a mais que os da rodada (o fantasma congelado da v0.3.0, da Doceria em diante);
//   - lado certo para o modo, ninguem fora do mapa, nenhum bot parado mais de 3 s, todos os bots crescendo;
//   - nenhum erro no console.
// Uso: node tools/sequencia.mjs [.tmp/seq] [--rodadas=7] [--segundos=20] [--tamanho=1280x720] [--fotos]
//      [--raiz=<outra copia do jogo>] (ex.: o zip da versao anterior extraido, para ver o bug antes)
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { abrirChrome, espera } from './cdp.mjs';
import { servirLivre, RAIZ } from './servir.mjs';

const args = process.argv.slice(2);
const op = Object.fromEntries(args.filter((a) => a.startsWith('--')).map((a) => { const [k, ...v] = a.slice(2).split('='); return [k, v.join('=') || true]; }));
const pasta = resolve(args.find((a) => !a.startsWith('--')) || '.tmp/seq');
mkdirSync(pasta, { recursive: true });
const [L, A] = String(op.tamanho || '1280x720').split('x').map(Number);
const N = Number(op.rodadas || 7);
const S = Number(op.segundos || 20);
const LADO = { classico: 120, batalha: 84, solo: 66 };

// buracos desenhados: o getter da v0.3.1; numa versao antiga, os grupos de 6 malhas (anel, racha, borda, labio,
// tubo, fundo) visiveis direto na cena
const AMOSTRA = `(() => {
  const j = window.__jogo; const R = j.E.R; if (!R) return null;
  const c = j.cena.camera;
  let vis = j.cena.buracosVisiveis;
  if (vis === undefined) { vis = 0; for (const g of j.cena.cena.children) if (g.isGroup && g.children.length === 6 && g.visible) vis++; }
  return {
    rodada: j.E.nRodada, modo: R.modo, tema: R.tema, lado: R.lado, t: +R.t.toFixed(2), objetos: R.objetos.length,
    buracos: R.buracos.length, desenhados: vis,
    bots: R.buracos.slice(1).map((b) => ({ x: +b.x.toFixed(2), z: +b.z.toFixed(2), r: +b.r.toFixed(2), vivo: b.vivo, m: +b.massa.toFixed(1), e: b.estado })),
    eu: { x: +R.buracos[0].x.toFixed(2), z: +R.buracos[0].z.toFixed(2), r: +R.buracos[0].r.toFixed(2) },
    cam: { x: +c.position.x.toFixed(1), y: +c.position.y.toFixed(1), z: +c.position.z.toFixed(1) },
    fps: +j.medidas.fps.toFixed(1), calls: j.medidas.calls, tri: j.medidas.tri,
  };
})()`;

const srv = await servirLivre(op.raiz ? resolve(String(op.raiz)) : RAIZ);
const ch = await abrirChrome({ largura: L, altura: A, escala: 1, toque: L < A, args: ['--use-angle=metal', '--ignore-gpu-blocklist'] });
const linhas = [];
const rodadas = [];
const falhas = [];
try {
  await ch.ir(`${srv.url}/index.html?auto&semanuncio&novo&semente=${op.semente || 7}`, 4000);
  for (let k = 0; k < N; k++) {
    for (let i = 0; i < 40 && !(await ch.avaliar('!!(window.__jogo && window.__jogo.E.R && !window.__jogo.E.R.fim && !window.__jogo.fimAberto)')); i++) await espera(250);
    const amostras = [];
    for (let s = 0; s < S; s++) {
      await espera(1000);
      amostras.push(JSON.parse(await ch.avaliar(`JSON.stringify(${AMOSTRA})`)));
      if (op.fotos && (s === 8 || s === S - 2)) writeFileSync(join(pasta, `r${k + 1}-${s}.png`), await ch.print());
    }
    const a0 = amostras[0];
    const aN = amostras[amostras.length - 1];
    const nb = a0.bots.length;
    const andou = Array(nb).fill(0);
    const parado = Array(nb).fill(0);
    let maxParado = 0;
    for (let i = 1; i < amostras.length; i++) {
      for (let b = 0; b < nb; b++) {
        const p = amostras[i].bots[b];
        const q = amostras[i - 1].bots[b];
        if (!p || !q || !p.vivo || !q.vivo) {
          parado[b] = 0;
          continue;
        }
        const d = Math.hypot(p.x - q.x, p.z - q.z);
        andou[b] += d;
        parado[b] = d < 0.2 ? parado[b] + 1 : 0;
        maxParado = Math.max(maxParado, parado[b]);
      }
    }
    const fora = amostras.flatMap((a) => a.bots.filter((b) => Math.abs(b.x) > a.lado / 2 + 0.01 || Math.abs(b.z) > a.lado / 2 + 0.01)).length;
    const vivosFim = aN.bots.filter((b) => b.vivo);
    const cresceu = aN.bots.filter((b, i) => b.vivo && b.m > a0.bots[i].m + 0.01).length;
    const fantasmas = Math.max(...amostras.map((a) => a.desenhados - a.buracos));
    const res = {
      rodada: a0.rodada, modo: a0.modo, tema: a0.tema, lado: a0.lado, bots: nb, buracos: a0.buracos,
      desenhadosMax: Math.max(...amostras.map((a) => a.desenhados)), fantasmas: Math.max(0, fantasmas),
      botsAndouMedia: nb ? +(andou.reduce((x, y) => x + y, 0) / nb).toFixed(1) : 0,
      botsAndouMin: nb ? +Math.min(...andou).toFixed(1) : 0,
      botsParadoMaxS: maxParado, botsCresceram: `${cresceu}/${vivosFim.length}`, botsForaDoMapa: fora,
      euR: aN.eu.r, fpsMin: Math.min(...amostras.map((a) => a.fps)), tri: aN.tri, calls: aN.calls, erros: ch.erros.length,
    };
    const nome = `rodada ${res.rodada} (${res.modo}-${res.tema})`;
    if (res.fantasmas > 0) falhas.push(`${nome}: ${res.fantasmas} buraco(s) fantasma desenhado(s) (${res.desenhadosMax} desenhados, ${res.buracos} na rodada)`);
    if (res.lado !== LADO[res.modo]) falhas.push(`${nome}: lado ${res.lado}, esperado ${LADO[res.modo]}`);
    if (fora) falhas.push(`${nome}: ${fora} amostra(s) de bot fora do mapa`);
    if (maxParado > 3) falhas.push(`${nome}: bot parado ${maxParado} s`);
    if (nb && cresceu < vivosFim.length) falhas.push(`${nome}: ${vivosFim.length - cresceu} bot(s) vivo(s) sem crescer`);
    rodadas.push(res);
    linhas.push(...amostras.map((a) => JSON.stringify(a)));
    process.stdout.write(`${JSON.stringify(res)}\n`);
    await ch.avaliar('window.__jogo.terminarRodada()');
    for (let i = 0; i < 40 && !(await ch.avaliar('!!window.__jogo.fimAberto')); i++) await espera(250);
    await espera(600);
    if (op.fotos) writeFileSync(join(pasta, `r${k + 1}-fim.png`), await ch.print());
    await ch.avaliar("document.getElementById('btJogar').click()");
    await espera(1500);
  }
  if (ch.erros.length) falhas.push(`erros no console: ${ch.erros.slice(0, 5).join(' | ')}`);
} finally {
  writeFileSync(join(pasta, 'amostras.jsonl'), `${linhas.join('\n')}\n`);
  writeFileSync(join(pasta, 'rodadas.json'), JSON.stringify({ rodadas, falhas }, null, 1));
  await ch.fechar();
  srv.fechar?.();
}
process.stdout.write(falhas.length ? `FALHOU:\n- ${falhas.join('\n- ')}\n` : `ok: ${rodadas.length} rodadas em sequencia, sem fantasma, bots andando e crescendo\n`);
process.exit(falhas.length ? 1 : 0);
