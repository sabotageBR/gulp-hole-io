// Texturas desenhadas no codigo (v0.2.0): chao, telhados e particulas. Nada de amostra do Grok repetida: cada
// material e pintado num canvas com sementes fixas (sempre igual), sem emenda (o que passa da borda e desenhado
// de novo do outro lado), em tons tirados da arte-chave (creme, verde de massinha, cinza quente, coral).
import * as THREE from 'three';

/** Gerador simples com semente (as texturas saem iguais em toda carga). @param {number} s */
function rng(s) {
  let a = s >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** @param {number} n @returns {[HTMLCanvasElement, CanvasRenderingContext2D]} */
function tela(n, m = n) {
  const c = document.createElement('canvas');
  c.width = n;
  c.height = m;
  return [c, /** @type {CanvasRenderingContext2D} */ (c.getContext('2d'))];
}

/** Desenha f(x, y) e as copias do outro lado quando encosta na borda (textura sem emenda). */
function envolto(n, x, y, raio, f) {
  for (const dx of [-n, 0, n]) {
    for (const dy of [-n, 0, n]) {
      if (x + dx + raio < 0 || x + dx - raio > n || y + dy + raio < 0 || y + dy - raio > n) continue;
      f(x + dx, y + dy);
    }
  }
}

/** Manchas suaves (variacao de tom). */
function manchas(g, n, r, qtd, cores, raio0, raio1, alfa) {
  for (let i = 0; i < qtd; i++) {
    const x = r() * n;
    const y = r() * n;
    const rad = raio0 + r() * (raio1 - raio0);
    const cor = cores[Math.floor(r() * cores.length)];
    envolto(n, x, y, rad, (xx, yy) => {
      const gr = g.createRadialGradient(xx, yy, 0, xx, yy, rad);
      gr.addColorStop(0, `rgba(${cor},${alfa})`);
      gr.addColorStop(1, `rgba(${cor},0)`);
      g.fillStyle = gr;
      g.fillRect(xx - rad, yy - rad, rad * 2, rad * 2);
    });
  }
}

/** Grao fino (pontinhos claros e escuros). */
function grao(g, n, r, qtd, claro, escuro, tam = 1.4) {
  for (let i = 0; i < qtd; i++) {
    const x = r() * n;
    const y = r() * n;
    g.fillStyle = r() < 0.5 ? claro : escuro;
    g.fillRect(x, y, tam * (0.6 + r()), tam * (0.6 + r()));
  }
}

function retRedondo(g, x, y, w, h, rr) {
  g.beginPath();
  g.moveTo(x + rr, y);
  g.arcTo(x + w, y, x + w, y + h, rr);
  g.arcTo(x + w, y + h, x, y + h, rr);
  g.arcTo(x, y + h, x, y, rr);
  g.arcTo(x, y, x + w, y, rr);
  g.closePath();
}

/** Ajusta um #rrggbb em +-k (0..1) de brilho. */
function tom(hex, k) {
  const v = parseInt(hex.slice(1), 16);
  const f = (c) => Math.max(0, Math.min(255, Math.round(c * (1 + k))));
  return `rgb(${f((v >> 16) & 255)},${f((v >> 8) & 255)},${f(v & 255)})`;
}

// ------------------------------------------------------------------ chao
const PINTORES = {
  asfalto(g, n, r) {
    g.fillStyle = '#a19aa0';
    g.fillRect(0, 0, n, n);
    manchas(g, n, r, 26, ['70,62,74', '200,192,196'], 30, 110, 0.12);
    grao(g, n, r, 9000, 'rgba(255,250,245,0.16)', 'rgba(40,32,48,0.16)');
    // remendos e rachadinhas
    for (let i = 0; i < 5; i++) {
      const x = r() * n;
      const y = r() * n;
      const w = 30 + r() * 60;
      const h = 20 + r() * 40;
      envolto(n, x, y, Math.max(w, h), (xx, yy) => {
        g.fillStyle = 'rgba(70,62,76,0.10)';
        retRedondo(g, xx, yy, w, h, 8);
        g.fill();
      });
    }
    g.strokeStyle = 'rgba(60,52,66,0.22)';
    g.lineWidth = 1.2;
    for (let i = 0; i < 7; i++) {
      let x = r() * n;
      let y = r() * n;
      g.beginPath();
      g.moveTo(x, y);
      for (let k = 0; k < 5; k++) {
        x += (r() - 0.5) * 30;
        y += (r() - 0.5) * 30;
        g.lineTo(x, y);
      }
      g.stroke();
    }
  },
  calcada(g, n, r) {
    pisos(g, n, r, 4, '#efe4cf', '#d2c3a6', 0.04, 7);
  },
  pracinha(g, n, r) {
    tijolos(g, n, r, 8, 4, ['#ead6bf', '#e2c9b0', '#efdcc8', '#dcc0a6'], '#c8ab90');
  },
  grama(g, n, r) {
    g.fillStyle = '#68ae56';
    g.fillRect(0, 0, n, n);
    manchas(g, n, r, 34, ['84,150,70', '128,196,104', '96,168,80'], 40, 120, 0.35);
    for (let i = 0; i < 3200; i++) {
      const x = r() * n;
      const y = r() * n;
      const v = r();
      g.strokeStyle = v < 0.5 ? 'rgba(76,140,62,0.55)' : v < 0.85 ? 'rgba(136,200,110,0.5)' : 'rgba(170,220,130,0.45)';
      g.lineWidth = 1.3;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + (r() - 0.5) * 3, y - 2 - r() * 4);
      g.stroke();
    }
    // florzinhas
    for (let i = 0; i < 22; i++) {
      const x = r() * n;
      const y = r() * n;
      const cor = ['#fff6e8', '#ffd23f', '#ff8fa8', '#c9a6ff'][Math.floor(r() * 4)];
      envolto(n, x, y, 5, (xx, yy) => {
        g.fillStyle = cor;
        for (let p = 0; p < 5; p++) {
          const a = (p / 5) * Math.PI * 2;
          g.beginPath();
          g.arc(xx + Math.cos(a) * 2.4, yy + Math.sin(a) * 2.4, 1.8, 0, Math.PI * 2);
          g.fill();
        }
        g.fillStyle = '#ffb02e';
        g.beginPath();
        g.arc(xx, yy, 1.4, 0, Math.PI * 2);
        g.fill();
      });
    }
  },
  areia(g, n, r) {
    g.fillStyle = '#f1d49a';
    g.fillRect(0, 0, n, n);
    manchas(g, n, r, 30, ['226,188,122', '250,226,176'], 40, 120, 0.35);
    ondas(g, n, r, 'rgba(214,176,112,0.28)', 14);
    grao(g, n, r, 14000, 'rgba(255,244,214,0.5)', 'rgba(196,156,92,0.4)', 1.2);
  },
  'areia-clara'(g, n, r) {
    g.fillStyle = '#f6e3b8';
    g.fillRect(0, 0, n, n);
    manchas(g, n, r, 24, ['232,206,152', '255,240,210'], 40, 110, 0.3);
    grao(g, n, r, 12000, 'rgba(255,250,232,0.5)', 'rgba(206,172,112,0.35)', 1.1);
  },
  'pracinha-areia'(g, n, r) {
    pisos(g, n, r, 3, '#f1ddb4', '#d8bf8f', 0.05, 10);
  },
  deck(g, n, r) {
    const tabuas = 8;
    const h = n / tabuas;
    g.fillStyle = '#8c5d37';
    g.fillRect(0, 0, n, n);
    for (let k = 0; k < tabuas; k++) {
      const corte = r() * n;
      for (const [x0, x1] of [[corte - n, corte - 3], [corte, corte + n - 3]]) {
        const cor = tom('#d9a56c', (r() - 0.5) * 0.14);
        g.fillStyle = cor;
        retRedondo(g, x0 + 1.5, k * h + 2, x1 - x0, h - 4, 4);
        g.fill();
        g.strokeStyle = 'rgba(150,98,56,0.25)';
        g.lineWidth = 1;
        for (let l = 0; l < 3; l++) {
          const y = k * h + 6 + r() * (h - 12);
          g.beginPath();
          g.moveTo(x0, y);
          g.bezierCurveTo(x0 + 120, y + (r() - 0.5) * 4, x1 - 120, y + (r() - 0.5) * 4, x1, y);
          g.stroke();
        }
        g.fillStyle = 'rgba(90,60,40,0.55)';
        for (const xx of [x0 + 10, x1 - 12]) for (const yy of [k * h + 9, k * h + h - 11]) g.fillRect(xx, yy, 3, 3);
      }
    }
  },
  agua(g, n, r) {
    g.fillStyle = '#46c3d6';
    g.fillRect(0, 0, n, n);
    manchas(g, n, r, 26, ['60,170,200', '110,220,232'], 50, 140, 0.4);
    g.strokeStyle = 'rgba(200,250,255,0.55)';
    g.lineWidth = 2.4;
    g.lineCap = 'round';
    for (let i = 0; i < 70; i++) {
      const x = r() * n;
      const y = r() * n;
      const w = 10 + r() * 22;
      envolto(n, x, y, w, (xx, yy) => {
        g.beginPath();
        g.arc(xx, yy, w, Math.PI * 1.15, Math.PI * 1.85);
        g.stroke();
      });
    }
  },
  glace(g, n, r) {
    g.fillStyle = '#ffc3da';
    g.fillRect(0, 0, n, n);
    manchas(g, n, r, 26, ['255,176,208', '255,216,232'], 40, 120, 0.45);
    granulado(g, n, r, 320);
  },
  chocolate(g, n, r) {
    const q = 4;
    const t = n / q;
    g.fillStyle = '#4f2a1a';
    g.fillRect(0, 0, n, n);
    for (let i = 0; i < q; i++) {
      for (let j = 0; j < q; j++) {
        const x = i * t;
        const y = j * t;
        const b = 7;
        g.fillStyle = tom('#7a4529', (r() - 0.5) * 0.08);
        retRedondo(g, x + 3, y + 3, t - 6, t - 6, 8);
        g.fill();
        // chanfro: luz em cima e a esquerda, sombra embaixo e a direita
        g.fillStyle = 'rgba(255,214,170,0.18)';
        retRedondo(g, x + 3, y + 3, t - 6, b, 6);
        g.fill();
        retRedondo(g, x + 3, y + 3, b, t - 6, 6);
        g.fill();
        g.fillStyle = 'rgba(40,18,8,0.28)';
        retRedondo(g, x + 3, y + t - 3 - b, t - 6, b, 6);
        g.fill();
        retRedondo(g, x + t - 3 - b, y + 3, b, t - 6, 6);
        g.fill();
      }
    }
  },
  biscoito(g, n, r) {
    g.fillStyle = '#e4b06e';
    g.fillRect(0, 0, n, n);
    manchas(g, n, r, 20, ['206,150,84', '244,200,140'], 30, 90, 0.35);
    const q = 6;
    const t = n / q;
    for (let i = 0; i < q; i++) {
      for (let j = 0; j < q; j++) {
        const x = i * t + t / 2 + ((j % 2) * t) / 2;
        const y = j * t + t / 2;
        envolto(n, x, y, 6, (xx, yy) => {
          g.fillStyle = 'rgba(160,104,48,0.55)';
          g.beginPath();
          g.arc(xx, yy, 3.6, 0, Math.PI * 2);
          g.fill();
          g.fillStyle = 'rgba(255,230,180,0.5)';
          g.beginPath();
          g.arc(xx - 1, yy - 1.4, 1.6, 0, Math.PI * 2);
          g.fill();
        });
      }
    }
    grao(g, n, r, 3000, 'rgba(255,236,200,0.35)', 'rgba(170,110,50,0.25)');
  },
  'pracinha-doce'(g, n, r) {
    const q = 4;
    const t = n / q;
    const cores = ['#ffd6e8', '#d4f7e8', '#fff3b8', '#e6dcff'];
    g.fillStyle = '#f2d9c4';
    g.fillRect(0, 0, n, n);
    for (let i = 0; i < q; i++) {
      for (let j = 0; j < q; j++) {
        g.fillStyle = tom(cores[(i + j * 2) % 4], (r() - 0.5) * 0.05);
        retRedondo(g, i * t + 4, j * t + 4, t - 8, t - 8, 14);
        g.fill();
        g.fillStyle = 'rgba(255,255,255,0.35)';
        retRedondo(g, i * t + 10, j * t + 9, t - 30, 8, 4);
        g.fill();
      }
    }
  },
  calda(g, n, r) {
    g.fillStyle = '#e0974a';
    g.fillRect(0, 0, n, n);
    manchas(g, n, r, 30, ['200,116,44', '244,180,104'], 50, 140, 0.45);
    g.strokeStyle = 'rgba(255,226,170,0.5)';
    g.lineWidth = 3;
    g.lineCap = 'round';
    for (let i = 0; i < 40; i++) {
      const x = r() * n;
      const y = r() * n;
      const w = 14 + r() * 26;
      envolto(n, x, y, w, (xx, yy) => {
        g.beginPath();
        g.arc(xx, yy, w, Math.PI * 1.1, Math.PI * 1.6);
        g.stroke();
      });
    }
  },
};

