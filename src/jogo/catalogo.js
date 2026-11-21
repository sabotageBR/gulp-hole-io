// Catalogo das pecas de cada mapa (logica pura, ASCII). Unidades do mundo: 1 = um passo de calcada.
// Cada peca tem:
//   id      nome logico (unico no tema)
//   arte    sprite, fachada ou folha de quadros em src/arte/ (o render resolve)
//   forma   'sprite' (billboard parado) | 'pessoa' (billboard animado: anda, corre, se assusta, acena, cai)
//           | 'carro' (modelo 3D feito no codigo, src/render/carros.js) | 'modelo' (aderecos 3D parados feitos no
//           codigo: moto, placa, barraca, caixote, carrinho, mesa com guarda-sol) | 'casa' (caixa + telhado de
//           duas aguas) | 'caixa' (caixa de teto chato)
//   s       raio da pegada (o que decide se cabe na boca)
//   h       altura do sprite (opcional; senao vem da imagem)
//   peso    chance relativa dentro do grupo
//   modelo  (carro) qual modelo 3D; anda: pode rodar pelas ruas
//   telhado (casa/caixa) estilo do teto desenhado no codigo: 'telha' | 'plano' | 'palha' | 'glace'
//   mat     material do som ao engolir (materialDe): plastico, metal, madeira, vidro, planta, pessoa, carro,
//           pedra, doce
// A massa e os pontos saem do tamanho (massaDe/pontosDe), iguais em todos os temas.
// (v0.3.0) `papeis`: o que cada tema usa em cada papel dos cachos do mapa (obra, feira, cafe, bicicletario...).

/** @typedef {{ id: string, arte: string, forma: 'sprite'|'pessoa'|'carro'|'modelo'|'casa'|'caixa', s: number, h?: number, peso?: number, telhado?: string, modelo?: string, anda?: boolean, mat?: string }} Peca */
/** @typedef {{ id: string, chao: { rua: string, calcada: string, miolo: string, praca: string, borda: string, fora: string }, grupos: Record<string, Peca[]>, gigante: Peca, faixa: boolean, cores: { carro: string[], parede: string[], teto: string[] }, papeis: Record<string, string[]> }} Tema */

/** Massa ganha ao engolir uma peca de raio s (area da pegada). */
export const massaDe = (/** @type {number} */ s) => s * s;
/** Pontos de uma peca (inteiros, minimo 1). */
export const pontosDe = (/** @type {number} */ s) => Math.max(1, Math.round(s * s * 40));

const P = (id, arte, s, peso = 1, extra = {}) => /** @type {Peca} */ ({ id, arte, forma: 'sprite', s, peso, ...extra });
const G = (id, arte, peso = 1) => /** @type {Peca} */ ({ id, arte, forma: 'pessoa', s: 0.24, peso });
const V = (id, modelo, s, peso = 1, anda = true) => /** @type {Peca} */ ({ id, arte: '', forma: 'carro', modelo, s, peso, anda });
const C = (id, arte, s, telhado, peso = 1) => /** @type {Peca} */ ({ id, arte, forma: 'casa', s, telhado, peso });
const X = (id, arte, s, peso = 1, telhado = 'plano') => /** @type {Peca} */ ({ id, arte, forma: 'caixa', s, telhado, peso });
/** Aderecos 3D parados (src/render/carros.js), iguais nos tres temas; o tema muda so as cores. */
const A = (id, modelo, s, mat, peso = 1) => /** @type {Peca} */ ({ id, arte: '', forma: 'modelo', modelo, s, peso, mat });
const ADERECOS = {
  moto: [A('moto', 'moto', 0.5, 'metal')],
  placa: [A('placa', 'placa', 0.28, 'metal')],
  barraca: [A('barraca', 'barraca', 0.8, 'madeira')],
  caixote: [A('caixote', 'caixote', 0.34, 'madeira')],
  carrinho: [A('carrinho', 'carrinho', 0.36, 'metal')],
  mesaSol: [A('mesa-sol', 'mesa-sol', 0.6, 'madeira')],
};

