// Testes da v0.2.0: vida da cidade (pessoas e carros), queda com fisica e sons sem "catraca".
import test from 'node:test';
import assert from 'node:assert/strict';
import { criarRodada, passoRodada } from '../src/jogo/rodada.js';
import { FAIXA } from '../src/jogo/mapa.js';
import { TEMAS, MAPAS } from '../src/jogo/catalogo.js';
import { SONS } from '../src/som/sons.js';

/** Roda s segundos (60 passos por segundo) e junta os eventos. */
function rodar(R, s, ent = null, cada = null) {
  const ev = [];
  for (let k = 0; k < Math.round(s * 60); k++) {
    ev.push(...passoRodada(R, 1 / 60, ent));
    if (cada) cada();
  }
  return ev;
}

test('vida: o mapa tem gente andando, grupinhos parados e carros rodando em todos os temas', () => {
  for (const tema of MAPAS) {
    const R = criarRodada({ modo: 'classico', tema, semente: 2, bots: 0 });
    const ia = R.objetos.filter((o) => o.ia);
    const andam = ia.filter((o) => o.ia.tipo === 'pessoa' && o.ia.modo === 'anda').length;
    const parados = ia.filter((o) => o.ia.tipo === 'pessoa' && o.ia.modo === 'parado').length;
    const carros = ia.filter((o) => o.ia.tipo === 'carro').length;
    assert.ok(andam > 80 && parados > 40 && carros > 10, `${tema}: ${andam} andando, ${parados} parados, ${carros} carros`);
    // mais predios que na v0.1: pelo menos 70 caixas no Classico
    const predios = R.objetos.filter((o) => o.peca.forma === 'casa' || o.peca.forma === 'caixa').length;
    assert.ok(predios >= 70, `${tema}: ${predios} predios`);
    assert.ok(R.objetos.some((o) => TEMAS[tema].grupos.marco.includes(o.peca)), `${tema}: sem marco`);
  }
});

test('vida: quem anda vira a esquina e atravessa na faixa, sem sair do mapa', () => {
  const R = criarRodada({ modo: 'classico', tema: 'cidade', semente: 5, bots: 0 });
  const eu = R.buracos[0];
  eu.x = -58;
  eu.z = -58;
  const andam = R.objetos.filter((o) => o.ia && o.ia.tipo === 'pessoa' && o.ia.modo === 'anda');
  const bloco0 = new Map(andam.map((o) => [o.id, o.ia.blk]));
  rodar(R, 40, { x: 0, z: 0 });
  const atravessaram = andam.filter((o) => o.ia.blk !== bloco0.get(o.id)).length;
  assert.ok(atravessaram > 10, `so ${atravessaram} atravessaram`);
  for (const o of andam) assert.ok(Math.abs(o.x) < R.lado / 2 && Math.abs(o.z) < R.lado / 2);
});

test('vida: o buraco chega perto, a pessoa grita e foge correndo; a da trilha acena', () => {
  const R = criarRodada({ modo: 'classico', tema: 'cidade', semente: 5, bots: 0, roteiro: true });
  const eu = R.buracos[0];
  const p = R.objetos.find((o) => o.ia && o.ia.tipo === 'pessoa' && o.ia.modo === 'anda' && Math.hypot(o.x, o.z) > 25);
  eu.x = p.x + 2.4;
  eu.z = p.z;
  const d0 = Math.hypot(p.x - eu.x, p.z - eu.z);
  const ev = rodar(R, 1.2);
  assert.ok(ev.some((e) => e.tipo === 'grito' && e.obj === p.id), 'nao gritou');
  assert.equal(p.ia.modo, 'foge');
  assert.ok(Math.hypot(p.x - eu.x, p.z - eu.z) > d0 + 1, 'nao correu');

  const R2 = criarRodada({ modo: 'classico', tema: 'cidade', semente: 5, bots: 0, roteiro: true });
  const calma = R2.objetos.find((o) => o.ia && o.ia.calmo);
  R2.buracos[0].x = calma.x;
  R2.buracos[0].z = calma.z - 2.2;
  const ev2 = rodar(R2, 0.5);
  assert.ok(!ev2.some((e) => e.tipo === 'grito' && e.obj === calma.id));
  assert.equal(calma.ia.modo, 'acena');
});

