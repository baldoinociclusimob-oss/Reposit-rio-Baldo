// js/utils/stats.js
// Estatística mínima para o motor de Descobertas (v2) — sem dependências.
//
// Uso típico no insights.js:
//   const { a, b, c, d } = tabela2x2(diasComFator, diasComSintoma, todosOsDias);
//   const p = fisherExato(a, b, c, d);
//   ...coletar todos os p-valores do lote e filtrar com benjaminiHochberg().

// ---------------------------------------------------------------------------
// log(n!) com cache incremental — suficiente para centenas de dias de diário.
const LOG_FATORIAL = [0, 0];
function logFatorial(n) {
  for (let i = LOG_FATORIAL.length; i <= n; i++) {
    LOG_FATORIAL[i] = LOG_FATORIAL[i - 1] + Math.log(i);
  }
  return LOG_FATORIAL[n];
}

// log da probabilidade hipergeométrica de uma tabela 2x2 com margens fixas.
function logProbTabela(a, b, c, d) {
  return (
    logFatorial(a + b) +
    logFatorial(c + d) +
    logFatorial(a + c) +
    logFatorial(b + d) -
    logFatorial(a) -
    logFatorial(b) -
    logFatorial(c) -
    logFatorial(d) -
    logFatorial(a + b + c + d)
  );
}

/**
 * Monta a tabela 2x2 (dias) para um par fator × sintoma.
 * @param {Iterable<string>} diasComFator   datas 'YYYY-MM-DD' em que o fator ocorreu
 * @param {Iterable<string>} diasComSintoma datas em que o sintoma ocorreu
 * @param {Iterable<string>} universoDias   todas as datas consideradas na análise
 *   Dica p/ defasagem de 1 dia: desloque as datas do FATOR em +1 dia antes de chamar.
 * @returns {{a:number,b:number,c:number,d:number}}
 *   a: com fator e com sintoma | b: com fator, sem sintoma
 *   c: sem fator, com sintoma  | d: sem fator e sem sintoma
 */
export function tabela2x2(diasComFator, diasComSintoma, universoDias) {
  const F = new Set(diasComFator);
  const S = new Set(diasComSintoma);
  let a = 0, b = 0, c = 0, d = 0;
  for (const dia of universoDias) {
    const f = F.has(dia);
    const s = S.has(dia);
    if (f && s) a++;
    else if (f) b++;
    else if (s) c++;
    else d++;
  }
  return { a, b, c, d };
}

/**
 * Teste exato de Fisher (bicaudal) para uma tabela 2x2.
 * Retorna o p-valor (0..1). Quanto menor, menos provável que a diferença
 * observada entre "dias com fator" e "dias sem fator" seja acaso.
 * Não expor o p-valor na interface — usar apenas para filtrar/ranquear.
 */
export function fisherExato(a, b, c, d) {
  if ([a, b, c, d].some((n) => !Number.isInteger(n) || n < 0)) {
    throw new Error('fisherExato: a, b, c, d devem ser inteiros >= 0');
  }
  const linhaCom = a + b;   // total de dias com o fator
  const linhaSem = c + d;   // total de dias sem o fator
  const colSint = a + c;    // total de dias com o sintoma
  if (linhaCom === 0 || linhaSem === 0 || colSint === 0 || b + d === 0) {
    return 1; // sem variação em alguma margem, nada a testar
  }
  const logPObs = logProbTabela(a, b, c, d);
  const xMin = Math.max(0, colSint - linhaSem);
  const xMax = Math.min(colSint, linhaCom);
  const TOL = 1e-7; // tolerância numérica p/ igualdade em ponto flutuante
  let p = 0;
  for (let x = xMin; x <= xMax; x++) {
    const lp = logProbTabela(x, linhaCom - x, colSint - x, linhaSem - (colSint - x));
    if (lp <= logPObs + TOL) p += Math.exp(lp);
  }
  return Math.min(1, p);
}

/**
 * Correção de Benjamini–Hochberg para comparações múltiplas.
 * Quando o motor testa dezenas de pares fator×sintoma, alguns "padrões"
 * aparecem por puro acaso; este filtro controla a taxa de falsas descobertas.
 * @param {number[]} pValores p-valores do lote, na ordem original
 * @param {number}   q        taxa de falsas descobertas aceita (padrão 0.05)
 * @returns {boolean[]} true nas posições que sobrevivem ao filtro
 */
export function benjaminiHochberg(pValores, q = 0.05) {
  const m = pValores.length;
  if (m === 0) return [];
  const ordenado = pValores
    .map((p, i) => ({ p, i }))
    .sort((x, y) => x.p - y.p);
  let k = -1;
  for (let j = 0; j < m; j++) {
    if (ordenado[j].p <= ((j + 1) / m) * q) k = j;
  }
  const passa = new Array(m).fill(false);
  for (let j = 0; j <= k; j++) passa[ordenado[j].i] = true;
  return passa;
}

/**
 * Classifica a força de um padrão para exibição ("forte" | "moderado" | null).
 * Combina p-valor com tamanho de efeito (nunca só o p-valor).
 * @param {object} o
 * @param {number} o.p                 p-valor do Fisher
 * @param {number} [o.difProporcoes]   |prop. com fator − prop. sem fator| em 0..1
 * @param {number} [o.difMedias]       |média com − média sem| em escala 1–5
 */
export function forcaDoPadrao({ p, difProporcoes = 0, difMedias = 0 }) {
  const efeitoGrande = difProporcoes >= 0.4 || difMedias >= 1.2;
  const efeitoMinimo = difProporcoes >= 0.25 || difMedias >= 0.8;
  if (!efeitoMinimo) return null;
  if (p < 0.01 && efeitoGrande) return 'forte';
  if (p < 0.05) return 'moderado';
  return null;
}
