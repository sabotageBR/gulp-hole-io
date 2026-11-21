# Pothole Party.io — GDD

Pasta e slug interno: `gulp-hole-io` (porta local 5510, armazenamento `gulphole.`). Nome de trabalho era
**Gulp Hole.io**; foi trocado em 2026-11-20 porque colide com dois jogos do mesmo gênero: **Gulp** (buraco .io,
Brain Games, Playgama, nov/2026) e **Gulpit** (buraco que engole tudo, CrazyGames, out/2026). "Pothole Party"
não aparece em nenhuma loja nem portal (busca de 2026-11-20). O título público é **Pothole Party.io** nos três
idiomas (é marca).

## Gancho

Você é um **buraco** na rua de uma cidade de brinquedo. Tudo que é menor que a sua boca tomba e cai lá dentro, e
cada coisa engolida faz o buraco crescer: de cones e bonequinhos a carros, árvores, casas e prédios. Rodadas de
2 minutos contra 7 a 9 buracos-bots, com placar ao vivo e coroa no maior. Gênero dos jogos de buraco (.io), com
nome, cidade, mapas, modos, peças e arte próprios.

## Laço

1. **Mover** o buraco (arrastar como joystick em qualquer lugar da tela, mouse que guia o buraco, setas ou WASD).
2. **Engolir**: objeto com pegada menor que ~92% do raio cai quando o centro dele entra na boca. Ele inclina para
   o centro, gira e afunda; só aparece dentro do buraco (o chão é recortado no shader).
3. **Crescer**: área do buraco += área do objeto × fator. O raio sobe, a câmera se afasta e objetos maiores ficam
   possíveis. Um "plim" sobe de tom a cada degrau de tamanho (anel na borda).
4. **Disputar**: buraco 12% maior engole o menor que entrar na boca dele. No Clássico quem é engolido renasce
   pequeno em 2 s (perde 60% da área, mantém nada de pontos da rodada além do que já está no placar).
5. **Fim da rodada** (2:00): placar, XP, desbloqueio, e a próxima rodada a um toque.

## Controles

- **Toque / mouse arrastando**: a posição do dedo em relação ao ponto onde ele encostou é o joystick (zona morta
  pequena, velocidade cheia com 60 px). Sem botão na tela.
- **Mouse parado (desktop)**: o buraco segue o cursor quando ele está fora de uma zona central de 40 px.
- **Teclado**: setas ou WASD; ESC, espaço ou P pausam.

## Modos e mapas

| Modo | Regra | Liberação |
|---|---|---|
| **Clássico** | 2 min, 8 a 10 buracos; vence o maior no fim; ser engolido renasce pequeno | Início |
| **Solo** | 2:30 sozinho, sem bots, num bairro de 3×3 quarteirões (66; o Clássico tem 120); meta: engolir 100% (estrelas em 60/85/100%) | 3ª rodada |
| **Batalha** | Arena menor (84), sem renascer; último buraco de pé (ou o maior quando o tempo acaba) | 5ª rodada |

| Mapa | Chão | Peças |
|---|---|---|
| **Cidade de Brinquedo** | asfalto, calçada, grama | cones, hidrantes, bonecos, bancos, carros, ônibus, árvores, casas, lojas, torres; gigante: robô de brinquedo |
| **Praia** | areia, deck de madeira, calçadão | guarda-sóis, baldes, castelos de areia, pranchas, cadeiras, quiosques, salva-vidas, palmeiras, barcos, hotéis; gigante: flamingo inflável |
| **Doceria** | glacê, calda, piso de chocolate | balas, pirulitos, rosquinhas, cupcakes, sorvetes, casas de biscoito, torres de bolo; gigante: bolo de aniversário |

## Os 3 primeiros minutos, passo a passo

