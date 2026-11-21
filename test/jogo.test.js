// Logica pura do Pothole Party.io: crescimento, regra de engolir, mapa por semente, IA, rodadas so com
// bots (todos os modos), o roteiro da primeira rodada (a casinha aos ~15 s) e o progresso.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { RAIO_INICIAL, raioDe, massaPara, cai, treme, engoleBuraco, velocidadeDe } from '../src/jogo/buraco.js';
import { gerarMapa, LADO } from '../src/jogo/mapa.js';
import { TEMAS, MAPAS, artesDoTema, massaDe, pontosDe } from '../src/jogo/catalogo.js';
import { criarRodada, passoRodada, jogador, placar, colocacao, fracaoComida, GIGANTE_EM } from '../src/jogo/rodada.js';
import { pensarBot, piloto } from '../src/jogo/ia.js';
import {
  perfilNovo, normalizarPerfil, proximaRodada, fecharRodada, nivelDe, liberados, skinLiberada, xpDaRodada,
  desafioDoDia, desafioAberto, desafioCumprido, estrelasSolo, N_SKINS,
} from '../src/jogo/progresso.js';

const DT = 1 / 30;
const RAIZ = new URL('..', import.meta.url).pathname;

test('crescimento: comeca no raio inicial, sobe sempre, desacelera e massaPara inverte raioDe', () => {
  assert.equal(raioDe(0), RAIO_INICIAL);
  let antes = raioDe(0);
  for (const m of [1, 5, 20, 80, 300]) {
    const r = raioDe(m);
    assert.ok(r > antes, `raio sobe com a massa (${m})`);
    assert.ok(Math.abs(massaPara(r) - m) < 1e-6 * Math.max(1, m), 'massaPara(raioDe(m)) = m');
    antes = r;
  }
  // desacelera: a segunda centena de massa rende menos raio que a primeira
  assert.ok(raioDe(200) - raioDe(100) < raioDe(100) - raioDe(0));
  // um buraco bom fecha a rodada com raio 6 a 8 (calibrado pela simulacao)
  assert.ok(raioDe(300) > 5 && raioDe(300) < 9);
  assert.ok(velocidadeDe(8) > velocidadeDe(1), 'buraco grande anda um pouco mais');
});

test('regra de engolir: cabe so o que e menor que a boca e esta dentro dela', () => {
  assert.ok(cai(1, 0.3, 0.2), 'cone no meio da boca cai');
  assert.ok(!cai(1, 0.3, 1.2), 'longe da boca nao cai');
  assert.ok(!cai(1, 0.95, 0), 'maior que 92% da boca nao cai');
  assert.ok(treme(1, 0.95, 0.3), 'grande demais na boca treme');
  assert.ok(!treme(1, 0.3, 0.3), 'o que cabe nao treme');
  assert.ok(engoleBuraco(2, 1.5, 0.5), 'buraco 12% maior engole o menor na boca');
  assert.ok(!engoleBuraco(2, 1.9, 0.1), 'quase do mesmo tamanho nao engole');
  assert.ok(!engoleBuraco(2, 1, 1.8), 'longe nao engole');
  assert.equal(pontosDe(0.1), 1);
  assert.ok(massaDe(2) > massaDe(1));
});

test('mapa: a mesma semente da o mesmo mapa; outra semente muda; tudo dentro do quadrado', () => {
  for (const tema of MAPAS) {
    for (const modo of ['classico', 'solo', 'batalha']) {
      const a = gerarMapa({ tema, modo, semente: 42 });
      const b = gerarMapa({ tema, modo, semente: 42 });
      const c = gerarMapa({ tema, modo, semente: 43 });
      assert.deepEqual(a.objetos.map((o) => [o.peca.id, o.x, o.z]), b.objetos.map((o) => [o.peca.id, o.x, o.z]));
      assert.notDeepEqual(a.objetos.map((o) => [o.peca.id, o.x, o.z]), c.objetos.map((o) => [o.peca.id, o.x, o.z]));
      const meio = LADO[modo] / 2;
      for (const o of a.objetos) assert.ok(Math.abs(o.x) <= meio && Math.abs(o.z) <= meio, `${tema}/${modo}: peca fora do mapa`);
      assert.ok(a.spawns.length >= 4, 'cruzamentos para nascer');
      for (const s of a.spawns) assert.ok(a.linhas.includes(s.x) && a.linhas.includes(s.z), 'spawn num cruzamento');
      const minimo = modo === 'solo' ? 150 : modo === 'batalha' ? 350 : 650;
      assert.ok(a.objetos.length > minimo, `${tema}/${modo}: mapa cheio (${a.objetos.length})`);
    }
  }
});

