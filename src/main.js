// Pothole Party.io: montagem do jogo. O UNICO modulo que toca portal, DOM, audio e salvamento
// (test/estilo.test.js). Ciclo do portal como no kit (jogos/distribuicao/kit/src/main.js):
//
//  1. ganchos do portal ANTES do init (anuncio cala o audio e congela o laco; mudo e pausa do portal);
//  2. portal.init() primeiro, sem nada pesado antes (o handshake do californiagames.io dura 1,5 s);
//  3. carregar a arte com gameLoadingProgress; o laco so comeca depois do init;
//  4. idioma do portal (Poki: vazio, vale o navegador); progresso da nuvem do portal quando existe;
//  5. gameLoadingFinished no primeiro quadro; gameplayStart SO em jogadorAgiu() (gesto real);
//  6. commercialBreak SO em pausa natural (entre rodadas) e so a partir da 3a rodada (~4 min de jogo);
//  7. video premiado so por escolha, fora da rodada (painel entre rodadas), com opcao gratis do mesmo tamanho;
//  8. ESC, espaco ou P pausam; aba oculta pausa; o mudo do portal nao desfaz o do jogador;
//  9. portal.intervaloSoNoClique (Y8): o intervalo so sai no clique do "Jogar" entre rodadas (nunca pelo
//     teclado nem automatico) e com 180 s desde o anterior; portal.pausaNoBlur (Y8): perder o foco pausa.
import { portal, PLATAFORMA } from './core/plataforma.js';
import { criarArmazem } from './core/armazenamento.js';
import { criarAudio } from './core/audio.js';
import { criarHaptico } from './core/haptico.js';
import { criarLaco } from './core/laco.js';
import { criarEntrada } from './core/entrada.js';
import { lerDepuracao } from './core/depuracao.js';
import { criarTelemetria } from './core/telemetria.js';
import { escolherIdioma, definirIdioma, aplicarTextos, t, idioma, ordinal } from './i18n/textos.js';
import { criarMao, celebrar, botaoPremiado } from './ui/kit.js';
import { SONS } from './som/sons.js';
import { criarCombo } from './som/combo.js';
import { criarCena } from './render/cena.js';
import { recursosDoTema, urlsDoTema, carregarTodas, urlSkin, urlIcone, ICONES, N_SKINS } from './render/recursos.js';
import { criarRodada, passoRodada, jogador, placar, colocacao, fracaoComida } from './jogo/rodada.js';
import { piloto } from './jogo/ia.js';
import { CABE } from './jogo/buraco.js';
import { MAPAS, materialDe } from './jogo/catalogo.js';
import {
  perfilNovo, normalizarPerfil, proximaRodada, fecharRodada, nivelDe, liberados, skinLiberada,
  desafioDoDia, desafioAberto, desafioCumprido, estrelasSolo,
} from './jogo/progresso.js';

/** Ajuda automatica quando o jogador passa este tempo sem engolir nada (s). */
const AJUDA_APOS = 6;
/** Raio inicial do premio "Comecar maior". */
const RAIO_PREMIO = 1.35;

const dbg = lerDepuracao(['mapa', 'modo', 'rodada', 'tamanho', 'foco']);
const armazem = criarArmazem({ prefixo: 'gulphole.' });
const audio = criarAudio();
const haptico = criarHaptico();
const tele = criarTelemetria(portal);

const $ = (/** @type {string} */ id) => /** @type {HTMLElement} */ (document.getElementById(id));
const tela = /** @type {HTMLCanvasElement} */ ($('tela'));
const camada = $('camada');
const mao = criarMao(camada);
const celular = matchMedia('(pointer: coarse)').matches;
const cena = criarCena(tela, { filme: dbg.filme > 0, leve: celular });

// ------------------------------------------------------------------ estado
const E = {
  perfil: perfilNovo(),
  /** @type {any} */
  R: null,
  /** @type {any} */
  cfg: null,
  nRodada: 1,
  t: 0,
  rodando: false,
  fimAberto: false,
  iniciando: false,
  pausado: false,
  pausaPortal: false,
  menu: false,
  skinsAberto: false,
  jogou: false,
  rodadasSessao: 0,
  semProgresso: 0,
  ajudaMostrada: false,
  /** @type {{ modo?: string, tema?: string }} */
  escolha: {},
  /** @type {any} */
  desafio: null,
  /** combo de sons ao engolir (src/som/combo.js: 8 notas/s no maximo, acorde para o que cai junto) */
  combo: criarCombo(),
  /** predios que ja tocaram o rangido de rachar */
  rachou: /** @type {Set<number>} */ (new Set()),
  /** ultima vez que tocou grito e buzina (E.t) */
  somVida: /** @type {Record<string, number>} */ ({}),
  casaFeita: false,
  coroa: false,
  trilhaI: 0,
  ultimoTique: 0,
  avisosDegrau: 0,
  /** compatibilidade com os roteiros do kit (fase = rodada) */
  get fase() { return E.nRodada; },
};

const teclas = new Set();
const P = { ativo: false, ox: 0, oy: 0, x: 0, y: 0, toque: false };
const mouse = { x: 0, y: 0, tem: false };

const hoje = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

function carregarPerfil() {
  E.perfil = dbg.novo ? perfilNovo() : normalizarPerfil(armazem.ler('perfil', null));
  const r = Number(dbg.extras.rodada);
  if (dbg.extras.rodada !== undefined && Number.isFinite(r)) {
    E.perfil.rodadas = Math.max(0, r | 0);
    E.perfil.xp = Math.max(E.perfil.xp, E.perfil.rodadas * 110);
  }
}
function salvar() {
  armazem.gravar('perfil', E.perfil);
}

