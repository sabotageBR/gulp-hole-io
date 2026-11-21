// Testes da v0.3.1: o bug "da Doceria em diante os bots param e o mapa fica menor". A partida e jogada em
// sequencia, na ordem real de mapas e modos (perfil novo, proximaRodada e fecharRodada como o jogo faz), e a IA e
// conferida nos tres mapas: sem perseguir carro sem fim, sem alternar caca e cacho, sem cruzar o mapa atras do
// gigante, sem parar no alvo da borda. Os buracos fantasmas do desenho (cena.js) sao provados no navegador por
// tools/sequencia.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { criarRodada, passoRodada, fracaoComida, colocacao, DURACAO, DURACAO_SOLO } from '../src/jogo/rodada.js';
import { piloto, NIVEIS } from '../src/jogo/ia.js';
import { LADO } from '../src/jogo/mapa.js';
import { MAPAS } from '../src/jogo/catalogo.js';
import { perfilNovo, proximaRodada, fecharRodada } from '../src/jogo/progresso.js';

const DT = 1 / 60;

/**
 * Joga S segundos de uma rodada com o piloto no jogador e devolve, por bot, quanto andou, quanto comeu, quanto
 * cresceu e a maior seca (tempo vivo sem comer), mais os erros de limite do mapa.
 */
function jogar(R, S) {
  const eu = R.buracos[0];
  const bots = R.buracos.map((b) => ({ andou: 0, comeu: 0, m0: b.massa, seca: 0, ult: 0, x: b.x, z: b.z, morreu: false }));
  const meio = R.lado / 2;
  const fora = [];
  for (let k = 0; k < S * 60 && !R.fim; k++) {
    for (const e of passoRodada(R, DT, piloto(R, eu, DT))) {
      if (e.tipo === 'comeu') bots[e.buraco].comeu++;
      if (e.tipo === 'comeu' || e.tipo === 'engoliu') bots[e.buraco].ult = R.t;
      if (e.tipo === 'engoliu') bots[e.vitima].morreu = true;
    }
    for (const b of R.buracos) {
      const s = bots[b.id];
      if (!b.vivo) {
        s.ult = R.t;
        continue;
      }
      s.andou += Math.hypot(b.x - s.x, b.z - s.z);
      s.x = b.x;
      s.z = b.z;
      s.seca = Math.max(s.seca, R.t - s.ult);
      if (Math.abs(b.x) > meio - 0.6 + 1e-6 || Math.abs(b.z) > meio - 0.6 + 1e-6) fora.push(`${b.nome} em (${b.x}, ${b.z})`);
    }
    if (k % 60 === 0) {
      for (const o of R.objetos) {
        if (o.estado === 0 && (Math.abs(o.x) > meio - 0.5 + 1e-6 || Math.abs(o.z) > meio - 0.5 + 1e-6)) fora.push(`${o.peca.id} em (${o.x}, ${o.z})`);
      }
    }
  }
  return { bots, fora };
}