| Tempo | O que acontece |
|---|---|
| 0 s | Sem menu nem splash: a cidade já está na tela com o buraco do jogador no meio de um "canteiro" de cones e bonecos. Mão-guia de **arrasto** pulsa do buraco para o canteiro. |
| 1–3 s | Primeiro gesto: `gameplayStart`, a mão some, os primeiros cones caem (som de "plop" que sobe de tom). |
| 3–12 s | A rua do começo é uma trilha roteirizada: cones → bonecos → banco → carro pequeno. Cada degrau de tamanho tem um anel de luz e um texto curto ("Maior!"). |
| ~15 s | **Uau:** a primeira **casa** fica ao alcance e é engolida (casa tomba inteira, poeira, tremida leve, festa curta "Uma casa inteira!"). |
| 15–60 s | Bots fracos (lentos, não caçam o jogador nas 2 primeiras rodadas). Placar ao vivo com o jogador subindo para o topo; **coroa** quando ele vira o maior. |
| ~70 s | **Novidade 1:** o **objeto gigante** (robô de brinquedo) aparece com seta na borda da tela: vale muito e só cabe num buraco grande. |
| 2:00 | Fim da rodada: placar (o jogador quase sempre 1º), +XP, barra de nível, primeira **skin de borda** liberada. Botão grande "Jogar" (e, a partir da 3ª rodada, opção 🎬 "começar maior" ao lado, do mesmo tamanho). |
| 2:05 | **Novidade 2:** a 2ª rodada abre direto no mapa **Praia**. |
| ~4:10 | **Novidade 3:** modo **Solo** (Doceria). Primeiro intervalo comercial possível nesta pausa (3ª rodada concluída). |
| ~6:15 | Mapa Doceria no Clássico; ~8:20 **Batalha**. Depois o jogador escolhe modo e mapa, com a sugestão da vez já marcada. |

Sem derrota nos ~3 primeiros minutos: nas 2 primeiras rodadas os bots não perseguem o jogador e só o engolem se
ele entrar na boca deles; ser engolido só renasce pequeno.

## Novidade a cada ~2 minutos

Cada rodada tem 2 min e cada uma das 5 primeiras traz algo novo (gigante, Praia, Solo, Doceria, Batalha). Depois:
gigante especial em toda rodada a partir de 1:10, **evento da rodada** sorteado (chuva de presentes, hora do rush
com mais carros, "buraco dourado" que vale o dobro), e skins novas a cada nível.

## Meta longa

- **XP por rodada** (tamanho final + colocação + engolidos). Nível = coleção de **18 skins de borda** (bordas
  temáticas: listras, flores, biscoito, granulado, ondas, lava, gelo, estrelas…) e os mapas e modos acima.
- **Recordes** por mapa e modo; estrelas do Solo.
- **Gancho diário leve**: "Desafio do dia" (um mapa e modo com uma meta simples, ex.: engolir 3 ônibus) que dá XP
  em dobro na primeira vitória do dia. Sem FOMO, sem energia, sem segunda moeda; perder o dia não tira nada.

## Anúncios

- **Intervalo** (`commercialBreak`) só entre rodadas (pausa natural), a partir da **3ª rodada concluída** ou ~4 min
  de jogo. O portal limita a frequência. Nunca em botão de navegação, nunca por relógio próprio.
- **Premiado** (`rewardedBreak`) só na tela entre rodadas, por escolha: "🎬 Começar maior" ao lado do botão grátis
  "Jogar" (maior ou do mesmo tamanho). Some sem vídeo (`!portal.temVideo`, Basic Launch). Prêmio só com `true`.

## Desempenho

three.js r187 vendorizado. `InstancedMesh` para todas as peças (sprites em billboard num atlas único) e prédios
(caixas com fachada e telhado num atlas); chão = um plano com textura composta no carregamento; 2 luzes (hemisfério
e direcional), sem mapa de sombra (sombras em mancha instanciadas). Texturas WebP pequenas. DPR máximo 2 (1,5 no
celular). Meta: 60 fps no desktop, 50+ no celular médio. Build Poki até 8 MB.

