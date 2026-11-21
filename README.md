# Kit multiportal (Poki, CrazyGames e californiagames.io)

Base que todo jogo novo do estúdio copia (criado em 2026-11-20 para a leva de 8 jogos). Um código só gera as
quatro builds: **Poki**, **CrazyGames Full Launch**, **CrazyGames Basic Launch** (sem anúncios) e
**californiagames.io**. O jogo-casca (bolhas para tocar) mostra o ciclo completo e passou em tudo:
`npm test` (21 testes), `verificar-build` nos 4 alvos e `provar.mjs` 9/9 no desktop e no celular.

Estilo da casa: HTML e ES modules sem bundler, Canvas 2D (ou three.js vendorizado), WebAudio sintetizado, código e
comentários em português, comentários em ASCII no núcleo, JSDoc em vez de tipos. Node 22+, Chrome em
`/Applications`, `ffmpeg` e `cwebp`.

## Começar um jogo

```bash
cd /Users/evandromoura/git/em_tech/jogos
rsync -a --exclude dist --exclude .tmp --exclude node_modules distribuicao/kit/ <slug>/
cd <slug> && git init -q
```

Depois, no jogo novo:

1. `package.json`: `name` = slug, `version` = `0.1.0`, `description`, `config.porta` (a porta do jogo).
2. `src/main.js`: prefixo do armazenamento `'casca.'` → `'<slugsemhifen>.'` (todos os jogos do californiagames.io
   dividem a mesma origem), troca a parte "jogo" (estado, passo, desenho, entrada).
3. Apagar a casca: `src/jogo/casca.js`, `src/som/sons.js` (trocar pelos do jogo), `roteiro-modelo.mjs` (vira o
   roteiro da prova, ver abaixo). Textos em `src/i18n/textos.js` (pt, en, es; inglês obrigatório).
4. Apagar o que não usa de `vendor/` (`three/` nos jogos 2D, `planck/` sem física), e as linhas do `LICENCAS.txt`.
5. `CLAUDE.md` a partir de `MODELO-CLAUDE.md`.

## O que tem aqui

| Caminho | Para quê |
|---|---|
| `src/core/plataforma.js` | Única porta para o portal. No fonte reexporta `portais/californiagames.js`; o empacotar troca por alvo |
| `src/core/portais/` | `fila-sdk.js` (prazos, fila até o init, anúncio que nunca responde), `poki.js`, `crazygames.js` (Basic Launch, data module, adblock), `californiagames.js` (sinais antes do init, progresso limitado, rewarded em objeto) |
| `src/core/armazenamento.js` | localStorage com prefixo e reserva em memória, mais a nuvem do portal (`usarFonte(await portal.fonteDados())`) |
| `src/core/telemetria.js` | Eventos padrão do estúdio: `level/N/start|complete|fail`, `game/toque|mouse`, `tempo/min-N`, `ajuda/<fase>` |
| `src/core/{audio,laco,entrada,haptico,rng,depuracao}.js` | Do solitaire-soccer: WebAudio com mudo de anúncio/portal/jogador, passo fixo 1/60 s (independe do Hz do monitor, regra da CrazyGames), Pointer Events sem rolar a página, vibração, RNG com semente, parâmetros de teste só em localhost |
| `src/ui/kit.js` + `kit.css` | Mão-guia (toque e arrasto), festa curta sem tela de "fase concluída", botão premiado 🎬 (roxo, nunca verde) |
| `src/main.js` | O ciclo do portal comentado em 8 passos. **Copie a ordem como está** |
| `vendor/three/` (r187) e `vendor/planck/` (1.5.0) | MIT, só se o jogo usar |
| `tools/` | Servidor, empacotador, verificador, Grok, sprites, capas, gravação, vídeos e prints (abaixo) |
| `test/` | `estilo.test.js` (fronteiras do código), `portais.test.js` (os 3 adaptadores com SDK falso), `armazenamento.test.js` |

### Regras que os testes vigiam