test('vida: carros rodam na mao direita e viram nas esquinas', () => {
  const R = criarRodada({ modo: 'classico', tema: 'cidade', semente: 8, bots: 0 });
  const eu = R.buracos[0];
  eu.x = -58;
  eu.z = -58;
  const carros = R.objetos.filter((o) => o.ia && o.ia.tipo === 'carro');
  const rua0 = new Map(carros.map((c) => [c.id, `${c.ia.eixo}${c.ia.L}`]));
  let fora = 0;
  rodar(R, 30, { x: 0, z: 0 }, () => {
    for (const c of carros) {
      if (c.estado || c.ia.curva) continue;
      const off = c.ia.eixo === 'h' ? (c.z - c.ia.L) * c.ia.dir : -(c.x - c.ia.L) * c.ia.dir;
      if (Math.abs(off - FAIXA) > 1e-6) fora++;
    }
  });
  assert.equal(fora, 0, 'carro fora da faixa');
  const viraram = carros.filter((c) => `${c.ia.eixo}${c.ia.L}` !== rua0.get(c.id)).length;
  assert.ok(viraram >= carros.length / 3, `so ${viraram} de ${carros.length} viraram`);
});

test('vida: o carro para antes do buraco e buzina', () => {
  const R = criarRodada({ modo: 'classico', tema: 'cidade', semente: 8, bots: 0 });
  const c = R.objetos.find((o) => o.ia && o.ia.tipo === 'carro' && !o.ia.curva);
  const eu = R.buracos[0];
  eu.x = c.x + Math.cos(c.ang) * 3.4;
  eu.z = c.z + Math.sin(c.ang) * 3.4;
  const ev = rodar(R, 2);
  assert.equal(c.estado, 0);
  assert.ok(c.ia.vel < 0.05, `nao parou (vel ${c.ia.vel})`);
  assert.ok(Math.hypot(c.x - eu.x, c.z - eu.z) > eu.r + 0.5);
  assert.ok(ev.some((e) => e.tipo === 'buzina' && e.obj === c.id), 'nao buzinou');
});

test('queda: a peca tomba na borda antes de cair, desce em espiral e fica dentro do tubo', () => {
  const R = criarRodada({ modo: 'classico', tema: 'cidade', semente: 4, bots: 0, raio: 3 });
  const eu = R.buracos[0];
  const casa = R.objetos.find((o) => o.peca.forma === 'casa' && o.peca.s > 1.8);
  eu.x = casa.x - 1.2;
  eu.z = casa.z;
  rodar(R, 1 / 60);
  assert.equal(casa.estado, 1);
  const ys = [];
  const angs = [];
  let dMax = 0;
  for (let k = 0; k < 150 && casa.estado === 1; k++) {
    rodar(R, 1 / 60);
    ys.push(casa.y);
    if (Math.hypot(casa.x - eu.x, casa.z - eu.z) > 0.1) angs.push(Math.atan2(casa.z - eu.z, casa.x - eu.x));
    dMax = Math.max(dMax, Math.hypot(casa.x - eu.x, casa.z - eu.z));
  }
  assert.equal(ys[5], 0, 'caiu sem tombar antes');
  assert.ok(ys[1] === 0 && casa.incl > 0.78, 'nao inclinou');
  assert.ok(Math.min(...ys) < -3, 'nao desceu');
  assert.ok(dMax <= eu.r + 1e-6, 'atravessou a parede do buraco');
  assert.ok(Math.max(...angs.map((a) => Math.abs(a - angs[0]))) > 0.05 || dMax < 0.1, 'nao girou em volta do centro');
});

/** Contexto de audio falso: anota quando cada fonte comeca. */
function contextoFalso() {
  const inicios = [];
  const param = () => ({ value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime() {}, cancelScheduledValues() {} });
  const no = (extra = {}) => ({ connect() { return this; }, disconnect() {}, ...extra });
  const ctx = {
    sampleRate: 8000,
    currentTime: 0,
    createOscillator: () => no({ frequency: param(), detune: param(), type: 'sine', setPeriodicWave() {}, start(t) { inicios.push(t); }, stop() {} }),
    createGain: () => no({ gain: param() }),
    createBiquadFilter: () => no({ type: '', frequency: param(), Q: param(), gain: param() }),
    createBufferSource: () => no({ buffer: null, loop: false, start(t) { inicios.push(t); }, stop() {} }),
    createBuffer: (_c, n) => ({ getChannelData: () => new Float32Array(n) }),
  };
  return { v: { ctx, destino: no() }, inicios };
}

test('som: nenhum som e uma "catraca" (fila de toques curtos); sem tique-taque', () => {
  assert.equal(/** @type {any} */ (SONS).tique, undefined);
  for (const [nome, receita] of Object.entries(SONS)) {
    const { v, inicios } = contextoFalso();
    receita(/** @type {any} */ (v), 0, { s: 1, n: 2, ganhou: true, v: 0.5 });
    const tempos = [...new Set(inicios.map((t) => t.toFixed(3)))];
    assert.ok(tempos.length <= 2, `${nome}: ${tempos.length} toques em sequencia (${tempos.join(', ')})`);
  }
});