## Bíblia de arte

- **Mundo**: cidade de brinquedo em diorama: peças gordinhas e arredondadas como madeira pintada e plástico macio,
  formas simples, pouco detalhe, nada realista.
- **Paleta**: azul-céu `#5ec8ff`, menta `#6fe3b4`, coral `#ff6f61`, girassol `#ffd23f`, lilás `#b49cff` sobre creme
  `#fff3dc`; o buraco é preto azulado `#14121f` com borda grossa e brilhante.
- **Traço**: sem contorno preto, silhueta nítida, leitura em tamanho pequeno.
- **Luz**: sol quente do alto à esquerda, oclusão ambiente suave, sombra curta e macia.
- **Câmera**: alta, três-quartos de cima (a mesma do jogo) nas cenas e nos sprites; fachadas de frente.
- **Proibido**: texto, letras, números, logos, placas escritas, "$", marca d'água, rostos realistas.

**Bloco de estilo fixo (vai no fim de todo prompt):**

```
Art style: bright stylized 3D toy diorama render, chunky rounded shapes like glossy painted wood and soft plastic toys, simple clean forms with little detail, saturated candy palette of sky blue, mint green, coral red, sunflower yellow and lilac on warm cream, soft warm sunlight from the upper left with gentle ambient occlusion and short soft shadows, crisp readable silhouettes, no text, no letters, no numbers, no logos, no signs with writing, no watermark.
```

Sprites: `isolated on a perfectly flat solid magenta (#FF00FF) background, no shadow, no gradient, no ground, no
text` (verde `#00FF00` quando a peça é rosa ou roxa). Grades: `a 3x3 grid of 9 separate ..., evenly spaced, wide
empty space between them`, câmera alta três-quartos.

## Versão 0.2.0: cidade viva (pedido do usuário, 2026-11-20)

Resenha do usuário sobre a 0.1.0: "quero vida ao jogo, os NPCs ... o carro ter ângulos diferentes, coloque mais
edificações, está muito com cara de IA. O buraco não tem uma animação realista." E, para todos os jogos: tirar o
"barulho de catraca" (cliques rápidos em sequência). O que mudou:

- **Pessoas vivas** (`src/jogo/vida.js`): 10 bonecos (6 na Cidade, 2 novos na Praia, ursinho de goma e biscoito na
  Doceria), cada um com 9 quadros feitos no Grok a partir do boneco base: andar (4), correr (2), susto, aceno e queda.
  Andam pela calçada em volta do quarteirão, atravessam na faixa da esquina, conversam em grupinhos e acenam; com um
  buraco que as engole a menos de 2,4 da borda, levam um susto (balão "!" e grito curto) e fogem correndo (2,35 u/s,
  os buracos andam 4,3 ou mais). As da trilha da primeira rodada acenam em vez de fugir (o roteiro dos 15 s fica).
- **Carros 3D** (`src/render/carros.js`): 15 modelos montados no código (hatch, sedã, táxi, perua, picape, mini,
  ônibus, caminhão, bombeiros, buggy, kombi, jipe, van de sorvete, carro de doce, trem de doce), com cor da paleta do
  tema. Rodam pela mão direita, escolhem seguir ou virar em cada cruzamento (curva suave), param atrás de outro carro,
  de quem atravessa e antes de um buraco, buzinam, e dão meia-volta se o buraco não sai da frente.
- **Mais edificações**: Clássico com 6×6 quarteirões (lado 120) e Batalha com 4×4 (lado 84); 8 casas por quarteirão
  de casas, fileiras de lojas e prédios, parques com caminhos em cruz, estacionamentos (marina na Praia) e 2 marcos por
  mapa (prefeitura, roda-gigante, caixa d'água, quartel; farol, castelo de areia, bar de praia, píer; castelo de doce,
  torre de chiclete, fábrica de chocolate, torre de sorvete). 18 fachadas por mapa, postes, semáforos, faixas de
  pedestre, meio-fio com altura.
