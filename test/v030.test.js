// Testes da v0.3.0: fluxo de coisas para comer (cachos e reabastecimento), IA dos bots com objetivo e
// personalidade, combo de sons sem "catraca" e o predio grande demais que racha e cede.
import test from 'node:test';
import assert from 'node:assert/strict';
import { criarRodada, passoRodada, vistaDe, TEMPO_CEDE } from '../src/jogo/rodada.js';
import { piloto, PERSONALIDADES } from '../src/jogo/ia.js';
import { CABE, VANTAGEM, massaPara } from '../src/jogo/buraco.js';
import { TEMAS, MAPAS, materialDe } from '../src/jogo/catalogo.js';
import { criarCombo, ESPACO, VOZES, ESCALA, hzDoGrau } from '../src/som/combo.js';
import { SONS, TIMBRES } from '../src/som/sons.js';

const DT = 1 / 60;

/** Poe o buraco com o raio r. */
function raio(b, r) {
  b.massa = massaPara(r);
  b.r = r;
}

test('fluxo: o piloto come uma peca a cada ~0,2 s e quase nunca fica sem nada que caiba por perto', () => {
  for (const tema of MAPAS) {
    const R = criarRodada({ modo: 'classico', tema, semente: 31, niveis: ['fraco', 'medio', 'forte'] });
    const eu = R.buracos[0];
    let comidos = 0;
    let seco = 0;
    let amostras = 0;
    for (let k = 0; k < 90 * 60 && !R.fim; k++) {
      for (const e of passoRodada(R, DT, piloto(R, eu, DT))) if (e.tipo === 'comeu' && e.buraco === 0) comidos++;
      if (k % 30 === 0 && eu.vivo) {
        amostras++;
        let tem = false;
        R.grade.perto(eu.x, eu.z, eu.r + 4, (id) => {
          const o = R.objetos[id];
          if (o.estado === 0 && o.peca.s < eu.r * CABE && Math.hypot(o.x - eu.x, o.z - eu.z) < eu.r + 4) tem = true;
        });
        if (!tem) seco++;
      }
    }
    assert.ok(R.t / comidos < 0.25, `${tema}: uma peca a cada ${(R.t / comidos).toFixed(2)} s`);
    assert.ok(seco / amostras < 0.08, `${tema}: sem comida perto em ${((seco / amostras) * 100).toFixed(0)}% do tempo`);
  }
});

test('reabastecimento: cachos voltam fora da vista do jogador e longe dos buracos; no Solo nao', () => {
  const R = criarRodada({ modo: 'classico', tema: 'cidade', semente: 9, niveis: ['medio'] });
  const eu = R.buracos[0];
  const n0 = R.objetos.length;
  for (let k = 0; k < 70 * 60; k++) {
    passoRodada(R, DT, piloto(R, eu, DT));
    // cada peca nova aparece fora da vista do jogador e longe de todo buraco
    for (let id = n0; id < R.objetos.length; id++) {
      const o = R.objetos[id];
      if (o.brota !== R.t) continue;
      if (!o.ia || o.ia.tipo !== 'carro') assert.ok(Math.hypot(o.x - eu.x, o.z - eu.z) > vistaDe(eu.r) - 3, 'brotou a vista');
      for (const b of R.buracos) if (b.vivo) assert.ok(Math.hypot(o.x - b.x, o.z - b.z) > b.r + 2, 'brotou em cima de um buraco');
    }
  }
  assert.ok(R.reab.cachos >= 10, `so ${R.reab.cachos} cachos voltaram`);
  assert.ok(R.objetos.slice(n0).some((o) => o.ia && o.ia.tipo === 'pessoa' && o.ia.modo === 'anda'), 'ninguem voltou a andar');
  const S = criarRodada({ modo: 'solo', tema: 'cidade', semente: 9 });
  const m0 = S.objetos.length;
  for (let k = 0; k < 40 * 60 && !S.fim; k++) passoRodada(S, DT, piloto(S, S.buracos[0], DT));
  assert.equal(S.objetos.length, m0);
});

