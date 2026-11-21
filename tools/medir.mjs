#!/usr/bin/env node
// Mede o fluxo e a IA em rodadas simuladas (sem navegador): o jogador vai no piloto automatico.
// Uso: node tools/medir.mjs [--rodadas=6] [--saida=.tmp/medida.json] [--modo=classico] [--src=/outra/copia/src]
//
// Fluxo: intervalo entre os itens engolidos pelo piloto (media, mediana, p90, maior buraco sem comer).
// IA:   tempo parado ou preso de cada bot (andou < 0,6 em 3 s sem estar de proposito parado), fuga (com um
//       buraco maior perto, a fracao do tempo em que o bot se afasta dele) e ritmo (massa dos bots / jogador).
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
const raiz = (process.argv.find((a) => a.startsWith('--src=')) || '').slice(6) || new URL('../src/', import.meta.url).href;
const base = raiz.startsWith('file:') ? raiz : new URL(`file://${raiz.endsWith('/') ? raiz : `${raiz}/`}`).href;
const { criarRodada, passoRodada } = await import(`${base}jogo/rodada.js`);
const { piloto } = await import(`${base}jogo/ia.js`);
const { MAPAS } = await import(`${base}jogo/catalogo.js`);
const { VANTAGEM, CABE } = await import(`${base}jogo/buraco.js`);

const op = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => { const [k, ...v] = a.slice(2).split('='); return [k, v.join('=') || true]; }));
const N = Number(op.rodadas || 6);
const modo = String(op.modo || 'classico');
const DT = 1 / 60;

const pct = (arr, p) => {
  if (!arr.length) return 0;
  const s = arr.slice().sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(p * (s.length - 1)))];
};
const media = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);
const r2 = (v) => Math.round(v * 1000) / 1000;