// ------------------------------------------------------------------ portal: ganchos antes do init
const laco = criarLaco({ passo, desenhar });
portal.onAdStart = () => {
  audio.mudoParaAnuncio();
  laco.pausar(true);
};
portal.onAdEnd = () => {
  audio.voltarDoAnuncio();
  if (!congelado()) laco.pausar(false);
};
portal.onMudoPlataforma = (m) => audio.definirMudoPlataforma(m);
portal.onPausaPlataforma = (p) => {
  E.pausaPortal = p;
  if (p) portal.gameplayStop();
  laco.pausar(congelado() || portal.emAnuncio);
};
portal.onSemAnuncios = () => atualizarVideo();

const congelado = () => E.pausado || E.pausaPortal || E.menu;

/** Unico lugar com gameplayStart: gesto real do jogador, fora de pausa, de anuncio e do painel. */
function jogadorAgiu() {
  if (congelado() || portal.emAnuncio || E.fimAberto || E.iniciando) return;
  E.jogou = true;
  // a rodada "armada" comeca no primeiro gesto
  if (E.R && !E.R.fim && !E.rodando) E.rodando = true;
  portal.gameplayStart();
}

// ------------------------------------------------------------------ laco (passo fixo)
/** @param {number} dt */
function passo(dt) {
  if (congelado()) return;
  E.t += dt;
  if (portal.jogando) tele.jogando(dt);
  if (dbg.auto && E.R && !E.R.fim && !E.fimAberto && !E.iniciando) E.rodando = true;
  if (E.R && E.rodando && !E.R.fim) {
    const eu = jogador(E.R);
    const ent = dbg.auto ? piloto(E.R, eu, dt) : entradaAtual(eu);
    const ev = passoRodada(E.R, dt, ent);
    E.semProgresso += dt;
    for (const e of ev) tratarEvento(e);
    for (const toque of E.combo.passo(E.t)) {
      if (toque.tipo === 'nota') audio.tocarReceita(SONS.nota, toque, { chave: 'nota', max: 4 });
      else audio.tocarReceita(SONS.fecho, toque, { chave: 'fecho', max: 1 });
    }
    // 10 s finais: so o aviso e o relogio pulsando (sem tique-taque: pedido do usuario na v0.2.0)
    if (E.R.duracao - E.R.t < 10.5 && !E.R.fim) {
      const s = Math.ceil(E.R.duracao - E.R.t);
      if (s !== E.ultimoTique && s > 0) {
        E.ultimoTique = s;
        if (s === 10) aviso(t('dezSeg'));
      }
    }
  }
  guia();
}

/** Direcao do jogador: teclado, arrasto (toque) ou cursor (mouse). @param {any} eu */
function entradaAtual(eu) {
  let x = 0;
  let z = 0;
  if (teclas.size) {
    if (teclas.has('ArrowLeft') || teclas.has('KeyA')) x -= 1;
    if (teclas.has('ArrowRight') || teclas.has('KeyD')) x += 1;
    if (teclas.has('ArrowUp') || teclas.has('KeyW')) z -= 1;
    if (teclas.has('ArrowDown') || teclas.has('KeyS')) z += 1;
    const n = Math.hypot(x, z);
    return n ? { x: x / n, z: z / n } : { x: 0, z: 0 };
  }
  if (P.ativo && P.toque) {
    const dx = P.x - P.ox;
    const dy = P.y - P.oy;
    const n = Math.hypot(dx, dy);
    if (n < 6) return { x: 0, z: 0 };
    const k = Math.min(1, n / 55) / n;
    return { x: dx * k, z: dy * k };
  }
  if (mouse.tem && E.jogou) {
    const c = cena.projetar(eu.x, 0, eu.z);
    const dx = mouse.x - c.x;
    const dy = mouse.y - c.y;
    const n = Math.hypot(dx, dy);
    if (n < 18) return { x: 0, z: 0 };
    const k = Math.min(1, (n - 18) / 110) / n;
    return { x: dx * k, z: dy * k };
  }
  return { x: 0, z: 0 };
}

