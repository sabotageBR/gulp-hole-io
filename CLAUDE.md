# CLAUDE.md

Orientação para o Claude Code neste repositório.

## O que é

**Pothole Party.io** (`gulp-hole-io`): jogo de buraco (.io) em 3D: você é um buraco numa cidade de brinquedo e engole tudo que cabe na boca, crescendo de cones a prédios. Rodadas de 2 min contra 7 a 9 bots locais (sem servidor), 3 modos (Clássico, Solo, Batalha), 3 mapas (Cidade, Praia, Doceria) e coleção de skins de borda. Jogo original do estúdio (nome, tema, personagens e
arte próprios) para Poki, CrazyGames e californiagames.io, a partir do kit multiportal
(`../distribuicao/kit`, ver o README de lá). Catálogo no cofre: `../Nettools Games/Jogos/gulp-hole-io.md`.

## Rodar e testar

- `npm run servir` → http://127.0.0.1:5510/ (a PlataformaSDK em modo autônomo, anúncios simulados).
  Parâmetros só em localhost: `?novo`, `?fase=N`, `?semente=N`, `?auto`, `?filme=30`, `?semanuncio`, `?lang=pt|en|es`, `?limpo`, `?debug`.
- `npm test`: lógica pura, bots, vida da cidade, queda, fluxo, IA, combo de sons sem catraca, partida em sequência
  pelos três mapas, portais e as fronteiras do código.
- `node tools/medir.mjs --rodadas=9`: fluxo (intervalo entre peças do piloto, tempo sem comida perto) e IA (bot
  parado, fuga, ritmo dos bots / jogador) em rodadas simuladas; `--src=<outra cópia>/src` mede uma versão antiga.
- `node tools/sequencia.mjs .tmp/seq --rodadas=7`: partida em sequência no Chrome como o jogador joga (perfil novo,
  ordem real de mapas e modos, clicando em Jogar); falha com buraco fantasma desenhado, lado errado, bot parado ou sem
  crescer e erro no console. `--raiz=<cópia antiga>` roda outra versão (o zip extraído) para comparar.
- `node tools/quadros.mjs .tmp/x --params="auto&tamanho=2.05" --segundos=3 --log="expr"`: quadro a quadro (?filme)
  com folha de contato, para conferir animação (crescimento, prédio desabando) antes de dar por pronto.
- `node tools/olhar.mjs .tmp/foto --params="auto&mapa=praia" --tempos=4,10`: fotos do jogo no Chrome headless com GPU
  (o painel do navegador do app, oculto, congela o quadro). `node tools/fps.mjs`: fps no mesmo Chrome.
- `npm run empacotar` (4 alvos) e `npm run verificar`; prova do California: de `../distribuicao`,
  `node ferramentas/provar.mjs gulp-hole-io`.

## Arquitetura

- `src/main.js`: único módulo que toca portal, DOM, áudio e salvamento. Ciclo do portal como no kit.
- `src/jogo/`: lógica pura e determinística (sem DOM, relógio nem `Math.random`). `vida.js`: pessoas e carros
  (andar, atravessar, fugir, acenar; rodar na mão, virar, parar, buzinar). `mapa.js`: quarteirões e cachos
  (`CACHOS`, `montarCacho`). `rodada.js`: queda, reabastecimento, peça que racha e cede. `ia.js`: bots com
  personalidade (guloso, caçador, medroso).
- `src/render/`: desenho. `cena.js` (cena; `crescer` e `quebrar`), `carros.js` (carros e adereços 3D feitos no
  código), `texturas.js` (chão, telhados, partículas e rachaduras desenhados no código), `recursos.js` (atlas).
  `src/som/`: sons sintetizados; `combo.js` decide quando cada nota toca. `src/i18n/textos.js`: pt, en, es.
- `src/core/`: kit (não mexer sem motivo; correções voltam para `../distribuicao/kit`).
- `src/arte/`: arte processada (WebP). `arte/bruto/`: originais do Grok (fora do build). `docs/autoria.md`: prompts.