/** Pisos quadrados com rejunte, cada um num tom. */
function pisos(g, n, r, q, cor, rejunte, var0, raio) {
  const t = n / q;
  g.fillStyle = rejunte;
  g.fillRect(0, 0, n, n);
  for (let i = 0; i < q; i++) {
    for (let j = 0; j < q; j++) {
      g.fillStyle = tom(cor, (r() - 0.5) * var0 * 2);
      retRedondo(g, i * t + 3, j * t + 3, t - 6, t - 6, raio);
      g.fill();
      g.fillStyle = 'rgba(255,255,255,0.22)';
      retRedondo(g, i * t + 6, j * t + 5, t - 12, 5, 3);
      g.fill();
    }
  }
  grao(g, n, r, 5000, 'rgba(255,255,255,0.18)', 'rgba(120,100,70,0.12)');
}

/** Tijolinhos em fiadas desencontradas. */
function tijolos(g, n, r, filas, porFila, cores, rejunte) {
  const h = n / filas;
  const w = n / porFila;
  g.fillStyle = rejunte;
  g.fillRect(0, 0, n, n);
  for (let j = 0; j < filas; j++) {
    const desl = (j % 2) * (w / 2);
    for (let i = -1; i < porFila; i++) {
      g.fillStyle = cores[Math.floor(r() * cores.length)];
      retRedondo(g, i * w + desl + 2.5, j * h + 2.5, w - 5, h - 5, 5);
      g.fill();
    }
  }
  grao(g, n, r, 4000, 'rgba(255,255,255,0.15)', 'rgba(120,80,60,0.12)');
}