// ------------------------------------------------------------------ eventos da rodada
/** @param {any} e */
function tratarEvento(e) {
  const R = E.R;
  if (e.tipo === 'comeu' && e.buraco === 0) {
    E.semProgresso = 0;
    E.ajudaMostrada = false;
    const ob = R.objetos[e.obj];
    // toda peca entra no combo (o timbre e do material); as grandes tambem desabam
    E.combo.comeu(E.t, { s: e.s, mat: materialDe(R.tema, ob.peca) });
    if (e.s >= 1.3) {
      audio.tocarReceita(SONS.desaba, { s: e.s }, { chave: 'desaba', max: 2 });
      haptico.vibrar(30);
      const gig = R.gigante && R.gigante.id === e.obj;
      if (gig) {
        aviso(t('giganteComido'));
        tele.evento('gigante', 'engolido');
        portal.festa();
      } else if (ob.peca.forma === 'casa' && !E.casaFeita) {
        E.casaFeita = true;
        tele.evento('casa', 'primeira');
        celebrar(camada, t('casa'), { ms: 1700 });
      } else if (e.s >= 2.8) aviso(t('predio'));
    } else if (e.s > 0.7) haptico.vibrar(8);
  } else if (e.tipo === 'degrau' && e.buraco !== 0) {
    // bot crescendo a vista: a mesma rachadura e as lascas (sem som nem onda)
    cena.crescer(e.buraco);
  } else if (e.tipo === 'degrau' && e.buraco === 0) {
    audio.tocarReceita(SONS.abrir, { n: e.degrau }, { chave: 'abrir', max: 1 });
    cena.crescer(0);
    // texto curto so nas primeiras rodadas
    if (E.perfil.rodadas < 2 && E.avisosDegrau < 3) {
      E.avisosDegrau++;
      aviso(t('cresceu'));
    }
  } else if (e.tipo === 'racha') {
    // predio grande demais rachando em cima da boca do jogador: um rangido por predio
    if (e.buraco === 0 && !E.rachou.has(e.obj)) {
      E.rachou.add(e.obj);
      audio.tocarReceita(SONS.racha, {}, { chave: 'racha', max: 1 });
      haptico.vibrar(15);
    }
  } else if (e.tipo === 'grito' || e.tipo === 'buzina') {
    // vida da cidade: so o que esta perto do jogador faz barulho, espacado (nada de fila de sons)
    const eu = jogador(R);
    const perto = Math.hypot(e.x - eu.x, e.z - eu.z) < 9 + eu.r * 3;
    if (perto && E.t - (E.somVida[e.tipo] || -9) > (e.tipo === 'grito' ? 0.45 : 0.9)) {
      E.somVida[e.tipo] = E.t;
      if (e.tipo === 'grito') audio.tocarReceita(SONS.grito, { v: e.v }, { chave: 'grito', max: 1 });
      else audio.tocarReceita(SONS.buzina, { grave: e.grave }, { chave: 'buzina', max: 1 });
    }
  } else if (e.tipo === 'engoliu') {
    cena.nuvem(e.x, e.z, Math.max(0.6, R.buracos[e.vitima].r));
    if (e.buraco === 0 || e.vitima === 0) cena.tremer(0.28);
    if (e.buraco === 0) {
      audio.tocarReceita(SONS.engoliu, {}, { chave: 'engoliu' });
      aviso(t('engoliu', { n: R.buracos[e.vitima].nome }));
      cena.pulso(e.x, e.z, 0.5, 4, 0xff6f61, 0.7);
      haptico.vibrar(40);
      E.semProgresso = 0;
    } else if (e.vitima === 0) {
      audio.tocarReceita(SONS.engolido, {}, { chave: 'engolido' });
      aviso(t('engolido', { n: R.buracos[e.buraco].nome }));
      haptico.vibrar([30, 40, 30]);
    }
  } else if (e.tipo === 'renasceu' && e.buraco === 0) {
    audio.tocarReceita(SONS.renasceu, {}, { chave: 'renasceu' });
  } else if (e.tipo === 'gigante') {
    audio.tocarReceita(SONS.gigante, {}, { chave: 'gigante' });
    aviso(t('gigante'));
    tele.evento('gigante', 'apareceu');
  } else if (e.tipo === 'fim') {
    fimDaRodada();
  }
}

let avisoTimer = 0;
/** Texto curto no topo (some sozinho). @param {string} txt */
/** ate quando o aviso longo (com sub) fica: um aviso curto ("Maior!") nao o apaga antes de ser lido */
let avisoLongoAte = 0;
/** Aviso grande no meio da tela; com sub, uma linha menor embaixo e o aviso fica mais tempo. */
function aviso(txt, sub = '') {
  const agora = performance.now();
  if (!sub && agora < avisoLongoAte) return;
  avisoLongoAte = sub ? agora + 3000 : 0;
  const el = $('aviso');
  el.textContent = txt;
  if (sub) {
    const s = document.createElement('small');
    s.textContent = sub;
    el.appendChild(s);
  }
  el.classList.toggle('longo', !!sub);
  el.classList.remove('mostra');
  void el.offsetWidth;
  el.classList.add('mostra');
  clearTimeout(avisoTimer);
  avisoTimer = window.setTimeout(() => el.classList.remove('mostra'), sub ? 3400 : 1700);
}

// ------------------------------------------------------------------ mao-guia e ajuda automatica
function guia() {
  const R = E.R;
  if (!R || E.fimAberto || R.fim || dbg.auto || dbg.limpo) {
    mao.esconder();
    return;
  }
  const eu = jogador(R);
  if (!eu.vivo) {
    mao.esconder();
    return;
  }
  /** @type {{ x: number, z: number }|null} */
  let alvo = null;
  const trilha = R.mapa.trilha || [];
  if (trilha.length && !E.casaFeita && R.t < 35) {
    while (E.trilhaI < trilha.length - 1 && Math.hypot(trilha[E.trilhaI].x - eu.x, trilha[E.trilhaI].z - eu.z) < 2.4) E.trilhaI++;
    alvo = trilha[E.trilhaI];
  } else if (!E.rodando) {
    alvo = comidaPerto(eu);
  } else if (E.semProgresso > AJUDA_APOS) {
    alvo = comidaPerto(eu);
    if (alvo && !E.ajudaMostrada) {
      E.ajudaMostrada = true;
      tele.ajuda(E.nRodada);
    }
  }
  // a mao some enquanto o dedo arrasta (nao atrapalha), e aparece antes do primeiro gesto
  if (!alvo || (P.ativo && E.rodando)) {
    mao.esconder();
    return;
  }
  const a = cena.projetar(eu.x, 0, eu.z);
  const dx = alvo.x - eu.x;
  const dz = alvo.z - eu.z;
  const n = Math.hypot(dx, dz) || 1;
  const b = cena.projetar(eu.x + (dx / n) * Math.min(n, 5), 0, eu.z + (dz / n) * Math.min(n, 5));
  mao.mostrar(a.x, a.y, { ateX: b.x, ateY: b.y });
}

/** Peca que cabe mais perto do jogador. @param {any} eu */
function comidaPerto(eu) {
  let melhor = null;
  let d = Infinity;
  E.R.grade.perto(eu.x, eu.z, 14, (/** @type {number} */ id) => {
    const o = E.R.objetos[id];
    if (o.estado !== 0 || o.peca.s >= eu.r * CABE) return;
    const dd = Math.hypot(o.x - eu.x, o.z - eu.z);
    if (dd < d) {
      d = dd;
      melhor = o;
    }
  });
  return melhor;
}