const rodadas = [];
for (let k = 0; k < N; k++) {
  const tema = MAPAS[k % MAPAS.length];
  const R = criarRodada({ modo, tema, semente: 100 + k, nivel: 'medio', niveis: ['fraco', 'medio', 'forte', 'medio'] });
  const eu = R.buracos[0];
  const tempos = [];
  /** por bot: amostras de posicao a cada 0,5 s para achar "preso" */
  const hist = R.buracos.map(() => []);
  const preso = R.buracos.map(() => 0);
  let maiorPreso = 0;
  let fugaOk = 0;
  let fugaTot = 0;
  let tremidas = 0;
  const dirAnt = R.buracos.map(() => null);
  let passos = 0;
  let mortes = 0;
  let seco = 0;
  let amostras = 0;
  const final30 = [];
  while (!R.fim) {
    const ent = piloto(R, eu, DT);
    const ev = passoRodada(R, DT, ent);
    passos++;
    for (const e of ev) {
      if (e.tipo === 'comeu' && e.buraco === 0) tempos.push(R.t);
      if (e.tipo === 'engoliu' && e.vitima === 0) mortes++;
    }
    // seco: nada que caiba a menos de r + 4 do jogador (amostra a cada 0,5 s)
    if (passos % 30 === 0 && eu.vivo) {
      amostras++;
      let tem = false;
      R.grade.perto(eu.x, eu.z, eu.r + 4, (id) => {
        const o = R.objetos[id];
        if (!tem && o.estado === 0 && o.peca.s < eu.r * CABE && Math.hypot(o.x - eu.x, o.z - eu.z) < eu.r + 4) tem = true;
      });
      if (!tem) seco++;
    }
    for (const b of R.buracos) {
      if (b.jogador || !b.vivo) {
        hist[b.id].length = 0;
        continue;
      }
      // fuga: maior por VANTAGEM a menos de (ra + rb + 3)
      for (const o of R.buracos) {
        if (o === b || !o.vivo || o.r <= b.r * VANTAGEM) continue;
        const dx = b.x - o.x;
        const dz = b.z - o.z;
        const d = Math.hypot(dx, dz);
        // perigo de verdade: a menos de 1,5 alem das bordas
        if (d < o.r + b.r + 1.5) {
          fugaTot++;
          if (b.vx * dx + b.vz * dz > 0) fugaOk++;
        }
      }
      // tremer: direcao virando mais de 120 graus de um passo para o outro com velocidade
      const v = Math.hypot(b.vx, b.vz);
      if (v > 0.8) {
        const d = [b.vx / v, b.vz / v];
        const a = dirAnt[b.id];
        if (a && a[0] * d[0] + a[1] * d[1] < -0.5) tremidas++;
        dirAnt[b.id] = d;
      }
      if (passos % 30 === 0) {
        const h = hist[b.id];
        h.push([b.x, b.z]);
        if (h.length > 7) h.shift();
        if (h.length === 7) {
          const [x0, z0] = h[0];
          const andou = Math.hypot(b.x - x0, b.z - z0);
          if (andou < 0.6) {
            preso[b.id] += 0.5;
            maiorPreso = Math.max(maiorPreso, preso[b.id]);
          } else preso[b.id] = 0;
        }
      }
    }
  }
  const gaps = tempos.map((t, i) => (i ? t - tempos[i - 1] : t));
  const ult = tempos.filter((t) => t > R.t - 30);
  const bots = R.buracos.filter((b) => !b.jogador);
  rodadas.push({
    tema,
    semente: 100 + k,
    comidos: tempos.length,
    comidosUltimos30: ult.length,
    seco: r2(seco / Math.max(1, amostras)),
    mortesJogador: mortes,
    intervaloMedio: r2(R.t / Math.max(1, tempos.length)),
    gapMediana: r2(pct(gaps, 0.5)),
    gapP90: r2(pct(gaps, 0.9)),
    maiorGap: r2(Math.max(0, ...gaps)),
    raioJogador: r2(eu.r),
    massaJogador: r2(eu.massa),
    massaBotMedia: r2(media(bots.map((b) => b.massa))),
    massaBotMax: r2(Math.max(...bots.map((b) => b.massa))),
    colocacao: 1 + bots.filter((b) => b.massa > eu.massa).length,
    botPresoMaior: r2(maiorPreso),
    fuga: r2(fugaTot ? fugaOk / fugaTot : 1),
    tremidasPorMin: r2(tremidas / (R.t / 60) / bots.length),
    restante: r2(1 - R.massaComida / R.massaTotal),
    objetos: R.objetos.length,
  });
}

const resumo = {
  modo,
  rodadas: N,
  intervaloMedio: r2(media(rodadas.map((r) => r.intervaloMedio))),
  gapMediana: r2(media(rodadas.map((r) => r.gapMediana))),
  gapP90: r2(media(rodadas.map((r) => r.gapP90))),
  maiorGap: r2(Math.max(...rodadas.map((r) => r.maiorGap))),
  comidos: r2(media(rodadas.map((r) => r.comidos))),
  comidosUltimos30: r2(media(rodadas.map((r) => r.comidosUltimos30))),
  seco: r2(media(rodadas.map((r) => r.seco))),
  mortesJogador: r2(media(rodadas.map((r) => r.mortesJogador))),
  ritmoBotMedio: r2(media(rodadas.map((r) => r.massaBotMedia / r.massaJogador))),
  ritmoBotMax: r2(media(rodadas.map((r) => r.massaBotMax / r.massaJogador))),
  colocacaoMedia: r2(media(rodadas.map((r) => r.colocacao))),
  botPresoMaior: r2(Math.max(...rodadas.map((r) => r.botPresoMaior))),
  fuga: r2(media(rodadas.map((r) => r.fuga))),
  tremidasPorMin: r2(media(rodadas.map((r) => r.tremidasPorMin))),
  restante: r2(media(rodadas.map((r) => r.restante))),
  objetos: r2(media(rodadas.map((r) => r.objetos))),
};
const saida = String(op.saida || '.tmp/medida.json');
mkdirSync(dirname(saida), { recursive: true });
writeFileSync(saida, JSON.stringify({ resumo, rodadas }, null, 2));
console.log(JSON.stringify(resumo, null, 2));
if (op.tudo) for (const r of rodadas) console.log(JSON.stringify(r));
