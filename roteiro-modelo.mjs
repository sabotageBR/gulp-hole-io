// [kit multiportal] Roteiro da prova do californiagames.io (ferramentas/provar.mjs) para o jogo-casca.
// Cada jogo copia para ../distribuicao/<slug>/californiagames/roteiro.mjs e troca os ganchos (__jogo).
// Cobre os itens automaticos do QA: gameplayStart so no gesto real, intervalo comercial na pausa natural
// (com gameplayStop antes e o gameplay de volta no gesto seguinte), recompensado em forma de objeto,
// pause/resume e mute/unmute do portal.
export default async (ctx) => {
  const { pagina, esperar } = ctx;
  const toque = ctx.altura > ctx.largura;
  const conferir = (cond, msg) => { if (!cond) throw new Error(msg); };
  const v = () => ctx.noJogo(() => {
    const g = globalThis.__jogo;
    return { lang: g.lang, jogou: g.jogou, emAnuncio: g.emAnuncio, menu: g.menuAberto, fase: g.E.fase, pontos: g.E.pontos,
      t: g.E.t, pausa: g.E.pausaPortal, mudo: g.audio.mudoPlataforma, mudoJogador: g.audio.mudo };
  });
  const clicarEm = async (x, y) => { if (toque) await pagina.touchscreen.tap(x, y); else await pagina.mouse.click(x, y); };
  const centro = (sel) => ctx.noJogo((s) => { const r = document.querySelector(s).getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }, sel);
  const apertar = async (sel) => { const p = await centro(sel); await clicarEm(p.x, p.y); };
  /** toque REAL na bolha da vez */
  const tocarBolha = async () => {
    const p = await ctx.noJogo(() => globalThis.__jogo.alvo());
    conferir(p, 'sem bolha para tocar');
    await clicarEm(p.x, p.y);
  };
  const intervaloEVolta = async (metodo, antes) => {
    await ctx.esperarEvento(metodo, { tipo: 'chamada', depoisDe: antes - 1, timeout: 20000 });
    await esperar(250);
    conferir((await v()).emAnuncio, 'o jogo nao congelou no anuncio');
    await ctx.esperarEvento(metodo, { tipo: 'resposta', depoisDe: antes - 1 });
    await esperar(500);
    conferir(!(await v()).emAnuncio, 'o jogo nao voltou do anuncio');
  };

  const esperado = { 'pt-BR': 'pt', en: 'en', es: 'es' }[ctx.idioma] || 'pt';
  conferir((await v()).lang === esperado, `o idioma nao veio do portal (${ctx.idioma})`);

  // 1) primeiro toque real: gameplayStart
  await tocarBolha();
  await ctx.esperarEvento('gameplayStart');
  await esperar(300);
  await ctx.foto('jogando');

  // 2) pausa natural depois da fase do primeiro intervalo: commercialBreak, e o toque seguinte volta ao jogo
  await ctx.noJogo(() => { globalThis.__jogo.E.fase = 6; globalThis.__jogo.completar(); });
  let antes = (await ctx.log()).length;
  await intervaloEVolta('commercialBreak', antes);
  await esperar(600);
  antes = (await ctx.log()).length;
  await tocarBolha();
  await ctx.esperarEvento('gameplayStart', { depoisDe: antes - 1 });
  await ctx.foto('depois-do-intervalo');

  // 3) recompensado pelo menu de pausa (fora da tela de jogo ativa), premio so com true
  await apertar('#btPausa');
  await esperar(300);
  conferir((await v()).menu, 'o menu de pausa nao abriu');
  const p0 = (await v()).pontos;
  antes = (await ctx.log()).length;
  await apertar('#btBonus');
  await intervaloEVolta('rewardedBreak', antes);
  conferir((await v()).pontos === p0 + 50, 'o premio nao veio');
  await tocarBolha();
  await esperar(400);

  // 4) pause/resume do portal congela e solta
  antes = (await ctx.log()).length;
  await ctx.sinal('pause');
  await esperar(300);
  const t0 = (await v()).t;
  await esperar(700);
  let e = await v();
  conferir(e.pausa && e.t === t0, `pause nao congelou: ${JSON.stringify(e)}`);
  await ctx.sinal('resume');
  await esperar(400);
  conferir((await v()).t > t0, 'resume nao soltou o jogo');

  // 5) mute/unmute do portal sem desfazer o mudo do jogador
  await ctx.sinal('mute');
  await esperar(200);
  conferir((await v()).mudo === true, 'mute nao calou');
  await ctx.sinal('unmute');
  await esperar(200);
  e = await v();
  conferir(e.mudo === false, 'unmute nao devolveu o som');
  await tocarBolha();
  await esperar(500);
  await ctx.foto('fim-do-roteiro');
};