/** @type {Record<string, Tema>} */
export const TEMAS = {
  cidade: {
    id: 'cidade',
    chao: { rua: 'asfalto', calcada: 'calcada', miolo: 'grama', praca: 'pracinha', borda: 'grama', fora: 'grama' },
    faixa: true,
    cores: {
      carro: ['#ff6f61', '#4fb3ff', '#ffd23f', '#5fd3a8', '#b48cff', '#e8483c', '#fff3dc', '#ff9f43', '#3f7fe0'],
      parede: ['#fff3dc', '#cdeee0', '#e6dcff', '#ffe08a', '#ffd0c4', '#cfe9ff'],
      teto: ['#e8564a', '#9b6be0', '#f2b632', '#4f9be8', '#47b98a', '#e0703a'],
    },
    papeis: {
      cone: ['cone'], barreira: ['barreira', 'cone'], placa: ['placa'], barraca: ['barraca'], caixote: ['caixote'],
      mesa: ['mesa-sol', 'mesa'], vaso: ['vaso', 'floreira'], bike: ['bicicleta', 'patinete'], moto: ['moto'],
      lixeira: ['lixeira'], caixa: ['caixa-correio', 'banca-jornal'], hidrante: ['hidrante'], arbusto: ['arbusto', 'arbusto-flor', 'topiaria'],
      carrinho: ['carrinho'], banco: ['banco'],
    },
    grupos: {
      calcada: [
        P('cone', 'cid-props-01', 0.26, 3), P('hidrante', 'cid-props-02', 0.26, 2), P('lixeira', 'cid-props-03', 0.32, 2),
        P('caixa-correio', 'cid-props-05', 0.3, 1), P('vaso', 'cid-props-06', 0.3, 2), P('bicicleta', 'cid-props2-02', 0.34, 2),
        P('floreira', 'cid-props2-03', 0.32, 2), P('topiaria', 'cid-props2-04', 0.3, 1), P('banca-jornal', 'cid-props2-07', 0.3, 1),
        P('barreira', 'cid-props2-06', 0.34, 1),
      ],
      poste: [P('poste', 'cid-props-07', 0.3, 3), P('poste-duplo', 'cid-props2-05', 0.32, 2)],
      semaforo: [P('semaforo', 'cid-props2-01', 0.3)],
      pessoa: [G('menino', 'vida-menino'), G('menina', 'vida-menina'), G('homem', 'vida-homem'), G('mulher', 'vida-mulher'), G('vovo', 'vida-vovo'), G('chef', 'vida-chef')],
      pequeno: [
        P('banco', 'cid-props-04', 0.55, 2), P('arbusto', 'cid-props-08', 0.55, 3), P('patinete', 'cid-props-09', 0.45, 1),
        P('mesa', 'cid-props2-08', 0.6, 1), P('arbusto-flor', 'cid-props2-09', 0.5, 2),
      ],
      medio: [
        P('arvore', 'cid-nat-01', 0.95, 3), P('pinheiro', 'cid-nat-02', 0.85, 2), P('arvore-alta', 'cid-nat-03', 1.1, 1),
        P('chafariz', 'cid-nat-04', 1.15, 1), P('ponto-onibus', 'cid-nat-05', 1.0, 1), P('cabine', 'cid-nat-06', 0.6, 1),
        P('banca', 'cid-nat-07', 0.95, 1), P('escorregador', 'cid-nat-08', 1.05, 1), P('carrinho-lanche', 'cid-nat-09', 0.8, 1),
      ],
      arvore: [P('arvore', 'cid-nat-01', 0.95, 3), P('pinheiro', 'cid-nat-02', 0.85, 2), P('arvore-alta', 'cid-nat-03', 1.1, 1)],
      carro: [V('hatch', 'hatch', 0.85, 3), V('sedan', 'sedan', 0.95, 3), V('taxi', 'taxi', 0.95, 2), V('perua', 'perua', 1.0, 2), V('picape', 'picape', 1.0, 2), V('mini', 'mini', 0.75, 2)],
      grande: [V('onibus', 'onibus', 1.6, 2), V('caminhao', 'caminhao', 1.5, 2), V('bombeiros', 'bombeiros', 1.6, 1)],
      casa: [
        C('casa-a', 'cid-fach-01', 1.9, 'telha'), C('casa-b', 'cid-fach-02', 1.9, 'telha'), C('casa-c', 'cid-fach-03', 2.0, 'telha'),
        C('casa-d', 'cid-fach2-01', 1.95, 'telha'), C('casa-e', 'cid-fach2-02', 1.85, 'telha'), C('casa-f', 'cid-fach2-03', 2.0, 'telha'),
      ],
      casinha: [C('casinha', 'cid-fach-02', 1.4, 'telha'), C('casinha-b', 'cid-fach2-02', 1.45, 'telha')],
      loja: [
        X('loja-a', 'cid-fach-04', 2.0), X('loja-b', 'cid-fach-05', 2.0), X('cafe', 'cid-fach-06', 1.95),
        X('padaria', 'cid-fach2-04', 2.0), X('floricultura', 'cid-fach2-05', 1.95), X('brinquedos', 'cid-fach2-06', 2.05),
      ],
      predio: [
        X('predio-a', 'cid-fach-07', 2.9), X('predio-b', 'cid-fach-08', 3.0), X('predio-c', 'cid-fach2-07', 2.9),
        X('predio-d', 'cid-fach2-08', 3.1), X('predio-e', 'cid-fach2-09', 2.9),
      ],
      torre: [X('torre', 'cid-fach-09', 3.9)],
      ...ADERECOS,
      marco: [P('prefeitura', 'cid-marcos-01', 3.4), P('roda-gigante', 'cid-marcos-02', 3.2), P('caixa-dagua', 'cid-marcos-03', 2.6), P('quartel', 'cid-marcos-04', 3.0)],
    },
    gigante: P('robo', 'gigantes-01', 4.2, 1, { h: 11 }),
  },
  praia: {
    id: 'praia',
    chao: { rua: 'deck', calcada: 'areia-clara', miolo: 'areia', praca: 'pracinha-areia', borda: 'areia', fora: 'agua' },
    faixa: false,
    cores: {
      carro: ['#2ec4c4', '#ff6f61', '#ffd23f', '#fff3dc', '#5fd3a8', '#ff9fb5', '#4fb3ff'],
      parede: ['#fff8ec', '#d9f4ff', '#ffe9b0', '#ffd7cc', '#d6f5e6'],
      teto: ['#d9a35a', '#e8564a', '#2ec4c4', '#f2b632', '#4f9be8'],
    },
    papeis: {
      cone: ['balde', 'bola', 'estrela'], barreira: ['quebra-vento', 'balde'], placa: ['placa'], barraca: ['barraca'],
      caixote: ['caixote', 'cooler'], mesa: ['mesa-sol', 'espreguicadeira'], vaso: ['conchas', 'estrela', 'chinelos'],
      bike: ['prancha', 'bola'], moto: ['moto'], lixeira: ['cooler'], caixa: ['boia-poste', 'gaivota'], hidrante: ['caranguejo'],
      arbusto: ['palmeirinha', 'castelo'], carrinho: ['carrinho'], banco: ['espreguicadeira'],
    },
    grupos: {
      calcada: [
        P('balde', 'pra-props-03', 0.26, 3), P('estrela', 'pra-props-08', 0.24, 2), P('caranguejo', 'pra-props-07', 0.26, 2),
        P('bola', 'pra-props-02', 0.28, 2), P('cooler', 'pra-props-09', 0.32, 2), P('gaivota', 'pra-props2-05', 0.26, 2),
        P('chinelos', 'pra-props2-06', 0.3, 1), P('conchas', 'pra-props2-07', 0.28, 2), P('boia-poste', 'pra-props2-01', 0.3, 1),
      ],
      poste: [P('tocha', 'pra-props2-04', 0.28, 3), P('chuveiro', 'pra-props2-03', 0.34, 1)],
      semaforo: [P('tocha', 'pra-props2-04', 0.28)],
      pessoa: [G('banhista', 'vida-banhista', 2), G('turista', 'vida-turista', 2), G('menino', 'vida-menino'), G('menina', 'vida-menina')],
      pequeno: [
        P('guarda-sol', 'pra-props-01', 0.6, 3), P('castelo', 'pra-props-04', 0.55, 2), P('prancha', 'pra-props-05', 0.5, 2),
        P('espreguicadeira', 'pra-props-06', 0.55, 2), P('rede-volei', 'pra-props2-02', 0.6, 1), P('quebra-vento', 'pra-props2-08', 0.55, 1),
        P('palmeirinha', 'pra-props2-09', 0.5, 2),
      ],
      medio: [
        P('salva-vidas', 'pra-med-01', 1.0, 1), P('palmeira', 'pra-med-02', 0.95, 4), P('carrinho-sorvete', 'pra-med-03', 0.8, 1),
        P('boia', 'pra-med-08', 0.7, 2), P('caiaque', 'pra-med-09', 0.85, 1),
      ],
      arvore: [P('palmeira', 'pra-med-02', 0.95, 4), P('palmeirinha', 'pra-props2-09', 0.5, 1)],
      barco: [P('veleiro', 'pra-med-04', 1.0, 2), P('bote', 'pra-med-05', 0.9, 2), P('jet-ski', 'pra-med-06', 0.8, 2)],
      carro: [V('buggy', 'buggy', 0.9, 3), V('kombi', 'kombi', 1.0, 3), V('jipe', 'jipe', 0.95, 2), V('sorvete', 'sorvete', 1.05, 1)],
      grande: [V('onibus-praia', 'onibus', 1.6, 2), P('barco', 'pra-med-04', 1.55, 1)],
      casa: [
        C('cabana-a', 'pra-fach-01', 1.9, 'palha'), C('cabana-b', 'pra-fach-02', 1.9, 'palha'), C('cabana-c', 'pra-fach-03', 2.0, 'palha'),
        C('chale-a', 'pra-fach2-01', 1.95, 'telha'), C('chale-b', 'pra-fach2-02', 1.85, 'telha'), C('chale-c', 'pra-fach2-03', 1.9, 'telha'),
      ],
      casinha: [C('cabaninha', 'pra-fach-01', 1.4, 'palha'), C('chalezinho', 'pra-fach2-02', 1.45, 'telha')],
      loja: [
        X('quiosque', 'pra-fach-04', 1.95, 1, 'palha'), X('loja-surf', 'pra-fach-05', 2.0), X('sorveteria', 'pra-fach-06', 1.95),
        X('peixaria', 'pra-fach2-04', 2.0, 1, 'palha'), X('cafe-praia', 'pra-fach2-05', 1.95, 1, 'palha'), X('aluguel-surf', 'pra-fach2-06', 2.0),
      ],
      predio: [
        X('hotel-a', 'pra-fach-07', 2.9), X('hotel-b', 'pra-fach-08', 3.0), X('hotel-c', 'pra-fach2-07', 2.9),
        X('hotel-d', 'pra-fach2-08', 3.1), X('hotel-e', 'pra-fach2-09', 2.9),
      ],
      torre: [X('hotel-torre', 'pra-fach-09', 3.9)],
      ...ADERECOS,
      marco: [P('farol', 'pra-marcos-01', 3.0), P('castelo-areia', 'pra-marcos-02', 3.2), P('bar-praia', 'pra-marcos-03', 2.8), P('pier', 'pra-marcos-04', 3.0)],
    },
    gigante: P('flamingo', 'gigantes-02', 4.2, 1, { h: 9 }),
  },
  doceria: {
    id: 'doceria',
    chao: { rua: 'chocolate', calcada: 'biscoito', miolo: 'glace', praca: 'pracinha-doce', borda: 'glace', fora: 'calda' },
    faixa: false,
    cores: {
      carro: ['#ff8fc8', '#8ff0d0', '#fff07a', '#c9a6ff', '#fff6fb', '#7fd4ff', '#ff6f8f'],
      parede: ['#fff0f6', '#e9fff4', '#fff7c9', '#efe4ff', '#ffe3d1'],
      teto: ['#ffb3d9', '#fff6fb', '#b8f0dc', '#d9c2ff', '#ffe58a'],
    },
    papeis: {
      cone: ['bala', 'jujuba', 'macaron'], barreira: ['bengala', 'bala'], placa: ['placa'], barraca: ['barraca'],
      caixote: ['presente'], mesa: ['mesa-sol', 'banco-marsh'], vaso: ['pilha-jujuba', 'macaron', 'carolina'],
      bike: ['pirulito', 'flor-pirulito'], moto: ['moto'], lixeira: ['biscoitos'], caixa: ['carolina', 'pilha-jujuba'],
      hidrante: ['macaron'], arbusto: ['arbusto-goma', 'cupcake', 'casquinha'], carrinho: ['carrinho'], banco: ['banco-marsh', 'banco-choc'],
    },
    grupos: {
      calcada: [
        P('bala', 'doc-props-01', 0.26, 3), P('pirulito', 'doc-props-02', 0.3, 3), P('jujuba', 'doc-props-03', 0.26, 2),
        P('macaron', 'doc-props-06', 0.28, 2), P('bengala', 'doc-props-07', 0.3, 2), P('pilha-jujuba', 'doc-props2-05', 0.3, 2),
        P('biscoitos', 'doc-props2-06', 0.3, 1), P('flor-pirulito', 'doc-props2-07', 0.28, 2), P('carolina', 'doc-props2-08', 0.3, 1),
      ],
      poste: [P('poste-bengala', 'doc-props2-02', 0.3)],
      semaforo: [P('poste-bengala', 'doc-props2-02', 0.3)],
      pessoa: [G('ursinho', 'vida-ursinho', 2), G('biscoito', 'vida-biscoito', 2), G('menino', 'vida-menino'), G('menina', 'vida-menina')],
      pequeno: [
        P('rosquinha', 'doc-props-04', 0.5, 3), P('cupcake', 'doc-props-05', 0.5, 3), P('casquinha', 'doc-props-09', 0.45, 2),
        P('arbusto-goma', 'doc-props2-01', 0.5, 2), P('banco-marsh', 'doc-props2-03', 0.55, 1), P('banco-choc', 'doc-props2-04', 0.55, 1),
        P('carrinho-doce', 'doc-props2-09', 0.6, 1),
      ],
      medio: [
        P('arvore-pirulito', 'doc-med-01', 0.95, 4), P('fatia-bolo', 'doc-med-02', 0.9, 2), P('algodao-doce', 'doc-med-04', 0.95, 3),
        P('fonte-chocolate', 'doc-med-05', 1.1, 1), P('rosquinha-grande', 'doc-med-08', 1.0, 1),
      ],
      arvore: [P('arvore-pirulito', 'doc-med-01', 0.95, 3), P('algodao-doce', 'doc-med-04', 0.95, 2)],
      carro: [V('carro-doce', 'doce', 0.85, 3), V('van-doce', 'sorvete', 1.05, 2), V('mini-doce', 'mini', 0.75, 2)],
      grande: [V('trem-doce', 'trem', 1.5, 2), P('bolo', 'doc-med-03', 1.5, 1)],
      casa: [
        C('casa-biscoito', 'doc-fach-01', 1.9, 'glace'), C('casa-cupcake', 'doc-fach-02', 1.9, 'glace'), C('casa-bala', 'doc-fach-03', 2.0, 'glace'),
        C('casa-menta', 'doc-fach2-01', 1.95, 'glace'), C('casa-chocolate', 'doc-fach2-02', 1.85, 'glace'), C('casa-limao', 'doc-fach2-03', 1.9, 'glace'),
      ],
      casinha: [C('casinha-biscoito', 'doc-fach-01', 1.4, 'glace'), C('casinha-menta', 'doc-fach2-01', 1.45, 'glace')],
      loja: [
        X('confeitaria', 'doc-fach-04', 1.95, 1, 'glace'), X('sorveteria-doce', 'doc-fach-05', 2.0, 1, 'glace'), X('waffle', 'doc-fach-06', 1.95, 1, 'glace'),
        X('padaria-doce', 'doc-fach2-04', 2.0, 1, 'glace'), X('jujubaria', 'doc-fach2-05', 1.95, 1, 'glace'), X('algodoaria', 'doc-fach2-06', 2.0, 1, 'glace'),
      ],
      // o bolo de andares e a torre de doce tem silhueta propria: pecas em billboard, nao caixas
      predio: [
        P('bolo-andares', 'doc-fach-07', 3.1, 1, { h: 7.5 }), X('torre-chocolate', 'doc-fach-08', 3.0, 1, 'glace'),
        X('predio-waffle', 'doc-fach2-07', 2.9, 1, 'glace'), X('predio-listrado', 'doc-fach2-08', 3.0, 1, 'glace'), X('torre-glace', 'doc-fach2-09', 2.9, 1, 'glace'),
      ],
      torre: [P('torre-doce', 'doc-fach-09', 3.9, 1, { h: 12 })],
      ...ADERECOS,
      presente: [A('presente', 'presente', 0.34, 'doce')],
      marco: [P('castelo-doce', 'doc-marcos-01', 3.4), P('torre-chiclete', 'doc-marcos-02', 2.8), P('fabrica', 'doc-marcos-03', 3.2), P('torre-sorvete', 'doc-marcos-04', 2.8)],
    },
    gigante: P('bolo-gigante', 'gigantes-03', 4.2, 1, { h: 8 }),
  },
};