- **Menos cara de IA**: chão, telhados e partículas desenhados no código (`src/render/texturas.js`), sem amostra do
  Grok repetida; variação de tom do chão em escala grande; contorno lilás escuro em todo sprite (`tools/arte.mjs`);
  contorno nas arestas dos prédios, sombra de contato no pé da parede, sombra projetada do sol; cor de telhado e de
  carro por objeto; chaminé, ar-condicionado, caixa d'água e antena nos telhados.
- **Buraco realista**: a peça tomba na borda antes de cair (atrito, inclinação), depois cai com gravidade,
  escorrega para o centro acelerando e desce em espiral girando; a parede do tubo segura a peça; escurece com a
  profundidade. Borda mais grossa que respira e incha ao engolir, lábio interno, sombra de contato em volta, raio que
  cresce com mola, poeira na borda, pedrinhas que caem na boca (também quando o buraco anda) e tremor curto de câmera
  ao engolir algo grande.
- **Som sem catraca**: um "glub" grave por vez (peças seguidas viram um som só, no máximo 1 a cada 0,2 s), acordes no
  lugar de arpejos, nada de tique-taque nos 10 s finais. Teste em `test/vida.test.js` barra qualquer som com 3+ toques.
- **Balanceamento**: o mapa maior durava pouco com 9 buracos; buracos grandes ficaram mais lentos
  (`velocidadeDe = min(6,6; 4,3 + 0,32 r)`) e os bots também (0,58/0,68/0,78).

## Versão 0.3.0: crescimento, combo e prédios que desabam (pedido do usuário, 2026-11-20)

Resenha do usuário sobre a 0.2.0: "Tá quase ficando bom, coloque uma animação de crescimento no buraco para ser mais
real e prazeroso ver, coloque mais elementos na tela para ele comer e fazer vários barulhinhos em combo prazeroso. A
animação dos prédios sendo comidos eu quero que seja mais reais ainda. [...] Melhor a IA dos adversários." O que mudou:

- **Crescimento** (`crescer` em `src/render/cena.js`): no degrau de tamanho o raio passa do ponto e assenta (mola,
  impulso de 1,7 r na velocidade do raio), o asfalto racha em volta (anel com trincas desenhadas no código que aparecem
  em 0,08 s e somem em 1,1 s), lascas de asfalto e poeira caem da borda para dentro, uma onda corre pelo chão (anel
  claro e as peças pulam quando a frente passa, o pequeno pula mais), a câmera afasta um pouco (1,4 + 0,45 r, volta
  devagar) e toca o "abrir" (grave limpo descendo com uma quinta subindo, juntos). Entre um degrau e outro cada peça
  engolida empurra a borda um tiquinho (a mola assenta) e a borda incha: o buraco "respira".
- **Muito mais coisa para comer, em cachos** (`CACHOS` em `src/jogo/mapa.js`): obra (cones, barreira, placa),
  esquina (lixeira, caixa de correio, hidrante), jardim de vasos, fila de gente na placa, bicicletário, motos na vaga,
  carrinhos de compras, feira de barracas, mesinhas de café com guarda-sol, piquenique. Ficam na faixa de dentro da
  calçada, na vaga da rua, nas praças, nos quintais e na borda do mapa. Adereços novos em 3D feitos no código (moto,
  placa, barraca, caixote, presente, carrinho de compras, mesa com guarda-sol), poucos triângulos cada. O Clássico foi
  de ~1760 para ~3200 peças no começo.