test('IA: ninguem fica parado ou preso mais que 3 s; cada bot tem uma personalidade', () => {
  for (const tema of MAPAS) {
    const R = criarRodada({ modo: 'classico', tema, semente: 41, niveis: ['fraco', 'medio', 'forte'] });
    const eu = R.buracos[0];
    const bots = R.buracos.slice(1);
    assert.deepEqual(new Set(bots.map((b) => b.perso)), new Set(Object.keys(PERSONALIDADES)));
    const parado = bots.map(() => 0);
    const pos = bots.map((b) => [b.x, b.z]);
    for (let k = 0; k < 120 * 60 && !R.fim; k++) {
      passoRodada(R, DT, piloto(R, eu, DT));
      if (k % 30 !== 0) continue;
      bots.forEach((b, i) => {
        const andou = Math.hypot(b.x - pos[i][0], b.z - pos[i][1]);
        pos[i] = [b.x, b.z];
        parado[i] = b.vivo && andou < 0.15 ? parado[i] + 0.5 : 0;
        assert.ok(parado[i] <= 3, `${tema}: ${b.nome} (${b.perso}) parado ${parado[i]} s em (${b.x.toFixed(1)}, ${b.z.toFixed(1)})`);
      });
    }
  }
});

test('IA: foge de um buraco maior que chega perto (todas as personalidades)', () => {
  for (const perso of Object.keys(PERSONALIDADES)) {
    const R = criarRodada({ modo: 'classico', tema: 'cidade', semente: 5, bots: 2, nivel: 'medio' });
    const [eu, presa, grande] = R.buracos;
    eu.x = -50;
    eu.z = -50;
    raio(presa, 1.2);
    raio(grande, 3);
    presa.perso = perso;
    presa.x = 0;
    presa.z = 9;
    grande.x = 0;
    grande.z = 9 - 3 - 1.2 - 1.8;
    grande.nivel = 'fraco';
    grande.pensar = 99;
    grande.ax = grande.x;
    grande.az = grande.z;
    const d0 = Math.hypot(presa.x - grande.x, presa.z - grande.z);
    let fugiu = false;
    for (let k = 0; k < 60; k++) {
      passoRodada(R, DT, null);
      if (presa.estado === 'foge') fugiu = true;
    }
    assert.ok(fugiu, `${perso} nao fugiu`);
    assert.ok(Math.hypot(presa.x - grande.x, presa.z - grande.z) > d0 + 1.5, `${perso} nao se afastou`);
  }
});

test('IA: o cacador caca um menor (com mira na frente); nas rodadas protegidas ninguem caca', () => {
  const R = criarRodada({ modo: 'classico', tema: 'cidade', semente: 5, bots: 2, nivel: 'forte' });
  const [eu, cacador, presa] = R.buracos;
  eu.x = -50;
  eu.z = -50;
  raio(cacador, 3);
  raio(presa, 1.2);
  cacador.perso = 'cacador';
  presa.perso = 'guloso';
  cacador.x = 0;
  cacador.z = 0;
  presa.x = 7;
  presa.z = 0;
  let cacou = false;
  let engoliu = false;
  for (let k = 0; k < 8 * 60; k++) {
    for (const e of passoRodada(R, DT, null)) if (e.tipo === 'engoliu' && e.buraco === cacador.id) engoliu = true;
    if (cacador.estado === 'caca') cacou = true;
  }
  assert.ok(cacou, 'nao cacou');
  assert.ok(engoliu || Math.hypot(cacador.x - presa.x, cacador.z - presa.z) < 7, 'nao chegou perto');

  const P = criarRodada({ modo: 'classico', tema: 'cidade', semente: 5, bots: 4, nivel: 'forte', protegerJogador: true });
  for (const b of P.buracos.slice(1)) b.perso = 'cacador';
  raio(P.buracos[1], 3);
  for (let k = 0; k < 30 * 60; k++) {
    passoRodada(P, DT, piloto(P, P.buracos[0], DT));
    for (const b of P.buracos.slice(1)) assert.notEqual(b.estado, 'caca');
  }
});

test('IA: contorna predio que nao cabe na boca (sem passar por baixo nem tremer) e chega no alvo', () => {
  const R = criarRodada({ modo: 'classico', tema: 'cidade', semente: 3, bots: 1, nivel: 'medio' });
  const [eu, b] = R.buracos;
  eu.x = -50;
  eu.z = -50;
  raio(b, 1.0);
  const predio = R.objetos.find((o) => o.peca.forma === 'caixa' && o.peca.s > 2.8 && Math.abs(o.x) < 30 && Math.abs(o.z) < 30);
  // nasce de um lado do predio com o alvo do outro
  b.x = predio.x - predio.peca.s - 2.5;
  b.z = predio.z + 0.2;
  b.ax = predio.x + predio.peca.s + 2.5;
  b.az = predio.z;
  b.pensar = 99;
  b.estado = 'come';
  let menor = Infinity;
  let viradas = 0;
  let dirAnt = null;
  let chegou = false;
  for (let k = 0; k < 6 * 60; k++) {
    passoRodada(R, DT, null);
    b.pensar = 99;
    if (predio.estado === 0) menor = Math.min(menor, Math.hypot(b.x - predio.x, b.z - predio.z));
    const v = Math.hypot(b.vx, b.vz);
    if (v > 1) {
      const d = [b.vx / v, b.vz / v];
      if (dirAnt && d[0] * dirAnt[0] + d[1] * dirAnt[1] < 0) viradas++;
      dirAnt = d;
    }
    if (Math.hypot(b.ax - b.x, b.az - b.z) < 1.2) {
      chegou = true;
      break;
    }
  }
  assert.ok(menor > predio.peca.s * 0.55, `passou por baixo do predio (${menor.toFixed(2)})`);
  assert.equal(viradas, 0, 'tremeu (deu meia-volta no caminho)');
  assert.ok(chegou, 'nao chegou do outro lado');
});

