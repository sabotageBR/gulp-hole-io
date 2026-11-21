// Monta arte/pedidos/06-vida.json (versao 0.2.0): pessoas com quadros de animacao (cada uma editada a partir do
// boneco base recortado de arte/bruto/pessoas.jpg, ou do ursinho e do biscoito da doceria), marcos de cada mapa,
// mais fachadas e mais pecas de rua. Mesmo bloco de estilo do docs/GDD.md.
import { writeFileSync } from 'node:fs';
const ESTILO = 'Art style: bright stylized 3D toy diorama render, chunky rounded shapes like glossy painted wood and soft plastic toys, simple clean forms with little detail, saturated candy palette of sky blue, mint green, coral red, sunflower yellow and lilac on warm cream, soft warm sunlight from the upper left with gentle ambient occlusion and short soft shadows, crisp readable silhouettes, no text, no letters, no numbers, no logos, no signs with writing, no watermark.';
const REF = ['arte/escolhida/ref-1x1.jpg'];
const MAG = 'isolated on a perfectly flat solid magenta (#FF00FF) background, no shadow, no gradient, no ground, no text';
const VERDE = 'isolated on a perfectly flat solid pure green (#00FF00) background, no shadow, no gradient, no ground, no text';
const lista = (itens) => itens.map((t, i) => `(${i + 1}) ${t}`).join(', ');

const POSES = [
  'walking to the left, left leg forward and right arm forward',
  'walking to the left, legs together in the middle of the step',
  'walking to the left, right leg forward and left arm forward',
  'walking to the left, legs together in the middle of the step, arms down',
  'running fast to the left, long stride, arms pumping, leaning forward',
  'running fast to the left, the other stride, both feet off the ground',
  'scared and screaming, facing the viewer, both arms raised high, mouth wide open, eyes wide',
  'waving hello with one hand raised high, facing the viewer, smiling',
  'tumbling and falling backwards, arms and legs flailing, surprised open mouth',
];
const poses = (quem, fundo = MAG) =>
  `Using the reference image as the exact character design (same face, hair, clothes, colors, proportions and toy style), draw a 3x3 grid of 9 separate full-body poses of ${quem}, every pose the same size, evenly spaced, wide empty space between them, each seen from the same high three-quarter camera as the reference image, in reading order: ${lista(POSES)}. Each pose whole and centered in its cell, never touching another pose or the image border, ${fundo}. ${ESTILO}`;
const novo = (quem, fundo = MAG) =>
  `Using the reference image only for its toy figure style, proportions, face style and lighting, design a new character: ${quem}. Draw a 3x3 grid of 9 separate full-body poses of this same new character, every pose the same size, evenly spaced, wide empty space between them, each seen from the same high three-quarter camera as the reference image, in reading order: ${lista(POSES)}. Each pose whole and centered in its cell, never touching another pose or the image border, ${fundo}. ${ESTILO}`;
const grade = (o, itens, fundo = MAG) =>
  `Using the reference image only for its toy art style, colors and lighting, draw a 3x3 grid of 9 separate ${o}, evenly spaced, wide empty space between them, each seen from the same high three-quarter top-down camera as the reference image, facing left, in reading order: ${lista(itens)}. Each item whole and centered in its cell, never touching another item or the image border, ${fundo}. ${ESTILO}`;
const marcos = (o, itens, fundo = MAG) =>
  `Using the reference image only for its toy art style, colors and lighting, draw a 2x2 grid of 4 separate big ${o}, evenly spaced, wide empty space between them, each one whole, seen from the same high three-quarter top-down camera as the reference image, in reading order: ${lista(itens)}. Each landmark whole and centered in its cell, never touching another one or the image border, ${fundo}. ${ESTILO}`;
const fach = (o, itens) =>
  `Using the reference image only for its toy art style, colors and lighting, draw a 3x3 grid of 9 separate flat front-view wall facades of ${o}, each one a straight-on orthographic elevation with no perspective, a clean flat rectangle of wall from the ground line to a straight top edge, with doors and windows, absolutely no roof, no gable, no chimney and nothing above the top edge, no sky, evenly spaced, wide empty space between them, in reading order: ${lista(itens)}. ${MAG}. ${ESTILO}`;