- **Fluxo contínuo** (`reabastecer` em `src/jogo/rodada.js`): depois de 10 s, a cada 0,5 s, se sobrou menos que 82%
  das peças pequenas do começo, um cacho volta (até 3 por vez quando falta muito) num ponto de cacho já comido, longe
  de todos os buracos e fora da vista do jogador, mas perto dela; gente volta a andar e carro entra pela ponta da rua.
  Brota do chão com um quique. No Solo não há (o objetivo é limpar o bairro).
- **Combo de sons** (`src/som/combo.js`): cada peça engolida pede um "plop/gulp" curto com o timbre do material
  (`materialDe` no catálogo: plástico, metal, madeira, vidro, planta, pessoa, carro, pedra, doce); a altura sobe pela
  pentatônica maior enquanto o combo continua (até 2 oitavas) e um acorde maior fecha o combo depois de 0,75 s sem
  engolir. Regra contra a "catraca": no máximo uma nota a cada 0,125 s (8 por segundo); o que cai enquanto a próxima
  nota espera vira um toque só (acorde de 2 ou 3 graus da escala começando no mesmo instante); no máximo 6 vozes
  soando; ataque de pelo menos 8 ms em todo som; nenhum ruído junto do acerto (o desabar virou duas senoides graves
  com batimento). `test/v030.test.js` barra.
- **Prédio engolido** (`quebrar` em `cena.js`): tomba inteiro para o centro da boca (sem raio X enquanto cai), e
  quando passa do ponto se parte: andares soltos (cada um com a sua fatia da fachada e laje cortada em cima), o
  telhado de duas águas pula e gira, chaminé e caixa d'água viram entulho, blocos de entulho e cacos de vidro voam e
  brilham, sobe poeira na base (só do lado de fora da boca) e a câmera treme rápido. Os pedaços caem com física
  relativa ao centro do buraco (o buraco andando leva tudo junto), afundam cortados pelo plano do chão e apertam um
  pouco para caber; com o centro fora da boca ficam no chão até escorregar para dentro.
- **Grande demais racha e cede** (`CEDE`, `TEMPO_CEDE` em `rodada.js`): uma peça até 20% grande demais com a boca
  embaixo balança cada vez mais, racha (trincas no shader subindo do pé da parede, caquinhos e poeira caindo, um
  rangido grave) e cede depois de 1,5 s parada em cima.
- **IA dos adversários** (`src/jogo/ia.js`): personalidades (guloso, caçador, medroso) embaralhadas na mesa; procuram o
  cacho de maior valor (massa somada em volta, centro de massa, com bônus para o alvo atual: nada de ziguezague); fogem
  de maiores avaliando 16 direções sem se encurralar na borda (com reflexo: pensam na hora quando um maior chega
  perto); caçam menores mirando onde a presa vai estar (nunca nas 2 primeiras rodadas; mais na Batalha); contornam o
  que não cabe na boca com o lado da volta guardado; trocam de alvo se ficam presos (2 s sem progresso); sem nada a
  vista, vão para a região com mais comida. No Clássico um elástico leve (+10% a −16% de velocidade pela massa em
  relação ao jogador) deixa o placar disputado; nas rodadas protegidas ninguém ganha impulso.
- **Medidas** (`tools/medir.mjs`, 9 rodadas do Clássico com o piloto, antes → depois): intervalo médio entre peças
  0,31 → 0,16 s; p90 0,72 → 0,36 s; maior buraco sem comer 8,3 → 5,6 s; peças nos últimos 30 s 87 → 215; tempo sem
  nada que caiba perto 6,4% → 2,1%; massa do melhor bot / jogador 0,65 → 1,02 (média dos bots 0,30 → 0,68);
  colocação média do piloto 1,0 → 1,9; fuga de maiores 77% → 97%; bot parado no máximo 1 s.

## Versão 0.3.1: "da Doceria em diante os bots param e o mapa fica menor" (2026-11-21)