- `src/jogo/` é puro: sem DOM, sem relógio, sem `Math.random` (só `core/rng.js`), ASCII; pode importar `vendor/planck`.
- Só `src/main.js` importa a plataforma; `portal.gameplayStart()` aparece uma vez, dentro de `jogadorAgiu()`.
- Só `src/core/armazenamento.js` toca o localStorage. Sem `console.log`, sem URL absoluta, sem Google Fonts/CDN.
- Nome de portal (poki, crazygames, californiagames) só em `src/core/portais/` e `src/core/plataforma.js`.
- `index.html`: SDK relativa `/sdk/v1/plataforma-sdk.js` no `<head>`, `viewport-fit=cover`, módulo do jogo no fim do body.

### Jogo 3D (three.js)

No `<head>`, depois da tag da SDK:

```html
<script type="importmap">{ "imports": { "three": "./vendor/three/three.module.js", "three/addons/": "./vendor/three/addons/" } }</script>
```

No `?filme` (gravação de vídeo), crie o `WebGLRenderer` com `preserveDrawingBuffer: true`. Sem nada pesado antes do
`portal.init()`: o handshake do californiagames.io dura 1,5 s. Use `portal.gameLoadingProgress(f)` durante a carga.

## Ciclo do portal (resumo do `src/main.js`)

1. Ganchos antes do init: `onAdStart` cala o áudio e congela o laço; `onAdEnd` devolve; `onMudoPlataforma`;
   `onPausaPlataforma`; `onSemAnuncios` esconde os botões de vídeo.
2. `portal.init()` primeiro. Arte com `gameLoadingProgress`. O laço só começa depois do init.
3. Idioma: `portal.idioma` (vazio na Poki: vale o navegador). Progresso da nuvem: `armazem.usarFonte(await portal.fonteDados(), [...chaves])`.
4. `gameLoadingFinished` no primeiro quadro. `gameplayStart` **só** no gesto real (`jogadorAgiu`).
5. `commercialBreak` **só** em pausa natural (troca de fase, fim de rodada, voltar de um menu) e só a partir da
   fase 6 ou ~4 min de jogo. Nunca em botão de navegação, nunca por relógio próprio. O portal limita a frequência.
6. Vídeo premiado só por escolha, fora da tela de jogo ativo (regra da CrazyGames), com opção grátis do mesmo tamanho
   ou maior ao lado; prêmio só com `true`; esconder quando `!portal.temVideo`.
7. ESC, espaço ou P pausam; aba oculta pausa; `portal.festa()` nos marcos (recorde, chefe).

## Arte com o Grok

`node tools/grok.mjs gerar <id> <1:1|16:9|9:16> "<prompt>"`, `editar <id> <ref.jpg[,ref2]> "<prompt>" [aspecto]`
e `lote <pedidos.json> [--paralelo=2]`. Saída em `arte/bruto/<id>.jpg` (fora do build), prompt em `docs/autoria.md`.
Uma geração leva ~30 s. **Fila global**: no máximo 2 gerações ao mesmo tempo entre todos os jogos
(`~/.cache/grok-fila`), então peça em lote e trabalhe no código enquanto espera.

- **Arte-chave primeiro.** 3 opções da cena principal; escolher (leitura pequena, contraste, nada de texto ou logo
  inventado) e registrar o motivo em `docs/autoria.md`. Todo o resto sai por `editar` com a escolhida como
  referência, mais o mesmo bloco de estilo no fim de todo prompt ("bíblia de arte" no `docs/GDD.md`). É isso que
  mantém o jogo com cara de um artista só, e não de "arte de IA" (a Poki já recusou jogos do estúdio por isso).
- **Sprites transparentes:** pedir `isolated on a perfectly flat solid magenta (#FF00FF) background, no shadow, no
  gradient, no ground, no text`. Vários itens numa chamada: `a 3x3 grid of 9 separate ..., evenly spaced, wide empty
  space between them`. Objeto rosa ou roxo: fundo verde `#00FF00` em vez de magenta.