const p = [
  // pessoas da cidade (boneco base recortado da grade original)
  { id: 'vida-menino', imagens: ['arte/refs/pessoa-01.jpg'], prompt: poses('this toy boy in a yellow shirt and blue pants') },
  { id: 'vida-menina', imagens: ['arte/refs/pessoa-02.jpg'], prompt: poses('this toy girl in a coral dress with a red bow') },
  { id: 'vida-homem', imagens: ['arte/refs/pessoa-03.jpg'], prompt: poses('this toy man in a mint jacket') },
  { id: 'vida-mulher', imagens: ['arte/refs/pessoa-04.jpg'], prompt: poses('this toy woman in a lilac sweater') },
  { id: 'vida-vovo', imagens: ['arte/refs/pessoa-06.jpg'], prompt: poses('this toy grandpa with a white beard and a brown vest (no cane)') },
  { id: 'vida-chef', imagens: ['arte/refs/pessoa-08.jpg'], prompt: poses('this toy chef in white with a tall chef hat') },
  // praia: dois novos no mesmo estilo
  { id: 'vida-banhista', imagens: ['arte/refs/pessoa-05.jpg'], prompt: novo('a cheerful toy kid in a sky-blue swimsuit with an orange swim ring around the waist and swim goggles on the forehead') },
  { id: 'vida-turista', imagens: ['arte/refs/pessoa-04.jpg'], prompt: novo('a toy woman tourist in a coral sundress with a big straw sun hat and sunglasses pushed up on her hat') },
  // doceria: ursinho de goma e boneco de biscoito
  { id: 'vida-ursinho', imagens: ['arte/refs/ursinho.jpg'], prompt: poses('this translucent red gummy bear, now with short legs and arms so it can walk and run like a little person', VERDE) },
  { id: 'vida-biscoito', imagens: ['arte/refs/biscoito.jpg'], prompt: poses('this gingerbread man cookie with white icing details', VERDE) },
  // marcos de cada mapa (2x2, viram pecas em billboard)
  { id: 'cid-marcos', imagens: REF, prompt: marcos('toy town landmarks', ['a cream town hall with a tall clock tower, the clock face blank with no numbers', 'a small ferris wheel with colorful cabins', 'a sky-blue water tower on four legs', 'a red fire station with two big garage doors and a little tower']) },
  { id: 'pra-marcos', imagens: REF, prompt: marcos('toy beach landmarks', ['a red and white striped lighthouse on a little rock', 'a giant sandcastle with flags and no writing', 'a wooden beach bar with a straw roof and stools', 'a short wooden pier with a little fishing hut']) },
  { id: 'doc-marcos', imagens: REF, prompt: marcos('toy candy land landmarks', ['a pink candy castle with lollipop towers', 'a tall gumball machine tower full of colorful gumballs', 'a chocolate factory with striped candy cane chimneys and no writing', 'a giant ice cream cone tower with three scoops'], VERDE) },
  // mais fachadas
  { id: 'cid-fach2', imagens: REF, prompt: fach('toy town buildings', ['a red brick house wall with white window frames and a green door', 'a sunflower-yellow house wall with mint shutters and a blue door', 'a sky-blue house wall with a white porch door and flower boxes', 'a bakery front with a striped cream and coral awning and a window full of bread, no writing', 'a flower shop front with flower boxes and buckets of flowers, no writing', 'a toy shop front with round windows and a lilac awning, no writing', 'a red brick four-storey apartment building front with small balconies, taller than wide', 'a mint office building front with a neat grid of windows, taller than wide', 'a lilac four-storey apartment building front with bay windows, taller than wide']) },
  { id: 'pra-fach2', imagens: REF, prompt: fach('toy beach town buildings', ['a white beach cottage wall with sky-blue shutters and a blue door', 'a yellow fisherman house wall with a round porthole window and a red door', 'a coral beach bungalow wall with porthole windows and a mint door', 'a seafood shack front with fishing nets and a counter, no writing', 'a beach cafe front with a straw awning and small round tables, no writing', 'a surf rental shop front with a rack of colorful surfboards, no writing', 'a white and sky-blue striped four-storey hotel front with balconies, taller than wide', 'a pastel mint apartment front with round balconies, taller than wide', 'a sandy beige five-storey hotel front with arched windows, taller than wide']) },
  { id: 'doc-fach2', imagens: REF, prompt: fach('toy candy town buildings', ['a mint candy cottage wall with a candy cane door frame', 'a chocolate brick house wall with white frosting window frames', 'a lemon yellow house wall with gumdrop trims and a pink door', 'a candy bakery front with a cream awning and cakes in the window, no writing', 'a jelly bean shop front with big jars in the window, no writing', 'a cotton candy shop front with a pink and blue awning, no writing', 'a waffle-textured four-storey building front with windows, taller than wide', 'a pink and white striped candy apartment front, taller than wide', 'a pastel blue frosting tower front with round windows, taller than wide']) },
  // mais pecas de rua
  { id: 'cid-props2', imagens: REF, prompt: grade('small toy town street props', ['a traffic light on a pole with no writing', 'a parked mint bicycle', 'a wooden planter box with red flowers', 'a round topiary tree in a pot', 'a double street lamp', 'a striped orange and white road barrier', 'a sky-blue newspaper box with no writing', 'a wooden picnic table', 'a small round green bush with pink flowers']) },
  { id: 'pra-props2', imagens: REF, prompt: grade('small toy beach props', ['a white post with an orange lifebuoy', 'a small beach volleyball net', 'a wooden outdoor beach shower', 'a tiki torch', 'a white seagull standing', 'a pair of flip flops and a towel', 'a small pile of seashells', 'a striped beach windbreak', 'a little palm tree in sand']) },
  { id: 'doc-props2', imagens: REF, prompt: grade('small toy candy land props', ['a gumdrop bush', 'a candy cane street lamp', 'a pink marshmallow bench', 'a chocolate bar bench with no writing', 'a jelly bean pile', 'a stack of cookies', 'a lollipop flower', 'a cream puff with a cherry on top', 'a small mint ice cream cart with no writing'], VERDE) },
];
writeFileSync(new URL('./06-vida.json', import.meta.url), JSON.stringify(p.map((x) => ({ modo: 'editar', pular: true, ...x })), null, 1));
console.log(p.length, 'pedidos');