test('IA: ritmo dos bots perto do jogador (placar disputado) no Classico', () => {
  const rel = [];
  for (const [k, tema] of MAPAS.entries()) {
    const R = criarRodada({ modo: 'classico', tema, semente: 50 + k, niveis: ['fraco', 'medio', 'forte', 'medio'] });
    const eu = R.buracos[0];
    while (!R.fim) passoRodada(R, DT, piloto(R, eu, DT));
    rel.push(Math.max(...R.buracos.slice(1).map((b) => b.massa)) / eu.massa);
  }
  const media = rel.reduce((a, b) => a + b, 0) / rel.length;
  assert.ok(media > 0.65 && media < 1.5, `o melhor bot fecha com ${rel.map((x) => x.toFixed(2)).join(', ')} da massa do piloto`);
});

test('cede: predio um pouco grande demais com a boca embaixo racha e cai depois de ~TEMPO_CEDE; o enorme nao', () => {
  const R = criarRodada({ modo: 'classico', tema: 'cidade', semente: 3, bots: 0 });
  const eu = R.buracos[0];
  const predio = R.objetos.find((o) => o.peca.forma === 'caixa' && o.peca.s > 2.8 && o.peca.s < 3.2);
  raio(eu, predio.peca.s / CABE / 1.08);
  eu.x = predio.x + 0.3;
  eu.z = predio.z;
  const ev = [];
  let caiu = -1;
  for (let k = 0; k < 3 * 60 && caiu < 0; k++) {
    ev.push(...passoRodada(R, DT, null));
    if (predio.estado === 1) caiu = R.t;
  }
  assert.ok(ev.some((e) => e.tipo === 'racha' && e.obj === predio.id), 'nao rachou');
  assert.ok(caiu > TEMPO_CEDE * 0.9 && caiu < TEMPO_CEDE * 1.3, `cedeu aos ${caiu.toFixed(2)} s`);

  const T = criarRodada({ modo: 'classico', tema: 'cidade', semente: 3, bots: 0 });
  const torre = T.objetos.find((o) => o.peca.forma === 'caixa' && o.peca.s > 3.8);
  raio(T.buracos[0], 2.2);
  T.buracos[0].x = torre.x;
  T.buracos[0].z = torre.z;
  for (let k = 0; k < 4 * 60; k++) passoRodada(T, DT, null);
  assert.equal(torre.estado, 0);
});