Relato do usuário sobre a 0.3.0 (aprovada): "Na fase da Doceria adiante os bots param de funcionar e o mapa fica menor
(talvez seja impressão), mas o jogo fica bugado". Reproduzido jogando as rodadas em sequência, como o jogador
(`tools/sequencia.mjs`: perfil novo, ordem real, clique em Jogar). A ordem do roteiro é Clássico na Cidade, Clássico na
Praia, **Solo na Doceria**, Clássico na Doceria, Batalha na Cidade. Causas:

- **Buracos fantasmas** (`cena.js`): a cena tem 12 buracos desenhados e a cada quadro só mexia nos da rodada; os que
  sobravam de uma rodada com mais bots ficavam visíveis, congelados onde estavam. Da Doceria em diante (Solo, com 1
  buraco, depois de 10; Batalha, com 8, depois de 10) apareciam aros parados no chão e na calda: os "bots que pararam".
  Agora `montar` esconde todos e o quadro esconde os que não são da rodada; `cena.buracosVisiveis` conta para as provas.
- **Mapa menor**: o Solo era 48 (2×2 quarteirões, 40% do Clássico) e a Batalha 84, sem nada que explicasse. O Solo
  passou a 66 (3×3 quarteirões, o dobro da área) com 2:30 (o piloto engole 99,7% em média; com 2:00 não limpava);
  a Batalha fica 84 (arena de propósito). Ao começar, Solo e Batalha se explicam ("Só você no bairro, sem bots…",
  "Arena menor e sem renascer…") e o mapa termina numa **mureta** com pilares na cor do tema (cerca viva na Cidade,
  madeira na Praia, bengala de doce na Doceria): a borda vira limite, não corte.
- **IA (valia para os três mapas, pior na Doceria)**: o bot pequeno seguia um carro que cabia na boca e, freando perto
  do alvo, nunca alcançava (o piloto ficou 18 s sem comer na 4ª rodada); o caçador alternava caça e cacho a cada
  pensamento (9,8 trocas por bot por rodada) e não comia; o bot cruzava o mapa atrás do gigante (74% do tempo em que
  ia ao gigante, a mais de 40 de distância); o alvo limitado a 1,5 da borda deixava a peça do canto fora da boca e o
  bot parado em cima dela (47 s). Agora: comendo ou caçando o bot não freia; peça que anda vale 0,45 no cacho; a caça
  continua até alcançar ou desistir (no ritmo em que fecha, sem alcançar em 4,5 s, ou passados 9 s, larga a presa por
  6 s) e o dado da caça rola no máximo a cada 1,5 s; o gigante só vale se estiver perto; quem foge só para com 60% a
  mais de folga; 2,5 s sem comer, o bot vai na peça que cabe mais perto; o alvo vai até onde o buraco anda; o vigia de
  preso também pega o bot parado em cima do alvo sem comer. O elástico do Clássico vai até +18% para quem ficou bem
  para trás.
- **Peças além da borda**: o reabastecimento brotava peças de cacho até fora do mapa (do lado de fora da mureta);
  agora passa pelo mesmo limite do `gerarMapa`.

Medidas (simulação, 6 rodadas por mapa, bots nos níveis reais da 5ª rodada em diante; 0.3.0 → 0.3.1): maior tempo de
um bot sem comer 21,5/39,9/33,4 s → 11,7/9,4/8,4 s (Cidade/Praia/Doceria); bots com seca de mais de 6 s 33/24/30 → 13/10/4
de 68; trocas caça↔cacho por bot por rodada 9,8 → 2,0; bot parado no máximo 0,5 s. No Clássico a massa dos bots ficou
igual (média 122 a 142, melhor 234 a 249) e a do piloto, que sofria com o carro, subiu (Doceria 221 → 322). Batalha com
os níveis reais: o piloto termina em 2,2º em média (antes 3,1º) e engole 3,9 bots por rodada.
Testes: `test/v031.test.js` (partida em sequência pela Doceria e a rodada seguinte, Solo 66, carro, compromisso,
borda), que falham na 0.3.0.