test('partida em sequencia (ordem real): da Doceria em diante os bots andam, comem e crescem e os limites ficam certos', () => {
  let p = perfilNovo();
  const vistos = [];
  for (let k = 0; k < 7; k++) {
    const cfg = proximaRodada(p);
    const R = criarRodada({
      modo: cfg.modo, tema: cfg.tema, semente: 7 + k * 7919, bots: cfg.bots, niveis: cfg.niveis, roteiro: cfg.roteiro,
      protegerJogador: cfg.protegerJogador, skin: 0, nome: 'eu',
    });
    const nome = `${k + 1}a ${cfg.modo}-${cfg.tema}`;
    vistos.push(`${cfg.modo}-${cfg.tema}`);
    // limites e tamanho certos para o modo (nada herdado do primeiro mapa)
    assert.equal(R.lado, LADO[cfg.modo], `${nome}: lado`);
    assert.equal(R.mapa.lado, LADO[cfg.modo], `${nome}: lado do mapa`);
    assert.equal(R.duracao, cfg.modo === 'solo' ? DURACAO_SOLO : DURACAO, `${nome}: duracao`);
    assert.equal(R.buracos.length, cfg.modo === 'solo' ? 1 : 1 + cfg.bots, `${nome}: buracos`);
    const { bots, fora } = jogar(R, 40);
    assert.deepEqual(fora.slice(0, 3), [], `${nome}: fora do mapa`);
    const eu = bots[0];
    assert.ok(eu.comeu >= 40, `${nome}: o jogador (piloto) comeu so ${eu.comeu} em 40 s`);
    assert.ok(eu.seca < 8, `${nome}: o jogador (piloto) ficou ${eu.seca.toFixed(1)} s sem comer`);
    R.buracos.slice(1).forEach((b) => {
      const s = bots[b.id];
      if (s.morreu) return;
      assert.ok(s.andou > 60, `${nome}: ${b.nome} (${b.perso}) andou so ${s.andou.toFixed(0)} em 40 s`);
      assert.ok(s.comeu >= 15, `${nome}: ${b.nome} (${b.perso}) comeu so ${s.comeu} em 40 s`);
      assert.ok(b.massa > s.m0 + 5, `${nome}: ${b.nome} (${b.perso}) nao cresceu`);
      assert.ok(s.seca < 14, `${nome}: ${b.nome} (${b.perso}) ficou ${s.seca.toFixed(1)} s sem comer`);
    });
    // fecha como o jogo fecha e vai para a proxima
    while (!R.fim) passoRodada(R, DT, piloto(R, R.buracos[0], DT));
    p = fecharRodada(p, { modo: R.modo, tema: R.tema, colocacao: colocacao(R), pontos: R.buracos[0].pontos, fracao: fracaoComida(R) }).perfil;
  }
  // passou pela Doceria (Solo e Classico) e chegou nas rodadas seguintes
  assert.deepEqual(vistos.slice(0, 6), ['classico-cidade', 'classico-praia', 'solo-doceria', 'classico-doceria', 'batalha-cidade', 'classico-doceria']);
});

test('Solo: bairro 3x3 (66) e 2:30; o piloto engole quase tudo nos tres mapas', () => {
  assert.equal(LADO.solo, 66);
  assert.ok(LADO.solo >= LADO.classico * 0.5, 'o Solo nao pode parecer um mapa encolhido');
  for (const tema of MAPAS) {
    const R = criarRodada({ modo: 'solo', tema, semente: 21 });
    assert.equal(R.duracao, DURACAO_SOLO);
    // 3 ruas em cada direcao dentro do bairro (3x3 quarteiroes)
    assert.ok(R.mapa.linhas.length >= 4, `${tema}: ${R.mapa.linhas.length} ruas`);
    while (!R.fim) passoRodada(R, DT, piloto(R, R.buracos[0], DT));
    assert.ok(fracaoComida(R) >= 0.85, `${tema}: o piloto so engoliu ${(fracaoComida(R) * 100).toFixed(0)}%`);
  }
});

test('IA: buraco pequeno nao fica atras de carro sem alcancar (a rodada 4 da sequencia, que travava o piloto)', () => {
  // a mesma rodada da reproducao: Classico na Doceria, semente da 4a rodada da sessao com ?semente=7
  const R = criarRodada({ modo: 'classico', tema: 'doceria', semente: 7 + 3 * 7919, bots: 9, niveis: ['fraco', 'medio', 'medio'] });
  const eu = R.buracos[0];
  let comeu = 0;
  let ult = 0;
  let seca = 0;
  for (let k = 0; k < 30 * 60; k++) {
    for (const e of passoRodada(R, DT, piloto(R, eu, DT))) {
      if (e.tipo === 'comeu' && e.buraco === 0) {
        comeu++;
        ult = R.t;
      }
    }
    seca = Math.max(seca, R.t - ult);
  }
  // antes: comia 6 pecas e seguia um carro-doce pelas ruas por 18 s com o raio parado em 0,93
  assert.ok(comeu > 60, `comeu so ${comeu}`);
  assert.ok(seca < 5, `${seca.toFixed(1)} s sem comer`);
  assert.ok(eu.r > 1.5, `raio ${eu.r.toFixed(2)}`);
});