test('combo: no maximo 8 notas por segundo, o que cai junto vira acorde, polifonia limitada, sobe na pentatonica e fecha', () => {
  const c = criarCombo();
  /** @type {any[]} */
  const toques = [];
  let t = 0;
  // 40 pecas num segundo (rajada), com 3 no mesmo instante varias vezes
  for (let k = 0; k < 60; k++, t += DT) {
    if (k % 3 === 0) for (let j = 0; j < 2; j++) c.comeu(t, { s: 0.3, mat: 'metal' });
    if (k % 9 === 0) c.comeu(t, { s: 0.9, mat: 'vidro' });
    toques.push(...c.passo(t));
  }
  // silencio: o fecho chega
  for (let k = 0; k < 60; k++, t += DT) toques.push(...c.passo(t));
  const notas = toques.filter((q) => q.tipo === 'nota');
  assert.ok(notas.length <= 9, `${notas.length} notas em 1 s`);
  for (let i = 1; i < notas.length; i++) assert.ok(notas[i].t - notas[i - 1].t >= ESPACO - 1e-9, 'notas mais juntas que o ESPACO');
  assert.ok(notas.some((q) => q.graus.length >= 2), 'pecas juntas nao viraram acorde');
  assert.ok(notas.every((q) => q.graus.length <= 3));
  // a altura sobe enquanto o combo continua
  for (let i = 1; i < Math.min(8, notas.length); i++) assert.ok(notas[i].graus[0] >= notas[i - 1].graus[0]);
  assert.ok(hzDoGrau(notas[notas.length - 1].graus[0]) > hzDoGrau(notas[0].graus[0]));
  // o timbre e o da maior peca que caiu
  assert.ok(notas.some((q) => q.mat === 'vidro'));
  const fecho = toques.filter((q) => q.tipo === 'fecho');
  assert.equal(fecho.length, 1);
  assert.ok(fecho[0].t - notas[notas.length - 1].t >= 0.5, 'o fecho veio antes do silencio');
  // escala: graus da pentatonica maior
  assert.deepEqual(ESCALA, [0, 2, 4, 7, 9]);

  // polifonia: nunca mais que VOZES soando
  const p = criarCombo();
  let soando = [];
  for (let k = 0, tt = 0; k < 120; k++, tt += DT) {
    for (let j = 0; j < 5; j++) p.comeu(tt, { s: 0.3, mat: 'madeira' });
    for (const q of p.passo(tt)) if (q.tipo === 'nota') for (let v = 0; v < q.graus.length; v++) soando.push(tt + 0.32);
    soando = soando.filter((f) => f > tt);
    assert.ok(soando.length <= VOZES, `${soando.length} vozes`);
  }
});

/** Contexto de audio falso que anota o comeco de cada fonte e o ataque de cada envelope. */
function contextoFalso() {
  const inicios = [];
  const ataques = [];
  const param = (ganho) => {
    let t0 = null;
    return {
      value: 0,
      setValueAtTime(_v, t) { if (ganho && t0 === null) t0 = t; },
      linearRampToValueAtTime() {},
      exponentialRampToValueAtTime(_v, t) { if (ganho && t0 !== null && !this.feito) { ataques.push(t - t0); this.feito = true; } },
      setTargetAtTime() {}, cancelScheduledValues() {},
    };
  };
  const no = (extra = {}) => ({ connect() { return this; }, disconnect() {}, ...extra });
  const ctx = {
    sampleRate: 8000,
    currentTime: 0,
    createOscillator: () => no({ frequency: param(false), detune: param(false), type: 'sine', setPeriodicWave() {}, start(t) { inicios.push(t); }, stop() {} }),
    createGain: () => no({ gain: param(true) }),
    createBiquadFilter: () => no({ type: '', frequency: param(false), Q: param(false), gain: param(false) }),
    createBufferSource: () => no({ buffer: null, loop: false, start(t) { inicios.push(t); }, stop() {} }),
    createBuffer: (_c, n) => ({ getChannelData: () => new Float32Array(n) }),
  };
  return { v: { ctx, destino: no() }, inicios, ataques };
}

test('som: cada nota do combo e um toque so (acorde junto), sem ruido, com ataque suave em todo som', () => {
  for (const mat of Object.keys(TIMBRES)) {
    const { v, inicios, ataques } = contextoFalso();
    SONS.nota(/** @type {any} */ (v), 0, { graus: [3, 5, 7], mat, mat2: 'vidro', s: 0.8 });
    assert.equal(new Set(inicios).size, 1, `${mat}: toques em instantes diferentes`);
    assert.ok(ataques.every((a) => a >= 0.008 - 1e-9), `${mat}: ataque duro (${Math.min(...ataques)})`);
  }
  for (const [nome, receita] of Object.entries(SONS)) {
    const { v, ataques, inicios } = contextoFalso();
    let ruido = 0;
    /** @type {any} */ (v.ctx).createBufferSource = () => { ruido++; return { connect() { return this; }, start(t) { inicios.push(t); }, stop() {} }; };
    receita(/** @type {any} */ (v), 0, { s: 1, n: 2, ganhou: true, v: 0.5, graus: [0, 2], mat: 'metal' });
    assert.equal(ruido, 0, `${nome}: ruido junto do som`);
    assert.ok(ataques.every((a) => a >= 0.008 - 1e-9), `${nome}: ataque duro (${Math.min(...ataques)})`);
  }
});

test('materiais: toda peca de todo tema tem um material com timbre', () => {
  for (const tema of MAPAS) {
    for (const p of [...Object.values(TEMAS[tema].grupos).flat(), TEMAS[tema].gigante]) {
      const m = materialDe(tema, p);
      assert.ok(TIMBRES[m], `${tema}/${p.id}: material ${m} sem timbre`);
    }
  }
  assert.equal(VANTAGEM > 1, true);
});