// ------------------------------------------------------------------ desenho e HUD
let W = 0;
let H = 0;
function medir() {
  const dpr = Math.min(celular ? 1.5 : 2, window.devicePixelRatio || 1);
  W = window.innerWidth;
  H = window.innerHeight;
  cena.medir(W, H, dpr);
}

/** @param {number} [dtReal] */
function desenhar(dtReal) {
  const dt = dbg.filme ? 1 / dbg.filme : Math.min(0.1, dtReal || 1 / 60);
  if (E.R) {
    // ?foco=N (so localhost): a camera segue o bot N (provas da IA)
    const foco = Number(dbg.extras.foco) > 0 ? Math.min(E.R.buracos.length - 1, Number(dbg.extras.foco)) : 0;
    cena.atualizar(dt, E.t, { foco });
    cena.desenhar();
    hud();
  }
  if (dbg.debug) depurar();
  primeiroQuadro();
}

/** ?debug: fps, ms do passo e do desenho, chamadas de desenho. */
let painelDbg = /** @type {HTMLElement|null} */ (null);
function depurar() {
  if (!painelDbg) {
    painelDbg = document.createElement('div');
    painelDbg.style.cssText = 'position:fixed;left:8px;bottom:8px;font:12px monospace;background:#000a;color:#0f0;padding:4px 6px;z-index:99;pointer-events:none';
    document.body.appendChild(painelDbg);
  }
  const m = laco.medidas;
  const info = cena.renderer.info.render;
  painelDbg.textContent = `${m.fps.toFixed(0)} fps · passo ${m.passoMs.toFixed(2)} ms · desenho ${m.desenhoMs.toFixed(2)} ms · ${info.calls} draws · ${info.triangles} tri`;
}

/** @type {{ el: HTMLElement, nome: HTMLElement, coroa: HTMLImageElement }[]} */
const rotulos = [];
function criarRotulos() {
  const raiz = $('rotulos');
  raiz.textContent = '';
  rotulos.length = 0;
  for (const b of E.R.buracos) {
    const el = document.createElement('div');
    el.className = `rotulo${b.jogador ? ' eu' : ''}`;
    const coroa = document.createElement('img');
    coroa.src = urlIcone('coroa');
    coroa.alt = '';
    coroa.hidden = true;
    const nome = document.createElement('span');
    nome.textContent = b.nome;
    el.append(coroa, nome);
    raiz.appendChild(el);
    rotulos.push({ el, nome, coroa });
  }
}

let hudT = 0;
let relogioTxt = '';
function hud() {
  const R = E.R;
  if (dbg.limpo) {
    for (const r of rotulos) r.el.hidden = true;
    return;
  }
  const lista = placar(R);
  const lider = lista[0];
  // rotulos (todo quadro)
  R.buracos.forEach((b, i) => {
    const r = rotulos[i];
    if (!r) return;
    const vis = b.vivo && !b.fora;
    if (!vis) {
      r.el.hidden = true;
      return;
    }
    const p = cena.projetar(b.x, 0, b.z - b.r * 1.12);
    r.el.hidden = !p.dentro;
    r.el.style.transform = `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px) translate(-50%, -100%)`;
    r.coroa.hidden = b !== lider || R.modo === 'solo';
  });
  // seta do gigante
  const seta = $('seta');
  const gid = R.gigante ? R.gigante.id : -1;
  const gig = gid >= 0 ? R.objetos[gid] : null;
  if (gig && gig.estado === 0 && E.rodando) {
    const p = cena.projetar(gig.x, 2, gig.z);
    if (p.dentro) seta.hidden = true;
    else {
      const ang = Math.atan2(-p.ny, p.nx);
      const m = 44;
      const k = Math.min((W / 2 - m) / Math.max(1e-3, Math.abs(Math.cos(ang))), (H / 2 - m) / Math.max(1e-3, Math.abs(Math.sin(ang))));
      seta.hidden = false;
      seta.style.left = `${W / 2 + Math.cos(ang) * k}px`;
      seta.style.top = `${H / 2 + Math.sin(ang) * k}px`;
      seta.style.setProperty('--ang', `${(ang * 180) / Math.PI}deg`);
    }
  } else seta.hidden = true;
  // relogio e placar (4 vezes por segundo)
  hudT -= 1 / 60;
  const resto = Math.max(0, R.duracao - R.t);
  const txt = `${Math.floor(resto / 60)}:${String(Math.floor(resto % 60)).padStart(2, '0')}`;
  if (txt !== relogioTxt) {
    relogioTxt = txt;
    $('relogio').textContent = txt;
    $('relogio').classList.toggle('acabando', resto < 10.5 && E.rodando);
  }
  if (hudT > 0) return;
  hudT = 0.25;
  const eu = jogador(R);
  if (R.modo === 'solo') {
    const f = Math.min(1, fracaoComida(R));
    /** @type {HTMLElement} */ ($('barraSolo').firstElementChild).style.width = `${(f * 100).toFixed(1)}%`;
    /** @type {HTMLElement} */ ($('barraSolo').lastElementChild).textContent = `${Math.floor(f * 100)}%`;
  }
  if (R.modo === 'batalha') $('vivos').textContent = t('vivos', { n: R.buracos.filter((b) => !b.fora).length });
  const ol = $('placar');
  if (R.modo === 'solo') {
    ol.hidden = true;
  } else {
    ol.hidden = false;
    const top = lista.slice(0, celular && W < 520 ? 4 : 5);
    if (!top.includes(eu)) top.push(eu);
    ol.innerHTML = '';
    for (const b of top) {
      const li = document.createElement('li');
      if (b === eu) li.className = 'eu';
      const pos = document.createElement('b');
      pos.textContent = String(lista.indexOf(b) + 1);
      const nome = document.createElement('span');
      nome.className = 'nome';
      nome.textContent = b.nome;
      const pts = document.createElement('span');
      pts.className = 'pts';
      pts.textContent = String(b.pontos);
      li.append(pos);
      if (b === lider) {
        const c = document.createElement('img');
        c.src = urlIcone('coroa');
        c.alt = '';
        li.append(c);
      }
      li.append(nome, pts);
      ol.appendChild(li);
    }
  }
  // coroa: aviso uma vez por rodada
  if (lider === eu && R.modo !== 'solo' && !E.coroa && E.rodando && R.t > 5) {
    E.coroa = true;
    aviso(t('coroa'));
  }
}