test('mapa: o roteiro da primeira rodada tem a trilha ate a casinha, perto da origem', () => {
  const m = gerarMapa({ tema: 'cidade', modo: 'classico', semente: 9, roteiro: true });
  assert.equal(m.trilha.length, 5);
  assert.deepEqual(m.spawns[0], { x: 0, z: 0 });
  assert.ok(m.objetos.some((o) => o.peca.id === 'casinha' && Math.hypot(o.x - 13.4, o.z - 9.5) < 0.01));
  // carro nao entra nas ruas da trilha
  assert.deepEqual(m.bloqueadas, [{ eixo: 'h', L: 0 }, { eixo: 'v', L: 18 }]);
});

test('arte: toda peca do catalogo tem arquivo em src/arte', () => {
  for (const tema of MAPAS) {
    const a = artesDoTema(tema);
    for (const n of a.sprites) assert.ok(existsSync(`${RAIZ}src/arte/sprites/${n}.webp`), `sprite ${n}`);
    for (const n of a.fachadas) assert.ok(existsSync(`${RAIZ}src/arte/fachadas/${n}.webp`), `fachada ${n}`);
  }
  for (let k = 1; k <= N_SKINS; k++) assert.ok(existsSync(`${RAIZ}src/arte/skins/skin-${String(k).padStart(2, '0')}.webp`), `skin ${k}`);
});

test('IA: foge do maior, vai na comida que cabe e nao persegue o jogador protegido', () => {
  const R = criarRodada({ modo: 'classico', tema: 'cidade', semente: 3, bots: 2, nivel: 'forte', protegerJogador: true });
  const [eu, bot, outro] = R.buracos;
  // foge: um buraco bem maior colado
  outro.x = 10; outro.z = 10; outro.massa = 200; outro.r = raioDe(200);
  bot.x = 12; bot.z = 10;
  bot.nivel = 'forte';
  let fugiu = 0;
  for (let i = 0; i < 20; i++) {
    pensarBot(R, bot, R.rng);
    if (bot.estado === 'foge' && Math.hypot(bot.ax - outro.x, bot.az - outro.z) > Math.hypot(bot.x - outro.x, bot.z - outro.z)) fugiu++;
  }
  assert.ok(fugiu >= 17, `fugiu ${fugiu}/20`);
  // nao persegue o jogador protegido mesmo podendo
  outro.x = -30; outro.z = -30;
  bot.massa = 60; bot.r = raioDe(60);
  eu.x = bot.x + 3; eu.z = bot.z;
  for (let i = 0; i < 30; i++) {
    pensarBot(R, bot, R.rng);
    assert.notEqual(bot.estado, 'caca');
  }
  // comida: o alvo cabe na boca
  bot.massa = 0; bot.r = raioDe(0);
  pensarBot(R, bot, R.rng);
  if (bot.estado === 'come') assert.ok(Math.hypot(bot.ax - bot.x, bot.az - bot.z) < 12);
});

/** Roda uma rodada inteira com o piloto no jogador. */
function rodar(cfg, semente) {
  const R = criarRodada({ ...cfg, semente });
  let passos = 0;
  while (!R.fim && passos < 200 * 30) {
    passoRodada(R, DT, piloto(R, jogador(R), DT));
    passos++;
  }
  return R;
}

test('rodada: deterministica pela semente', () => {
  const a = rodar({ modo: 'classico', tema: 'praia', bots: 8, nivel: 'medio' }, 77);
  const b = rodar({ modo: 'classico', tema: 'praia', bots: 8, nivel: 'medio' }, 77);
  assert.deepEqual(a.buracos.map((x) => [x.massa, x.pontos, x.x, x.z]), b.buracos.map((x) => [x.massa, x.pontos, x.x, x.z]));
});

test('rodadas so com bots: os 3 modos acabam, o gigante aparece e o placar fecha', () => {
  for (const tema of MAPAS) {
    const c = rodar({ modo: 'classico', tema, bots: 9, niveis: ['fraco', 'medio', 'forte'] }, 11);
    assert.equal(c.motivo, 'tempo');
    assert.ok(Math.abs(c.t - 120) < 0.1);
    assert.ok(c.gigante && c.gigante.id >= 0, 'o gigante caiu');
    assert.ok(c.objetos[c.gigante.id].nasceu >= GIGANTE_EM - 0.1);
    const pl = placar(c);
    assert.ok(pl[0].massa >= pl[pl.length - 1].massa);
    assert.ok(pl[0].r > 3, `o maior cresceu (${pl[0].r.toFixed(2)})`);
    assert.ok(colocacao(c) >= 1 && colocacao(c) <= 10);

    const b = rodar({ modo: 'batalha', tema, bots: 7, niveis: ['medio', 'forte'] }, 12);
    assert.ok(['ultimo', 'eliminado', 'tempo'].includes(b.motivo), b.motivo);
    assert.ok(b.buracos.filter((x) => x.fora).length >= 1, 'na Batalha alguem sai');

    const s = rodar({ modo: 'solo', tema }, 13);
    assert.ok(['limpo', 'tempo'].includes(s.motivo));
    assert.ok(fracaoComida(s) > 0.6, `solo: um bom jogador come boa parte do bairro (${fracaoComida(s).toFixed(2)})`);
  }
});