- **Recorte:** `node tools/sprite.mjs recortar arte/bruto/x.jpg src/arte/x/ --separar --nome=x --largura=256`
  (fundo medido na borda, preenchimento a partir da borda, mistura desfeita no contorno, um arquivo por objeto na
  ordem de leitura). Saída `.webp` quando o destino termina em `.webp`.
- **Texturas:** `sprite.mjs costurar arte/bruto/t.jpg src/arte/t.webp --lado=512` (sem emenda).
- **Conferir a olho:** `sprite.mjs folha src/arte/x/ .tmp/folha.png` e abrir a imagem. Procure texto, letras, logos,
  "$", marca d'água, dedos e olhos errados. Refazer custa uma chamada; publicar com defeito custa a aprovação.
- **Orçamento:** ~60 chamadas por jogo. Grades economizam muito. Login do Grok vence a cada 7 dias (`grok login`,
  feito pelo usuário): se a ferramenta disser "login do Grok vencido", pare a arte, siga no código e avise.

## Distribuição (todas as artes, os 3 portais)

| Passo | Comando | Saída |
|---|---|---|
| Builds | `npm run empacotar` (testes + 4 alvos) | `dist/<slug>-<alvo>-<versao>.zip` e cópia em `../distribuicao/<slug>/{poki,crazygames,californiagames}/build/` |
| Conferir build | `npm run verificar` | quadros da Poki (640×360, 836×470, 1031×580), retrato, SDK bloqueado, localStorage quebrado, sem pedido externo |
| Prova California | de `jogos/distribuicao`: `node ferramentas/provar.mjs <slug>` (e `--mobile --escala=2 --lang=en`) | 9/9 com o roteiro em `distribuicao/<slug>/californiagames/roteiro.mjs` (copie `roteiro-modelo.mjs` e adapte) |
| Capas | `arte/capas.json` + `node tools/capas.mjs` | Poki `thumb-1256/628.png` (sem texto, contraste com `#83FFE7`); CrazyGames `capa-1920x1080/800x1200/800x800.png`; California `thumb.png`, `capa.png`, `capa-mobile.png` |
| Gameplay | `node tools/gravar.mjs --tamanho=1280x720 --params="auto&fase=8" --saida=.tmp/gameplay-16x9.mp4` e `--tamanho=540x960 --escala=2 ... --saida=.tmp/gameplay-9x16.mp4` | quadros do próprio jogo (`?filme`), sem relógio real |
| Vídeos | `node tools/videos.mjs` | CrazyGames `video-1920x1080.mp4` e `video-1080x1620.mp4` (15–20 s, abrem na capa), Poki `thumb-animada.mp4`, California `preview.mp4` |
| Prints | `arte/prints.json` + `node tools/prints.mjs` | California `screenshot-01..NN.png` (3–10), Poki as 3 primeiras |
| Ficha | `distribuicao/<slug>/californiagames/ficha.json` (formato de `distribuicao/magic-block/californiagames/ficha.json`, slugs em inglês) e `distribuicao/<slug>/crazygames/ficha.md` (inglês) | depois `node ferramentas/conferir.mjs <slug>` |

## Retenção (do cofre, `Conhecimento/Retenção.md`)

- Primeira carga direto no jogo, sem menu nem splash. Ensinar com mão-guia; texto curto só nas 3 primeiras fases.
  Nada de derrota nos ~3 primeiros minutos. Ajuda automática quando o jogador não progride (não só quando fica parado).
  Um "uau" nos primeiros 15 s.
- Fluxo contínuo: festa de 1,6–2,5 s sem overlay e a próxima fase já começa. Novidade a cada ~2 min, a primeira antes
  do minuto 2. Meta longa visível (coleção, desbloqueio). Nenhuma fase abaixo de ~82% de conclusão.
- Volta (D1): progresso salvo; gancho diário leve, sem FOMO, sem energia, sem segunda moeda.
- Metas: Poki ≥ 5 min médios (puzzle ~7 min), CrazyGames ≥ 10 min e D1 10–15%, California ≥ 90 s.