/** Material do som de cada peca pelo id (o resto sai da forma e do grupo em materialDe). */
const MATERIAL = {
  metal: ['hidrante', 'lixeira', 'caixa-correio', 'bicicleta', 'patinete', 'poste', 'poste-duplo', 'semaforo', 'banca-jornal',
    'escorregador', 'carrinho-lanche', 'chuveiro', 'boia-poste', 'carrinho-sorvete', 'cooler'],
  madeira: ['banco', 'mesa', 'banca', 'tocha', 'espreguicadeira', 'prancha', 'rede-volei', 'quebra-vento', 'caiaque', 'salva-vidas',
    'veleiro', 'bote', 'barco', 'pier', 'bar-praia', 'quiosque', 'peixaria', 'cafe-praia', 'roda-gigante'],
  vidro: ['cabine', 'ponto-onibus', 'loja-a', 'loja-b', 'cafe', 'padaria', 'floricultura', 'brinquedos', 'predio-a', 'predio-b',
    'predio-c', 'predio-d', 'predio-e', 'torre', 'hotel-a', 'hotel-b', 'hotel-c', 'hotel-d', 'hotel-e', 'hotel-torre',
    'loja-surf', 'sorveteria', 'aluguel-surf', 'farol', 'prefeitura'],
  planta: ['arvore', 'pinheiro', 'arvore-alta', 'arbusto', 'arbusto-flor', 'topiaria', 'floreira', 'vaso', 'palmeira', 'palmeirinha'],
  pedra: ['chafariz', 'castelo', 'castelo-areia', 'caixa-dagua', 'quartel', 'estrela', 'conchas', 'caranguejo'],
  plastico: ['cone', 'barreira', 'balde', 'bola', 'chinelos', 'guarda-sol', 'boia', 'jet-ski', 'gaivota'],
};
const MATERIAL_ID = new Map(Object.entries(MATERIAL).flatMap(([m, ids]) => ids.map((id) => [id, m])));