## Regras

- Código, comentários e docs em português; comentários ASCII em `src/jogo/`.
- Nenhum anúncio antes da fase 6 (ou ~4 min); intervalo só em pausa natural; premiado só por escolha, fora do jogo ativo.
- Armazenamento só com o prefixo `gulphole.`; nunca `clear()`.
- Toda arte nova pelo `tools/grok.mjs` com o bloco de estilo do `docs/GDD.md`; conferir a olho antes de usar.
  Processar com `node tools/arte.mjs` (contorno e escala dos quadros das pessoas saem de lá).
- Som: nenhum som pode ser uma fila de toques curtos ("catraca"). Engolir passa pelo combo (`src/som/combo.js`):
  no máximo 8 notas por segundo, o que cai junto vira acorde, 6 vozes no máximo, ataque de 8 ms ou mais, sem ruído
  junto do acerto. Os testes em `test/vida.test.js` e `test/v030.test.js` barram.
- Não fazer commit sem o usuário pedir.
- Registrar atividade no cofre: linha em `Atividades/AAAA-MM-DD.md` e histórico em `Jogos/gulp-hole-io.md`.

## Notas do jogo

- Nome de trabalho "Gulp Hole.io" trocado por **Pothole Party.io** (colisão com "Gulp" e "Gulpit", ver `docs/GDD.md`).
  A pasta, o slug dos zips e o prefixo `gulphole.` continuam `gulp-hole-io`.
- 3D com three.js r187 (`vendor/three`, importmap no `index.html`). Peças em billboard num atlas único
  (`src/render/`), prédios em caixas instanciadas com fachada; o chão descarta os fragmentos dentro dos buracos
  (é isso que faz o objeto caindo só aparecer dentro da boca).
- Parâmetros próprios só em localhost: `?mapa=cidade|praia|doceria`, `?modo=classico|solo|batalha`, `?rodada=N`
  (simula N rodadas já jogadas), `?tamanho=R` (raio inicial do jogador), `?foco=N` (a câmera segue o bot N).
- Quinto alvo **Y8** (do kit, 2026-11-20): `appId`/`gameId` em `package.json` → `kit.ids.y8` (preenchidos em 2026-11-21:
  jogo `pothole_party_io`, gameId 294589; sem eles o zip sai `-sem-id`). Na Y8 o intervalo só sai no clique do "Jogar" entre rodadas, com 180 s entre um e
  outro, e perder o foco pausa (`portal.intervaloSoNoClique`, `portal.pausaNoBlur`).
- **v0.2.0 (2026-11-20), cidade viva**: pessoas animadas (9 quadros cada, `vida-*` em `arte/bruto/`, feitas por
  `editar` a partir do boneco base em `arte/refs/`), carros 3D, mais prédios e marcos, chão e telhados desenhados no
  código, queda com física e buraco com borda grossa, poeira, pedrinhas e tremor. Mapas maiores (Clássico 120, Batalha
  84). Ver a seção "Versão 0.2.0" do `docs/GDD.md`.
- **v0.3.0 (2026-11-20)**: crescimento com mola, rachaduras, lascas, onda no chão e câmera afastando; ~3200 peças
  em cachos e reabastecimento contínuo; combo de sons por material na pentatônica; prédio que tomba e se parte em
  andares, telhado, entulho e cacos; peça um pouco grande demais racha e cede; bots com personalidade. Ver a seção
  "Versão 0.3.0" do `docs/GDD.md`.
- **v0.3.1 (2026-11-21)**, bug "da Doceria em diante os bots param e o mapa fica menor": a cena escondia só os buracos
  da rodada, e os que sobravam de uma rodada com mais bots ficavam congelados (Solo, Batalha); bot pequeno seguia carro
  sem alcançar, alternava caça e cacho, cruzava o mapa atrás do gigante e parava no alvo da borda. Solo agora 66 e
  2:30, aviso que explica Solo e Batalha, mureta na borda. Ver "Versão 0.3.1" no `docs/GDD.md` e `test/v031.test.js`.