let carregouJa = false;
function primeiroQuadro() {
  if (carregouJa) return;
  carregouJa = true;
  portal.gameLoadingFinished();
  $('carregando').classList.add('saindo');
  setTimeout(() => $('carregando').remove(), 400);
}

// ------------------------------------------------------------------ rodadas
const sementeNova = () => (dbg.semente ? dbg.semente + E.rodadasSessao * 7919 : (Math.random() * 2 ** 31) >>> 0);

/** @param {{ raio?: number }} [o] */
async function novaRodada(o = {}) {
  const cfg = proximaRodada(E.perfil, E.escolha);
  if (dbg.extras.mapa && MAPAS.includes(/** @type {any} */ (dbg.extras.mapa)) && E.rodadasSessao === 0) cfg.tema = dbg.extras.mapa;
  if (dbg.extras.modo && E.rodadasSessao === 0 && ['classico', 'solo', 'batalha'].includes(dbg.extras.modo)) cfg.modo = dbg.extras.modo;
  E.cfg = cfg;
  const dia = hoje();
  const d = desafioDoDia(dia);
  E.desafio = desafioAberto(E.perfil, dia) && cfg.modo === 'classico' && cfg.tema === d.tema ? d : null;
  const rec = await recursosDoTema(cfg.tema);
  const raio = o.raio || (Number(dbg.extras.tamanho) > 0 ? Number(dbg.extras.tamanho) : 0);
  E.R = criarRodada({
    modo: cfg.modo, tema: cfg.tema, semente: sementeNova(), bots: cfg.bots, niveis: cfg.niveis,
    roteiro: cfg.roteiro && !raio, protegerJogador: cfg.protegerJogador, skin: E.perfil.skin, nome: t('voce'), raio: raio || undefined,
  });
  cena.montar(E.R, rec);
  E.combo.zerar();
  E.rachou.clear();
  criarRotulos();
  E.nRodada = E.perfil.rodadas + 1;
  E.rodando = false;
  E.casaFeita = !cfg.roteiro;
  E.coroa = false;
  E.trilhaI = 0;
  E.semProgresso = 0;
  E.ajudaMostrada = false;
  E.ultimoTique = 0;
  E.avisosDegrau = 0;
  $('barraSolo').hidden = cfg.modo !== 'solo';
  $('vivos').hidden = cfg.modo !== 'batalha';
  relogioTxt = '';
  hudT = 0;
  tele.fase(E.nRodada, 'start');
  tele.evento('rodada', `${cfg.modo}-${cfg.tema}`);
  // Solo (sem bots) e Batalha (arena menor) se explicam: sem isso, parecia que os bots tinham parado e o mapa
  // encolhido (v0.3.1)
  const dica = cfg.modo === 'solo' ? t('dicaSolo') : cfg.modo === 'batalha' ? t('dicaBatalha') : '';
  if (cfg.novidade === 'mapa') aviso(t('novoMapa', { m: t(cfg.tema) }), dica);
  else if (cfg.novidade === 'modo') aviso(t('novoModo', { m: t(cfg.modo) }), dica);
  else if (dica) aviso(t(cfg.modo), dica);
  // os outros temas carregam em segundo plano
  for (const m of MAPAS) if (m !== cfg.tema) carregarTodas(urlsDoTema(m)).catch(() => {});
}

async function fimDaRodada() {
  const R = E.R;
  E.rodando = false;
  mao.esconder();
  $('joy').hidden = true;
  P.ativo = false;
  teclas.clear();
  const eu = jogador(R);
  const col = colocacao(R);
  const frac = fracaoComida(R);
  const ganhou = R.modo === 'solo' ? frac >= 0.6 : col === 1;
  const desafioFeito = !!E.desafio && desafioCumprido(E.desafio, R.comidasJogador);
  const res = fecharRodada(E.perfil, { modo: R.modo, tema: R.tema, colocacao: col, pontos: eu.pontos, fracao: frac, desafio: desafioFeito, dia: hoje() });
  const nivelAntes = nivelDe(E.perfil.xp);
  E.perfil = res.perfil;
  E.rodadasSessao++;
  E.escolha = {};
  salvar();
  tele.fase(E.nRodada, R.motivo === 'eliminado' ? 'fail' : 'complete');
  portal.gameplayStop();
  audio.tocarReceita(SONS.fim, { ganhou }, { chave: 'fim' });
  if (ganhou || res.recorde) portal.festa();
  let titulo;
  if (R.modo === 'solo') titulo = frac >= 0.999 ? t('soloLimpo') : t('soloFim', { p: Math.floor(frac * 100) });
  else if (R.motivo === 'eliminado') titulo = t('engolidoFim');
  else titulo = col === 1 ? t('venceu') : ordinal(col);
  // festa curta por cima do mapa parado; o painel vem logo depois
  await celebrar(camada, titulo, { ms: 1600, sub: t('xp', { n: res.xp }) });
  mostrarFim(res, { titulo, col, frac, nivelAntes, desafioFeito });
}