/** Ondinhas da areia (vento). */
function ondas(g, n, r, cor, qtd) {
  g.strokeStyle = cor;
  g.lineWidth = 2;
  for (let i = 0; i < qtd; i++) {
    const y0 = r() * n;
    const amp = 4 + r() * 6;
    const fase = r() * 6;
    for (const dy of [-n, 0, n]) {
      g.beginPath();
      for (let x = 0; x <= n; x += 8) {
        const y = y0 + dy + Math.sin((x / n) * Math.PI * 4 + fase) * amp;
        if (x === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.stroke();
    }
  }
}

/** Granulado colorido (glace da doceria). */
function granulado(g, n, r, qtd) {
  const cores = ['#ffffff', '#ffd23f', '#5fd3a8', '#4fb3ff', '#b48cff', '#ff6f61'];
  for (let i = 0; i < qtd; i++) {
    const x = r() * n;
    const y = r() * n;
    const a = r() * Math.PI;
    const cor = cores[Math.floor(r() * cores.length)];
    envolto(n, x, y, 8, (xx, yy) => {
      g.save();
      g.translate(xx, yy);
      g.rotate(a);
      g.fillStyle = cor;
      retRedondo(g, -5, -1.6, 10, 3.2, 1.6);
      g.fill();
      g.restore();
    });
  }
}

/** @type {Map<string, THREE.Texture>} */
const cacheChao = new Map();
/** Textura de chao pelo nome (pintada uma vez). @param {string} nome @param {number} [lado] */
export function texturaChao(nome, lado = 512) {
  const k = `${nome}@${lado}`;
  let t = cacheChao.get(k);
  if (t) return t;
  const [c, g] = tela(lado);
  const pintor = PINTORES[nome] || PINTORES.calcada;
  // desenha em 512 e escala (os numeros dos pintores sao em px de 512)
  g.save();
  g.scale(lado / 512, lado / 512);
  pintor(g, 512, rng(nome.length * 7919 + nome.charCodeAt(0) * 31));
  g.restore();
  t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  cacheChao.set(k, t);
  return t;
}

/** Quantas unidades do mundo cobre uma repeticao de cada textura. */
export const ESCALA_CHAO = {
  asfalto: 8, calcada: 3, pracinha: 3.2, grama: 6, areia: 8, 'areia-clara': 6, 'pracinha-areia': 3.6, deck: 4,
  agua: 12, glace: 5, chocolate: 4, biscoito: 3, 'pracinha-doce': 3.2, calda: 12,
};

// ------------------------------------------------------------------ telhados (atlas 4 x 256, tingidos por instancia)
/** Ordem das celulas do atlas de telhados. */
export const TELHADOS = ['telha', 'plano', 'palha', 'glace'];

let atlasTelhados = /** @type {THREE.Texture|null} */ (null);
/** Atlas dos telhados (claros: a cor vem de cada casa). */
export function texturaTelhados() {
  if (atlasTelhados) return atlasTelhados;
  const n = 256;
  const [c, g] = tela(n * 4, n);
  const r = rng(424242);
  // telha: fileiras de telhas arredondadas, sombra embaixo de cada fileira
  {
    const filas = 6;
    const h = n / filas;
    const por = 6;
    const w = n / por;
    g.fillStyle = '#b9b2b6';
    g.fillRect(0, 0, n, n);
    for (let j = 0; j < filas; j++) {
      const desl = (j % 2) * (w / 2);
      for (let i = -1; i <= por; i++) {
        const x = i * w + desl;
        const y = j * h;
        const v = 0.92 + r() * 0.12;
        const gr = g.createLinearGradient(0, y, 0, y + h);
        gr.addColorStop(0, `rgba(${Math.round(250 * v)},${Math.round(248 * v)},${Math.round(248 * v)},1)`);
        gr.addColorStop(0.75, `rgba(${Math.round(226 * v)},${Math.round(222 * v)},${Math.round(224 * v)},1)`);
        gr.addColorStop(1, `rgba(${Math.round(170 * v)},${Math.round(164 * v)},${Math.round(170 * v)},1)`);
        g.fillStyle = gr;
        g.beginPath();
        g.moveTo(x + 2, y);
        g.lineTo(x + w - 2, y);
        g.lineTo(x + w - 2, y + h * 0.62);
        g.quadraticCurveTo(x + w - 2, y + h + 2, x + w / 2, y + h + 2);
        g.quadraticCurveTo(x + 2, y + h + 2, x + 2, y + h * 0.62);
        g.closePath();
        g.fill();
      }
    }
  }
  // plano: laje clara com granulado, mureta (borda mais escura) e um ralo
  {
    const x0 = n;
    g.fillStyle = '#e9e5df';
    g.fillRect(x0, 0, n, n);
    for (let i = 0; i < 4000; i++) {
      g.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.35)' : 'rgba(120,110,104,0.14)';
      g.fillRect(x0 + r() * n, r() * n, 1.5, 1.5);
    }
    g.strokeStyle = 'rgba(150,140,136,0.55)';
    g.lineWidth = 2;
    for (let k = 1; k < 4; k++) {
      g.beginPath();
      g.moveTo(x0 + (k * n) / 4, 22);
      g.lineTo(x0 + (k * n) / 4, n - 22);
      g.stroke();
    }
    g.fillStyle = '#a69c98';
    g.fillRect(x0, 0, n, 16);
    g.fillRect(x0, n - 16, n, 16);
    g.fillRect(x0, 0, 16, n);
    g.fillRect(x0 + n - 16, 0, 16, n);
    g.fillStyle = '#c7bfba';
    g.fillRect(x0 + 4, 4, n - 8, 6);
    g.fillRect(x0 + 4, 4, 6, n - 8);
    g.fillStyle = '#6f6670';
    g.beginPath();
    g.arc(x0 + n * 0.78, n * 0.72, 7, 0, Math.PI * 2);
    g.fill();
  }
  // palha: fios de palha em camadas
  {
    const x0 = n * 2;
    g.fillStyle = '#d9b46e';
    g.fillRect(x0, 0, n, n);
    for (let camada = 0; camada < 5; camada++) {
      const y0 = (camada * n) / 5;
      for (let i = 0; i < 260; i++) {
        const x = x0 + r() * n;
        const y = y0 + r() * (n / 5);
        const v = r();
        g.strokeStyle = v < 0.4 ? 'rgba(250,226,160,0.8)' : v < 0.8 ? 'rgba(200,158,90,0.7)' : 'rgba(150,110,60,0.6)';
        g.lineWidth = 1.6;
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x + (r() - 0.5) * 6, y + 18 + r() * 14);
        g.stroke();
      }
      g.fillStyle = 'rgba(120,80,40,0.25)';
      g.fillRect(x0, y0 + n / 5 - 4, n, 4);
    }
  }
  // glace: cobertura lisa com granulado e escorridos (doceria; a cor vem da casa)
  {
    const x0 = n * 3;
    g.fillStyle = '#fbf6f8';
    g.fillRect(x0, 0, n, n);
    for (let i = 0; i < 6; i++) {
      const x = x0 + r() * n;
      const y = r() * n;
      const rad = 40 + r() * 60;
      const gr = g.createRadialGradient(x, y, 0, x, y, rad);
      gr.addColorStop(0, 'rgba(255,255,255,0.6)');
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr;
      g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    g.save();
    g.beginPath();
    g.rect(x0, 0, n, n);
    g.clip();
    g.translate(x0, 0);
    granulado(g, n, r, 90);
    g.restore();
  }
  atlasTelhados = new THREE.CanvasTexture(c);
  atlasTelhados.colorSpace = THREE.SRGBColorSpace;
  atlasTelhados.anisotropy = 4;
  return atlasTelhados;
}

// ------------------------------------------------------------------ particulas (4 celulas de 64)
let atlasParticulas = /** @type {THREE.Texture|null} */ (null);
/** Celulas: 0 poeira, 1 pedrinha, 2 balao de susto, 3 buzina. */
export function texturaParticulas() {
  if (atlasParticulas) return atlasParticulas;
  const n = 64;
  const [c, g] = tela(n * 8, n);
  // celulas: 0 poeira, 1 pedrinha, 2 balao de susto, 3 buzina, 4 lasca de asfalto, 5 caco de vidro, 6 bloco de
  // entulho, 7 brilho (v0.3.0)
  // poeira: nuvenzinha macia
  {
    const gr = g.createRadialGradient(32, 32, 2, 32, 32, 30);
    gr.addColorStop(0, 'rgba(255,255,255,0.95)');
    gr.addColorStop(0.55, 'rgba(255,255,255,0.55)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, n, n);
  }
  // pedrinha: poligono irregular com luz em cima
  {
    g.save();
    g.translate(n + 32, 32);
    g.fillStyle = '#ffffff';
    g.beginPath();
    const pts = [[-20, -6], [-8, -18], [10, -16], [21, -2], [14, 15], [-4, 19], [-18, 10]];
    pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.closePath();
    g.fill();
    g.fillStyle = 'rgba(0,0,0,0.28)';
    g.beginPath();
    g.moveTo(21, -2);
    g.lineTo(14, 15);
    g.lineTo(-4, 19);
    g.lineTo(-18, 10);
    g.lineTo(0, 6);
    g.closePath();
    g.fill();
    g.strokeStyle = 'rgba(30,20,40,0.6)';
    g.lineWidth = 3;
    g.beginPath();
    pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.closePath();
    g.stroke();
    g.restore();
  }
  // balao de susto: balao branco com um "!" coral
  {
    const x0 = n * 2;
    g.fillStyle = '#2b2240';
    retRedondo(g, x0 + 10, 4, 44, 44, 16);
    g.fill();
    g.beginPath();
    g.moveTo(x0 + 26, 46);
    g.lineTo(x0 + 32, 60);
    g.lineTo(x0 + 38, 46);
    g.fill();
    g.fillStyle = '#ffffff';
    retRedondo(g, x0 + 13, 7, 38, 38, 13);
    g.fill();
    g.beginPath();
    g.moveTo(x0 + 28, 43);
    g.lineTo(x0 + 32, 54);
    g.lineTo(x0 + 36, 43);
    g.fill();
    g.fillStyle = '#ff5a4a';
    retRedondo(g, x0 + 28.5, 12, 7, 20, 3.5);
    g.fill();
    g.beginPath();
    g.arc(x0 + 32, 37.5, 4, 0, Math.PI * 2);
    g.fill();
  }
  // buzina: tres tracinhos de som
  {
    const x0 = n * 3;
    g.lineCap = 'round';
    for (const [lw, cor] of [[9, '#2b2240'], [5, '#ffffff']]) {
      g.strokeStyle = cor;
      g.lineWidth = lw;
      for (const a of [-0.55, 0, 0.55]) {
        g.beginPath();
        g.moveTo(x0 + 32 + Math.sin(a) * 10, 44 - Math.cos(a) * 10);
        g.lineTo(x0 + 32 + Math.sin(a) * 26, 44 - Math.cos(a) * 26);
        g.stroke();
      }
    }
  }
  // lasca de asfalto: placa chata e irregular, face clara (tingida) com a quina escura de baixo
  {
    g.save();
    g.translate(n * 4 + 32, 32);
    const pts = [[-24, -4], [-14, -16], [6, -18], [22, -8], [24, 6], [8, 16], [-12, 14], [-22, 8]];
    g.fillStyle = 'rgba(25,18,35,0.85)';
    g.beginPath();
    pts.forEach(([x, y], i) => (i ? g.lineTo(x + 2, y + 5) : g.moveTo(x + 2, y + 5)));
    g.closePath();
    g.fill();
    g.fillStyle = '#ffffff';
    g.beginPath();
    pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.closePath();
    g.fill();
    // granulado do asfalto (pontinhos escuros) e uma trinca
    g.fillStyle = 'rgba(0,0,0,0.18)';
    for (let k = 0; k < 26; k++) g.fillRect(-18 + ((k * 37) % 36), -12 + ((k * 23) % 24), 2, 2);
    g.strokeStyle = 'rgba(25,18,35,0.55)';
    g.lineWidth = 1.6;
    g.beginPath();
    g.moveTo(-10, -12);
    g.lineTo(-2, -2);
    g.lineTo(-6, 10);
    g.stroke();
    g.strokeStyle = 'rgba(30,20,40,0.7)';
    g.lineWidth = 2.4;
    g.beginPath();
    pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.closePath();
    g.stroke();
    g.restore();
  }
  // caco de vidro: triangulo comprido, quase transparente no meio, borda e reflexo brancos
  {
    g.save();
    g.translate(n * 5 + 32, 32);
    g.rotate(-0.4);
    g.beginPath();
    g.moveTo(-6, -26);
    g.lineTo(12, 18);
    g.lineTo(-10, 22);
    g.closePath();
    g.fillStyle = 'rgba(255,255,255,0.55)';
    g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.95)';
    g.lineWidth = 3;
    g.stroke();
    g.strokeStyle = 'rgba(255,255,255,1)';
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(-4, -12);
    g.lineTo(2, 8);
    g.stroke();
    g.restore();
  }
  // bloco de entulho: quina de tijolo/concreto com luz em cima e lado escuro
  {
    g.save();
    g.translate(n * 6 + 32, 32);
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.moveTo(-20, -8);
    g.lineTo(-4, -20);
    g.lineTo(20, -12);
    g.lineTo(20, 10);
    g.lineTo(2, 20);
    g.lineTo(-20, 12);
    g.closePath();
    g.fill();
    g.fillStyle = 'rgba(0,0,0,0.3)';
    g.beginPath();
    g.moveTo(2, 0);
    g.lineTo(20, -12);
    g.lineTo(20, 10);
    g.lineTo(2, 20);
    g.closePath();
    g.fill();
    g.fillStyle = 'rgba(0,0,0,0.12)';
    g.beginPath();
    g.moveTo(-20, -8);
    g.lineTo(2, 0);
    g.lineTo(2, 20);
    g.lineTo(-20, 12);
    g.closePath();
    g.fill();
    g.strokeStyle = 'rgba(30,20,40,0.65)';
    g.lineWidth = 2.6;
    g.beginPath();
    g.moveTo(-20, -8);
    g.lineTo(-4, -20);
    g.lineTo(20, -12);
    g.lineTo(20, 10);
    g.lineTo(2, 20);
    g.lineTo(-20, 12);
    g.closePath();
    g.stroke();
    g.restore();
  }
  // brilho: estrelinha de quatro pontas
  {
    g.save();
    g.translate(n * 7 + 32, 32);
    const gr = g.createRadialGradient(0, 0, 1, 0, 0, 14);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fillRect(-16, -16, 32, 32);
    g.fillStyle = '#ffffff';
    g.beginPath();
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      const rr = k % 2 ? 4 : 26;
      g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    g.closePath();
    g.fill();
    g.restore();
  }
  atlasParticulas = new THREE.CanvasTexture(c);
  atlasParticulas.colorSpace = THREE.SRGBColorSpace;
  return atlasParticulas;
}

/** Celulas do atlas de particulas. */
export const PART = { poeira: 0, pedra: 1, susto: 2, buzina: 3, lasca: 4, caco: 5, bloco: 6, brilho: 7 };

let rachaduras = /** @type {THREE.CanvasTexture|null} */ (null);
/**
 * Rachaduras em volta da boca (v0.3.0): trincas que saem da borda para fora, com galhos, num quadrado cujo
 * centro e o centro do buraco; o anel que usa vai do raio 1 (borda) ao 1,7.
 */
export function texturaRachaduras() {
  if (rachaduras) return rachaduras;
  const n = 512;
  const [c, g] = tela(n, n);
  const cx = n / 2;
  const r0 = (n / 2) / 1.7;
  let sem = 7;
  const rnd = () => {
    sem = (Math.imul(sem, 1103515245) + 12345) >>> 0;
    return sem / 4294967296;
  };
  g.lineCap = 'round';
  g.lineJoin = 'round';
  const trinca = (x, y, a, comp, larg, nivel) => {
    const pts = [[x, y]];
    let px = x;
    let py = y;
    const passos = 6 + Math.floor(rnd() * 4);
    for (let k = 0; k < passos; k++) {
      a += (rnd() - 0.5) * 0.9;
      const p = comp / passos;
      px += Math.cos(a) * p;
      py += Math.sin(a) * p;
      pts.push([px, py]);
      if (nivel < 2 && rnd() < 0.28) trinca(px, py, a + (rnd() < 0.5 ? -1 : 1) * (0.5 + rnd() * 0.6), comp * 0.45, larg * 0.6, nivel + 1);
    }
    for (const [lw, cor] of [[larg + 2.2, 'rgba(255,255,255,0.22)'], [larg, 'rgba(28,20,40,0.92)']]) {
      g.strokeStyle = cor;
      g.lineWidth = lw;
      g.beginPath();
      pts.forEach(([qx, qy], i) => (i ? g.lineTo(qx, qy) : g.moveTo(qx, qy)));
      g.stroke();
    }
  };
  const nT = 15;
  for (let k = 0; k < nT; k++) {
    const a = (k / nT) * Math.PI * 2 + (rnd() - 0.5) * 0.3;
    const x = cx + Math.cos(a) * (r0 * 1.02);
    const y = cx + Math.sin(a) * (r0 * 1.02);
    trinca(x, y, a, r0 * (0.28 + rnd() * 0.45), 4.4 + rnd() * 2.4, 0);
  }
  // borda esfarelada: anel irregular escuro logo fora da boca
  g.fillStyle = 'rgba(28,20,40,0.35)';
  for (let k = 0; k < 120; k++) {
    const a = rnd() * Math.PI * 2;
    const rr = r0 * (1.0 + rnd() * 0.12);
    g.beginPath();
    g.arc(cx + Math.cos(a) * rr, cx + Math.sin(a) * rr, 1.5 + rnd() * 3.5, 0, Math.PI * 2);
    g.fill();
  }
  rachaduras = new THREE.CanvasTexture(c);
  rachaduras.colorSpace = THREE.SRGBColorSpace;
  return rachaduras;
}