test('IA: decide e mantem (pouca troca entre caca e cacho; gigante so se estiver perto; nada de parar no alvo da borda)', () => {
  let trocas = 0;
  let nBots = 0;
  let gigLonge = 0;
  for (const tema of MAPAS) {
    for (const sem of [1, 2]) {
      const R = criarRodada({ modo: 'classico', tema, semente: sem * 17, niveis: ['fraco', 'medio', 'medio'] });
      const ant = R.buracos.map((b) => b.estado);
      const parado = R.buracos.map(() => 0);
      const pos = R.buracos.map((b) => [b.x, b.z]);
      let k = 0;
      while (!R.fim) {
        passoRodada(R, DT, piloto(R, R.buracos[0], DT));
        k++;
        for (const b of R.buracos.slice(1)) {
          if ([ant[b.id], b.estado].sort().join('-') === 'caca-come') trocas++;
          ant[b.id] = b.estado;
          if (b.estado === 'gigante') {
            const g = R.objetos[R.gigante.id];
            const visao = (NIVEIS[b.nivel] || NIVEIS.medio).visao + b.r * 1.6;
            if (Math.hypot(g.x - b.x, g.z - b.z) > visao * 1.6 + 6 + 1) gigLonge++;
          }
          if (k % 30 === 0) {
            const andou = Math.hypot(b.x - pos[b.id][0], b.z - pos[b.id][1]);
            pos[b.id] = [b.x, b.z];
            parado[b.id] = b.vivo && andou < 0.2 ? parado[b.id] + 0.5 : 0;
            assert.ok(parado[b.id] <= 3, `${tema}/${sem}: ${b.nome} parado ${parado[b.id]} s em (${b.x.toFixed(1)}, ${b.z.toFixed(1)}) [${b.estado}]`);
          }
        }
      }
      nBots += R.buracos.length - 1;
    }
  }
  // v0.3.0: 9,8 trocas por bot por rodada e 74% do tempo atras do gigante a mais de 40 de distancia
  assert.ok(trocas / nBots < 4, `${(trocas / nBots).toFixed(1)} trocas caca/cacho por bot por rodada`);
  assert.equal(gigLonge, 0, 'bot cruzando o mapa atras do gigante');
  // o caso que prendeu um bot 47 s na borda da Praia (alvo limitado a 1,5 da borda, peca a 0,5)
  const B = criarRodada({ modo: 'classico', tema: 'praia', semente: 101, nivel: 'medio', niveis: ['fraco', 'medio', 'forte', 'medio'] });
  const { bots } = jogar(B, 40);
  B.buracos.slice(1).forEach((b) => assert.ok(bots[b.id].morreu || bots[b.id].seca < 14, `${b.nome}: seca de ${bots[b.id].seca.toFixed(1)} s`));
});

test('borda: nada brota alem da borda do mapa (o reabastecimento punha peca do lado de fora da mureta)', () => {
  for (const [modo, tema, semente] of [['classico', 'cidade', 13], ['classico', 'praia', 13], ['classico', 'praia', 26], ['batalha', 'doceria', 13]]) {
    const R = criarRodada({ modo, tema, semente, niveis: ['fraco', 'medio', 'medio'] });
    const lim = R.lado / 2 - 0.5 + 1e-6;
    let k = 0;
    while (!R.fim) {
      passoRodada(R, DT, piloto(R, R.buracos[0], DT));
      if (++k % 30) continue;
      for (const o of R.objetos) {
        if (o.estado === 0) assert.ok(Math.abs(o.x) <= lim && Math.abs(o.z) <= lim, `${modo}/${tema}: ${o.peca.id} em (${o.x.toFixed(2)}, ${o.z.toFixed(2)})`);
      }
    }
  }
});