/**
 * @param {any} res resultado de fecharRodada
 * @param {{ titulo: string, col: number, frac: number, nivelAntes: any, desafioFeito: boolean }} o
 */
function mostrarFim(res, o) {
  const R = E.R;
  const eu = jogador(R);
  E.fimAberto = true;
  $('fimTitulo').textContent = o.titulo;
  /** @type {HTMLImageElement} */ ($('fimIcone')).src = urlIcone(R.modo === 'solo' ? 'estrela' : o.col === 1 ? 'trofeu' : R.motivo === 'eliminado' ? 'luva' : 'medalha');
  const base = { m: t(R.modo), mapa: t(R.tema) };
  $('fimSub').textContent = R.modo === 'solo'
    ? t('subSolo', { ...base, e: t('estrelas', { n: estrelasSolo(o.frac) }) })
    : R.modo === 'batalha' ? t('subBatalha', { ...base, k: eu.buracos }) : t('subClassico', { ...base, pts: eu.pontos });
  // placar final
  const ol = $('fimPlacar');
  ol.innerHTML = '';
  const lista = R.modo === 'solo' ? [eu] : placar(R);
  const top = lista.slice(0, 4);
  if (!top.includes(eu)) top.push(eu);
  for (const b of top) {
    const li = document.createElement('li');
    if (b === eu) li.className = 'eu';
    const pos = document.createElement('b');
    pos.textContent = R.modo === 'batalha' && b === eu ? String(o.col) : String(lista.indexOf(b) + 1);
    const nome = document.createElement('span');
    nome.className = 'nome';
    nome.textContent = b.nome;
    const pts = document.createElement('span');
    pts.textContent = String(b.pontos);
    li.append(pos, nome, pts);
    ol.appendChild(li);
  }
  // XP e nivel
  const nv = nivelDe(E.perfil.xp);
  $('fimNivel').textContent = t('nivel', { n: nv.nivel });
  $('fimGanho').textContent = t('xp', { n: res.xp });
  const barra = $('fimXp');
  barra.style.transition = 'none';
  barra.style.width = `${res.subiu ? 0 : (o.nivelAntes.dentro / o.nivelAntes.total) * 100}%`;
  void barra.offsetWidth;
  barra.style.transition = '';
  barra.style.width = `${(nv.dentro / nv.total) * 100}%`;
  // o que liberou (ou o que vem)
  const novo = $('fimNovo');
  let txt = '';
  let img = urlIcone('presente');
  if (res.skinsNovas.length) {
    txt = t('novaSkin');
    E.perfil.skin = res.skinsNovas[res.skinsNovas.length - 1];
    salvar();
    tele.evento('skin', `nova-${E.perfil.skin + 1}`);
  } else if (res.mapasNovos.length) txt = t('novoMapa', { m: t(res.mapasNovos[0]) });
  else if (res.modosNovos.length) txt = t('novoModo', { m: t(res.modosNovos[0]) });
  else if (res.recorde && R.modo !== 'solo') {
    txt = t('recorde');
    img = urlIcone('trofeu');
  }
  novo.hidden = !txt;
  $('fimNovoTxt').textContent = txt;
  /** @type {HTMLImageElement} */ ($('fimNovoImg')).src = img;
  // desafio do dia
  const dia = hoje();
  const d = desafioDoDia(dia);
  const cartao = $('fimDesafio');
  if (o.desafioFeito) {
    cartao.hidden = false;
    cartao.classList.add('feito');
    $('fimDesafioTxt').textContent = t('desafioFeito');
  } else if (desafioAberto(E.perfil, dia)) {
    cartao.hidden = false;
    cartao.classList.remove('feito');
    $('fimDesafioTxt').textContent = t('desafio', { n: d.n, g: t(`g_${d.grupo}`), m: t(d.tema) });
    cartao.onclick = () => {
      E.escolha = { modo: 'classico', tema: d.tema };
      montarEscolhas();
    };
  } else cartao.hidden = true;
  montarEscolhas();
  atualizarAro();
  atualizarVideo();
  $('fim').hidden = false;
}

/** Chips de modo e mapa (so os liberados; a sugestao da vez ja vem marcada). */
function montarEscolhas() {
  const lib = liberados(E.perfil);
  const cfg = proximaRodada(E.perfil, E.escolha);
  const montar = (/** @type {string} */ id, /** @type {readonly string[]} */ todos, /** @type {string[]} */ abertos, /** @type {string} */ atual, /** @type {'modo'|'tema'} */ campo) => {
    const raiz = $(id);
    raiz.innerHTML = '';
    for (const v of todos) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip';
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', String(v === atual));
      b.textContent = t(v);
      b.disabled = !abertos.includes(v);
      if (b.disabled) b.textContent = `🔒 ${t(v)}`;
      b.addEventListener('click', () => {
        audio.tocarReceita(SONS.clique, {}, { chave: 'clique' });
        E.escolha = { ...E.escolha, [campo]: v };
        montarEscolhas();
      });
      raiz.appendChild(b);
    }
  };
  montar('escolhaModo', ['classico', 'solo', 'batalha'], lib.modos, cfg.modo, 'modo');
  montar('escolhaMapa', MAPAS, lib.mapas, cfg.tema, 'tema');
}

/**
 * Comeca a proxima rodada (Jogar ou o premio). Intervalo comercial so aqui, na pausa natural.
 * @param {boolean} [maior] veio do premio
 * @param {boolean} [clique] veio de um clique no botao (o Enter do teclado nao conta para a Y8)
 */