test('primeira rodada: seguindo a trilha da mao-guia, a casinha cai antes dos 15 s; os bots nao cacam o jogador', () => {
  for (const semente of [1, 2, 3, 4, 5]) {
    const cfg = proximaRodada(perfilNovo());
    assert.ok(cfg.roteiro && cfg.protegerJogador && cfg.modo === 'classico' && cfg.tema === 'cidade');
    const R = criarRodada({ ...cfg, semente });
    const trilha = R.mapa.trilha;
    let i = 0;
    let casa = -1;
    while (R.t < 20 && casa < 0) {
      const eu = jogador(R);
      while (i < trilha.length - 1 && Math.hypot(trilha[i].x - eu.x, trilha[i].z - eu.z) < 1.2) i++;
      const dx = trilha[i].x - eu.x;
      const dz = trilha[i].z - eu.z;
      const n = Math.hypot(dx, dz) || 1;
      // jogador humano: ~85% da velocidade (curvas, hesitacao)
      const ev = passoRodada(R, DT, { x: (dx / n) * 0.85, z: (dz / n) * 0.85 });
      for (const e of ev) if (e.tipo === 'comeu' && e.buraco === 0 && e.forma === 'casa') casa = R.t;
      for (const b of R.buracos) if (b !== eu) assert.notEqual(b.estado, 'caca');
    }
    assert.ok(casa > 4 && casa < 15, `semente ${semente}: casinha aos ${casa.toFixed(1)} s`);
  }
});

test('primeira rodada: o jogador costuma vencer (bots fracos); ser engolido so renasce', () => {
  let vitorias = 0;
  for (const semente of [21, 22, 23, 24, 25, 26]) {
    const R = rodar(proximaRodada(perfilNovo()), semente);
    if (colocacao(R) === 1) vitorias++;
    assert.ok(R.buracos[0].vivo || R.buracos[0].renasce > 0, 'no Classico ninguem sai de vez');
  }
  assert.ok(vitorias >= 5, `venceu ${vitorias}/6`);
});

test('progresso: roteiro das 5 primeiras rodadas, liberacoes, XP, skins e desafio do dia', () => {
  let p = perfilNovo();
  const vistos = [];
  for (let n = 0; n < 6; n++) {
    const cfg = proximaRodada(p);
    vistos.push(`${cfg.modo}-${cfg.tema}`);
    const r = fecharRodada(p, { modo: cfg.modo, tema: cfg.tema, colocacao: 1, pontos: 3000, fracao: 0.9 });
    p = r.perfil;
  }
  assert.deepEqual(vistos.slice(0, 5), ['classico-cidade', 'classico-praia', 'solo-doceria', 'classico-doceria', 'batalha-cidade']);
  assert.deepEqual(liberados(p).mapas, ['cidade', 'praia', 'doceria']);
  assert.deepEqual(liberados(p).modos, ['classico', 'solo', 'batalha']);
  assert.ok(nivelDe(p.xp).nivel >= 3, 'sobe de nivel nas primeiras rodadas');
  assert.ok(skinLiberada(p, 1) && !skinLiberada(perfilNovo(), 1) && skinLiberada(perfilNovo(), 0));
  // escolha do jogador so vale se liberada
  assert.equal(proximaRodada(perfilNovo(), { modo: 'batalha', tema: 'doceria' }).modo, 'classico');
  // XP: vitoria vale mais; desafio dobra
  assert.ok(xpDaRodada({ modo: 'classico', colocacao: 1, pontos: 100 }) > xpDaRodada({ modo: 'classico', colocacao: 6, pontos: 100 }));
  assert.equal(xpDaRodada({ modo: 'classico', colocacao: 1, pontos: 100, desafio: true }), 2 * xpDaRodada({ modo: 'classico', colocacao: 1, pontos: 100 }));
  assert.equal(estrelasSolo(1), 3);
  assert.equal(estrelasSolo(0.5), 0);
  // desafio do dia: o mesmo para o mesmo dia, um por dia
  assert.deepEqual(desafioDoDia('2026-11-20'), desafioDoDia('2026-11-20'));
  assert.ok(desafioAberto(p, '2026-11-20'));
  const feito = fecharRodada(p, { modo: 'classico', tema: 'cidade', colocacao: 2, pontos: 10, desafio: true, dia: '2026-11-20' }).perfil;
  assert.ok(!desafioAberto(feito, '2026-11-20') && desafioAberto(feito, '2026-11-21'));
  assert.ok(desafioCumprido({ grupo: 'carro', n: 2 }, { carro: 3 }) && !desafioCumprido({ grupo: 'carro', n: 2 }, {}));
  // perfil estragado no armazenamento vira um perfil valido
  const lixo = normalizarPerfil({ xp: -5, rodadas: 'x', skin: 99, recordes: null });
  assert.equal(lixo.xp, 0);
  assert.equal(lixo.rodadas, 0);
  assert.equal(lixo.skin, 0);
  assert.equal(normalizarPerfil(null).xp, 0);
  void TEMAS;
});