/**
 * Material do som de uma peca (v0.3.0): cada material tem um timbre no combo de engolir.
 * @param {string} tema @param {Peca} p
 */
export function materialDe(tema, p) {
  if (p.mat) return p.mat;
  if (p.forma === 'pessoa') return 'pessoa';
  if (p.forma === 'carro') return 'carro';
  const m = MATERIAL_ID.get(p.id);
  if (m) return m;
  if (tema === 'doceria') return 'doce';
  if (p.forma === 'casa') return 'madeira';
  if (p.forma === 'caixa') return 'vidro';
  return 'plastico';
}

export const MAPAS = /** @type {const} */ (['cidade', 'praia', 'doceria']);
export const MODOS = /** @type {const} */ (['classico', 'solo', 'batalha']);

/**
 * Sorteia uma peca do grupo pelo peso.
 * @param {Peca[]} lista
 * @param {() => number} r
 */
export function sortearPeca(lista, r) {
  let total = 0;
  for (const p of lista) total += p.peso || 1;
  let x = r() * total;
  for (const p of lista) {
    x -= p.peso || 1;
    if (x <= 0) return p;
  }
  return lista[lista.length - 1];
}

/** Quadros de cada pessoa: arquivos <arte>-01..09 (andar 1-4, correr 5-6, susto 7, aceno 8, queda 9). */
export const QUADROS_PESSOA = 9;

/**
 * Peca do tema pelo id (procura em todos os grupos).
 * @param {string} tema @param {string} id
 */
export function pecaPorId(tema, id) {
  for (const lista of Object.values(TEMAS[tema].grupos)) for (const p of lista) if (p.id === id) return p;
  return null;
}

/** Todos os nomes de arte que um tema usa (o render carrega so estes). @param {string} tema */
export function artesDoTema(tema) {
  const t = TEMAS[tema];
  const sprites = new Set();
  const fachadas = new Set();
  const todas = [...Object.values(t.grupos).flat(), t.gigante];
  for (const p of todas) {
    if (p.forma === 'sprite') sprites.add(p.arte);
    else if (p.forma === 'pessoa') for (let k = 1; k <= QUADROS_PESSOA; k++) sprites.add(`${p.arte}-${String(k).padStart(2, '0')}`);
    else if (p.forma === 'casa' || p.forma === 'caixa') fachadas.add(p.arte);
  }
  return { sprites: [...sprites], fachadas: [...fachadas] };
}