async function comecarProxima(maior = false, clique = true) {
  if (E.iniciando) return;
  E.iniciando = true;
  $('fim').hidden = true;
  $('skins').hidden = true;
  E.skinsAberto = false;
  const houveAnuncio = maior ? true : await intervalo(clique);
  try {
    await novaRodada({ raio: maior ? RAIO_PREMIO : 0 });
  } finally {
    E.iniciando = false;
    E.fimAberto = false;
  }
  // sem anuncio no meio, o proprio toque em Jogar comeca a rodada; depois de um anuncio a rodada fica
  // armada e comeca no proximo gesto (a mao-guia mostra para onde ir)
  if (!houveAnuncio) jogadorAgiu();
}

/** s de jogo no ultimo intervalo pedido (a Y8 so exibe um a cada ~3 min) */
let ultimoIntervalo = -Infinity;
/** @param {boolean} clique o pedido nasce do clique num botao */
async function intervalo(clique) {
  if (dbg.semAnuncio || !portal.temAnuncios) return false;
  // nada antes da 3a rodada (~4 min de jogo)
  if (!(E.rodadasSessao >= 3 || (E.rodadasSessao >= 2 && tele.segundos >= 220))) return false;
  if (portal.intervaloSoNoClique) {
    // Y8: o intersticial so pode sair logo depois de um clique num botao (o "Jogar" entre rodadas), nunca
    // automatico nem pelo teclado, e o portal so exibe um a cada ~3 min
    if (!clique || tele.segundos - ultimoIntervalo < 180) return false;
  }
  ultimoIntervalo = tele.segundos;
  return portal.commercialBreak();
}

// ------------------------------------------------------------------ skins
function atualizarAro() {
  const aro = $('btSkinsAro');
  aro.style.backgroundImage = `url(${urlSkin(E.perfil.skin)})`;
}
function abrirSkins() {
  E.skinsAberto = true;
  const g = $('gradeSkins');
  g.innerHTML = '';
  for (let k = 0; k < N_SKINS; k++) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'skin';
    const livre = skinLiberada(E.perfil, k);
    b.disabled = !livre;
    b.setAttribute('aria-pressed', String(k === E.perfil.skin));
    const aro = document.createElement('span');
    aro.className = 'aro';
    aro.style.backgroundImage = `url(${urlSkin(k)})`;
    const miolo = document.createElement('span');
    miolo.className = 'miolo';
    const rot = document.createElement('span');
    rot.textContent = livre ? `#${k + 1}` : t('bloqueada', { n: k + 1 });
    b.append(aro, miolo, rot);
    if (!livre) {
      const c = document.createElement('img');
      c.className = 'cadeado';
      c.src = urlIcone('cadeado');
      c.alt = '';
      b.append(c);
    }
    b.addEventListener('click', () => {
      E.perfil.skin = k;
      salvar();
      audio.tocarReceita(SONS.clique, {}, { chave: 'clique' });
      tele.evento('skin', `troca-${k + 1}`);
      abrirSkins();
      atualizarAro();
    });
    g.appendChild(b);
  }
  $('skins').hidden = false;
}

// ------------------------------------------------------------------ menu de pausa e premiado
function abrirMenu() {
  if (E.menu || E.fimAberto) return;
  E.menu = true;
  portal.gameplayStop();
  laco.pausar(true);
  $('menu').hidden = false;
}
function fecharMenu() {
  if (!E.menu) return;
  E.menu = false;
  $('menu').hidden = true;
  laco.pausar(congelado() || portal.emAnuncio);
}
function atualizarVideo() {
  const bt = /** @type {HTMLButtonElement} */ ($('btMaior'));
  bt.hidden = !portal.temVideo;
  /** @type {HTMLElement} */ (bt.parentElement).classList.toggle('so-gratis', bt.hidden);
}
async function pedirMaior() {
  if (E.iniciando) return;
  const ok = await portal.rewardedBreak('small');
  if (ok === true) {
    tele.evento('premio', 'maior');
    comecarProxima(true);
  }
  atualizarVideo();
}

// ------------------------------------------------------------------ entrada
const DIRECOES = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'KeyA', 'KeyD', 'KeyW', 'KeyS']);
criarEntrada(window, {
  primeiroGesto: () => audio.iniciar(),
  ponteiro: (fase, x, y, e) => {
    const toque = e.pointerType !== 'mouse';
    if (fase === 'baixo') {
      tele.gesto(toque ? 'toque' : 'mouse');
      jogadorAgiu();
      P.ativo = true;
      P.toque = toque;
      P.ox = x;
      P.oy = y;
      P.x = x;
      P.y = y;
      mouse.x = x;
      mouse.y = y;
      mouse.tem = !toque;
      if (toque && E.rodando) {
        const j = $('joy');
        j.hidden = false;
        j.style.left = `${x}px`;
        j.style.top = `${y}px`;
        /** @type {HTMLElement} */ (j.firstElementChild).style.transform = '';
      }
    } else if (fase === 'mover') {
      if (!toque) {
        mouse.x = x;
        mouse.y = y;
        mouse.tem = true;
      }
      if (P.ativo) {
        P.x = x;
        P.y = y;
        if (P.toque) {
          const dx = x - P.ox;
          const dy = y - P.oy;
          const n = Math.hypot(dx, dy) || 1;
          const k = Math.min(n, 40) / n;
          /** @type {HTMLElement} */ ($('joy').firstElementChild).style.transform = `translate(${dx * k}px, ${dy * k}px)`;
        }
      }
    } else if (fase === 'cima') {
      P.ativo = false;
      $('joy').hidden = true;
    }
  },
  tecla: (codigo, baixo) => {
    if (baixo && (codigo === 'Escape' || codigo === 'Space' || codigo === 'KeyP')) {
      if (E.skinsAberto) {
        $('skins').hidden = true;
        E.skinsAberto = false;
      } else if (E.menu) fecharMenu();
      else abrirMenu();
      return;
    }
    if (DIRECOES.has(codigo)) {
      if (baixo) {
        teclas.add(codigo);
        jogadorAgiu();
      } else teclas.delete(codigo);
      return;
    }
    if (baixo && codigo === 'Enter' && E.fimAberto && !E.skinsAberto) {
      comecarProxima(false, false);
      return;
    }
    if (baixo) jogadorAgiu();
  },
});
document.addEventListener('mouseout', (e) => { if (!e.relatedTarget) mouse.tem = false; });
$('btPausa').addEventListener('click', () => abrirMenu());
$('btContinuar').addEventListener('click', () => { fecharMenu(); jogadorAgiu(); });
$('btSom').addEventListener('click', () => {
  audio.definirMudo(!audio.mudo);
  $('btSom').setAttribute('aria-pressed', String(!audio.mudo));
  armazem.gravar('mudo', audio.mudo);
});
$('btJogar').addEventListener('click', () => {
  audio.tocarReceita(SONS.clique, {}, { chave: 'clique' });
  comecarProxima();
});
$('btMaior').addEventListener('click', () => pedirMaior());
$('btSkins').addEventListener('click', () => abrirSkins());
$('btSkinsOk').addEventListener('click', () => {
  $('skins').hidden = true;
  E.skinsAberto = false;
});
document.addEventListener('visibilitychange', () => {
  audio.pausarAba(document.hidden);
  if (document.hidden) {
    portal.gameplayStop();
    laco.pausar(true);
  } else laco.pausar(congelado() || portal.emAnuncio);
});
window.addEventListener('blur', () => {
  teclas.clear();
  // Y8: perder o foco abre a pausa
  if (portal.pausaNoBlur && carregouJa && E.R && E.rodando) abrirMenu();
});
// o iframe do portal precisa de foco para o teclado (espaco nao rola a pagina do portal)
window.addEventListener('pointerdown', () => { try { window.focus(); } catch { /* ignora */ } });
window.addEventListener('resize', medir);

