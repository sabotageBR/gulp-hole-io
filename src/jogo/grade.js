// Grade espacial simples (celulas quadradas) para achar as pecas perto de um buraco sem varrer o mapa
// inteiro. Logica pura, ASCII.

/**
 * @param {number} lado tamanho do mapa (quadrado centrado na origem)
 * @param {number} [cel] lado da celula
 */
export function criarGrade(lado, cel = 4) {
  const n = Math.ceil(lado / cel) + 2;
  const meio = lado / 2 + cel;
  /** @type {Set<number>[]} */
  const celulas = Array.from({ length: n * n }, () => new Set());
  const ix = (/** @type {number} */ v) => Math.max(0, Math.min(n - 1, Math.floor((v + meio) / cel)));
  return {
    n,
    cel,
    /** @param {number} id @param {number} x @param {number} z */
    por(id, x, z) {
      const k = ix(z) * n + ix(x);
      celulas[k].add(id);
      return k;
    },
    /** @param {number} id @param {number} k */
    tirar(id, k) {
      if (k >= 0) celulas[k].delete(id);
    },
    /** Indice da celula de um ponto. @param {number} x @param {number} z */
    chave(x, z) {
      return ix(z) * n + ix(x);
    },
    /**
     * Chama f(id) para cada peca nas celulas que tocam o quadrado (x +- r, z +- r).
     * @param {number} x @param {number} z @param {number} r @param {(id: number) => void} f
     */
    perto(x, z, r, f) {
      const a = ix(x - r);
      const b = ix(x + r);
      const c = ix(z - r);
      const d = ix(z + r);
      for (let j = c; j <= d; j++) for (let i = a; i <= b; i++) for (const id of celulas[j * n + i]) f(id);
    },
  };
}