// ------------------------------------------------------------------ partida
async function iniciar() {
  medir();
  const pedidoInit = portal.init();
  // a arte baixa enquanto o handshake corre (rede, nada pesado de CPU); o atlas sai depois do init
  carregarPerfil();
  const temaInicial = (dbg.extras.mapa && MAPAS.includes(/** @type {any} */ (dbg.extras.mapa))) ? dbg.extras.mapa : proximaRodada(E.perfil).tema;
  const barra = /** @type {HTMLElement|null} */ (document.querySelector('#carregando .barra i'));
  const urls = [...urlsDoTema(temaInicial), ...ICONES.map(urlIcone), urlSkin(E.perfil.skin)];
  const carga = carregarTodas(urls, (f) => {
    portal.gameLoadingProgress(f * 0.95);
    if (barra) barra.style.width = `${f * 95}%`;
  });
  await pedidoInit;
  armazem.usarFonte(await portal.fonteDados(), ['perfil', 'mudo']);
  definirIdioma(escolherIdioma(dbg.lang || portal.idioma || navigator.language));
  document.documentElement.lang = { pt: 'pt-BR', en: 'en', es: 'es' }[idioma()];
  aplicarTextos(document);
  botaoPremiado(/** @type {HTMLButtonElement} */ ($('btMaior')), t('maior'));
  audio.definirMudo(armazem.ler('mudo', false) === true);
  carregarPerfil();
  await carga;
  await novaRodada();
  if (barra) barra.style.width = '100%';
  if (dbg.auto) E.rodando = true;
  if (dbg.filme) {
    E.rodando = true;
    desenhar();
    return;
  }
  laco.iniciar();
  for (let k = 0; k < N_SKINS; k++) carregarTodas([urlSkin(k)]).catch(() => {});
}

// ------------------------------------------------------------------ ganchos de teste (so local)
if (dbg.ganchos) {
  /** @type {any} */ (window).__jogo = {
    E,
    portal,
    audio,
    cena,
    plataforma: PLATAFORMA,
    get lang() { return idioma(); },
    get jogou() { return portal.jogando; },
    get emAnuncio() { return portal.emAnuncio; },
    get menuAberto() { return E.menu; },
    get fimAberto() { return E.fimAberto; },
    /** fps e ms do laco (medicao de desempenho) */
    get medidas() { return { ...laco.medidas, calls: cena.renderer.info.render.calls, tri: cena.renderer.info.render.triangles }; },
    get rodando() { return E.rodando; },
    get raio() { return E.R ? jogador(E.R).r : 0; },
    get pontos() { return E.R ? jogador(E.R).pontos : 0; },
    /** ponto da tela para o primeiro gesto real (perto do buraco do jogador) */
    alvo() {
      if (!E.R) return { x: W / 2, y: H / 2 };
      const eu = jogador(E.R);
      const p = cena.projetar(eu.x + 1.5, 0, eu.z);
      return { x: p.x, y: p.y };
    },
    /** acaba a rodada agora (provas e prints) */
    terminarRodada() {
      if (E.R && !E.R.fim) E.R.t = E.R.duracao - 1 / 120;
    },
    /** avanca a rodada N segundos na logica (prints) */
    avancar(s = 10) {
      const eu = E.R && jogador(E.R);
      for (let i = 0; i < s * 60 && E.R && !E.R.fim; i++) {
        const ev = passoRodada(E.R, 1 / 60, piloto(E.R, eu, 1 / 60));
        for (const e of ev) if (e.tipo === 'fim') tratarEvento(e);
      }
    },
    /** um quadro de video sem relogio real (?filme): avanca 1/fps e devolve o JPEG */
    quadro(fps = 30) {
      passo(1 / fps);
      desenhar(1 / fps);
      return tela.toDataURL('image/jpeg', 0.9);
    },
  };
}

iniciar();
