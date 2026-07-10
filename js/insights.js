// Motor de Descobertas: procura padrões no histórico e os descreve em
// linguagem de tendência (nunca de certeza médica), sempre informando a base
// de dados usada. Nada daqui é enviado para fora do aparelho.
//
// v2: comparações fator×sintoma (comida/medicamento × dor) usam uma tabela
// 2x2 + teste exato de Fisher como filtro estatístico (não exibido ao
// usuário) e correção de Benjamini-Hochberg para comparações múltiplas,
// testando também a janela "dia seguinte" além do mesmo dia. Comparações de
// médias contínuas (humor, energia, estresse) continuam por diferença de
// médias — não é um teste categórico, então não usamos Fisher nelas.

import { getAllCheckIns, getAllTags, getAllMomentos, getAllCiclo } from "./db.js";
import { buildDailySeries, avg } from "./aggregate.js";
import { weekdayLabel, addDaysToKey } from "./utils/date.js";
import { tabela2x2, fisherExato, benjaminiHochberg } from "./utils/stats.js";

export const MIN_DAYS = 5;
const MAX_INSIGHTS = 8;
const FISHER_P_MAX = 0.05;
const MIN_DIFF_PROPORCAO = 0.25;

const PERIODO_LABEL = { matinal: "ao acordar", vespertino: "durante o dia", noturno: "à noite", momento: "registro avulso" };

function topEntry(counts) {
  const entries = Object.entries(counts);
  if (entries.length === 0) return null;
  return entries.sort((a, b) => b[1] - a[1])[0];
}

/** "recente" se a maioria das ocorrências do fator está nos últimos 14 dias
 * do período analisado e ainda não há histórico anterior suficiente;
 * "consistente" se as ocorrências se espalham pelo período todo. */
function stabilityTag(dateSet, allDatesSorted) {
  const dates = [...dateSet].sort();
  if (dates.length < 6 || allDatesSorted.length < 14) return null;
  const last14Start = allDatesSorted[Math.max(0, allDatesSorted.length - 14)];
  const recentCount = dates.filter((d) => d >= last14Start).length;
  const olderCount = dates.length - recentCount;
  if (recentCount >= dates.length * 0.5 && olderCount < MIN_DAYS) return "recente";
  return "consistente";
}

function painFrequencyInsights(days, tagById) {
  const byTag = new Map();
  days.forEach((d) => {
    d.painEntries.forEach((p) => {
      if (!p.tagId) return;
      if (!byTag.has(p.tagId)) byTag.set(p.tagId, { count: 0, tipos: {}, weekdays: {} });
      const rec = byTag.get(p.tagId);
      rec.count += 1;
      rec.tipos[p.tipo] = (rec.tipos[p.tipo] || 0) + 1;
      rec.weekdays[weekdayLabel(d.date)] = (rec.weekdays[weekdayLabel(d.date)] || 0) + 1;
    });
  });

  const results = [];
  for (const [tagId, rec] of byTag) {
    if (rec.count < MIN_DAYS) continue;
    const nome = tagById.get(tagId)?.nome || "essa dor";
    const topTipo = topEntry(rec.tipos);
    const periodo = topTipo ? PERIODO_LABEL[topTipo[0]] : null;
    let text = `"${nome}" é uma das dores que mais aparece no seu registro (${rec.count} vezes)`;
    if (periodo) text += `, com mais frequência ${periodo}`;
    text += ".";
    results.push({
      id: `dor-freq-${tagId}`,
      category: "dor-frequente",
      text,
      base: `baseado em ${rec.count} registros dessa dor`,
      strength: Math.min(1, rec.count / 20),
    });
  }
  return results;
}

/**
 * Compara dias com um fator presente (comida ou medicamento) contra dias
 * sem ele, testando a janela "mesmo dia" e "dia seguinte" para cada par
 * fator×sintoma, e usa Fisher exato + Benjamini-Hochberg como filtro
 * estatístico (nunca exibido ao usuário — só decide o que aparece).
 */
function factorSymptomInsights(days, tagById, getFactorItems, factorCategoryLabel, { reverseCausality = false } = {}) {
  const allDates = days.map((d) => d.date).sort();
  const dateSet = new Set(allDates);

  const factorDays = new Map();
  const symptomDays = new Map();
  days.forEach((d) => {
    getFactorItems(d).forEach((item) => {
      if (!item.tagId) return;
      if (!factorDays.has(item.tagId)) factorDays.set(item.tagId, new Set());
      factorDays.get(item.tagId).add(d.date);
    });
    d.painEntries.forEach((p) => {
      if (!p.tagId) return;
      if (!symptomDays.has(p.tagId)) symptomDays.set(p.tagId, new Set());
      symptomDays.get(p.tagId).add(d.date);
    });
  });

  function shiftDates(dates, offsetDays) {
    if (offsetDays === 0) return dates;
    const out = new Set();
    dates.forEach((d) => {
      const shifted = addDaysToKey(d, offsetDays);
      if (dateSet.has(shifted)) out.add(shifted);
    });
    return out;
  }

  const candidates = [];
  for (const [factorId, rawFactorDates] of factorDays) {
    if (rawFactorDates.size < MIN_DAYS) continue;
    for (const [symptomId, symptomDateSet] of symptomDays) {
      let melhor = null;
      for (const [janela, offset] of [["mesmo dia", 0], ["dia seguinte", 1]]) {
        const comFator = shiftDates(rawFactorDates, offset);
        if (comFator.size < MIN_DAYS) continue;
        const semFatorCount = allDates.length - comFator.size;
        if (semFatorCount < MIN_DAYS) continue;

        const { a, b, c, d } = tabela2x2(comFator, symptomDateSet, allDates);
        if (a + b === 0 || c + d === 0) continue;
        const pctCom = a / (a + b);
        const pctSem = c / (c + d);
        const diff = pctCom - pctSem;
        if (diff <= 0) continue;
        if (!melhor || diff > melhor.diff) {
          melhor = { janela, comFator, a, b, c, d, pctCom, pctSem, diff, p: fisherExato(a, b, c, d) };
        }
      }
      if (!melhor || melhor.diff < MIN_DIFF_PROPORCAO) continue;
      candidates.push({ factorId, symptomId, ...melhor });
    }
  }

  const passBH = benjaminiHochberg(candidates.map((c) => c.p), 0.05);

  const results = [];
  candidates.forEach((c, i) => {
    if (!passBH[i] || c.p >= FISHER_P_MAX) return;
    const factorName = tagById.get(c.factorId)?.nome || "esse item";
    const symptomName = tagById.get(c.symptomId)?.nome || "esse sintoma";
    const estabilidade = stabilityTag(c.comFator, allDates);
    const estabilidadeTexto = estabilidade ? ` (padrão ${estabilidade})` : "";

    let text;
    if (reverseCausality) {
      text = `Você costuma registrar "${factorName}" nos dias com "${symptomName}" (${Math.round(c.pctCom * 100)}% dos dias com "${symptomName}", contra ${Math.round(c.pctSem * 100)}% nos outros)${estabilidadeTexto} — padrão esperado quando o remédio é tomado por causa do sintoma, não sinal de que ele o cause.`;
    } else if (c.janela === "dia seguinte") {
      text = `Em ${Math.round(c.pctCom * 100)}% dos dias seguintes a você registrar "${factorName}", também registrou "${symptomName}", contra ${Math.round(c.pctSem * 100)}% nos outros dias${estabilidadeTexto}.`;
    } else {
      text = `Em ${Math.round(c.pctCom * 100)}% dos dias em que você registrou "${factorName}", também registrou "${symptomName}" no mesmo dia, contra ${Math.round(c.pctSem * 100)}% nos outros dias${estabilidadeTexto}.`;
    }

    results.push({
      id: `${factorCategoryLabel}-dor-${c.factorId}-${c.symptomId}`,
      category: `${factorCategoryLabel}-dor`,
      text,
      base: `baseado em ${c.comFator.size} dias com "${factorName}"${c.janela === "dia seguinte" ? ", considerando o dia seguinte" : ""}`,
      strength: c.diff,
    });
  });
  return results;
}

function moodByTagInsights(days, tagById, getIds, categoryLabel) {
  const allDates = days.map((d) => d.date).sort();
  const tagDaySets = new Map();
  days.forEach((d) => {
    (getIds(d) || []).forEach((tagId) => {
      if (!tagDaySets.has(tagId)) tagDaySets.set(tagId, new Set());
      tagDaySets.get(tagId).add(d.date);
    });
  });

  const daysWithHumor = days.filter((d) => d.humor !== null);
  const results = [];
  for (const [tagId, dateSet] of tagDaySets) {
    if (dateSet.size < MIN_DAYS) continue;
    const withHumor = daysWithHumor.filter((d) => dateSet.has(d.date)).map((d) => d.humor);
    const withoutHumor = daysWithHumor.filter((d) => !dateSet.has(d.date)).map((d) => d.humor);
    if (withHumor.length < MIN_DAYS || withoutHumor.length < MIN_DAYS) continue;

    const avgWith = avg(withHumor);
    const avgWithout = avg(withoutHumor);
    const diff = avgWith - avgWithout;
    if (Math.abs(diff) < 0.4) continue;

    const nome = tagById.get(tagId)?.nome || "isso";
    const direcao = diff > 0 ? "melhor" : "pior";
    const estabilidade = stabilityTag(dateSet, allDates);
    results.push({
      id: `${categoryLabel}-humor-${tagId}`,
      category: `${categoryLabel}-humor`,
      text: `Seu humor parece ${direcao} em dias com "${nome}" (média ${avgWith.toFixed(1)} contra ${avgWithout.toFixed(1)} em uma escala de 1 a 5)${estabilidade ? ` (padrão ${estabilidade})` : ""}.`,
      base: `baseado em ${withHumor.length} dias com "${nome}"`,
      strength: Math.abs(diff) / 4,
    });
  }
  return results;
}

function sleepNextDayInsights(days) {
  const paired = days.filter((d) => d.sono !== null && d.notaGeral !== null);
  const good = paired.filter((d) => d.sono >= 4);
  const bad = paired.filter((d) => d.sono <= 2);
  if (good.length < MIN_DAYS || bad.length < MIN_DAYS) return [];

  const avgGood = avg(good.map((d) => d.notaGeral));
  const avgBad = avg(bad.map((d) => d.notaGeral));
  const diff = avgGood - avgBad;
  if (Math.abs(diff) < 0.3) return [];

  return [{
    id: "sono-nota-dia",
    category: "sono-dia",
    text: `Em dias que seguem uma noite de sono melhor avaliada, sua nota geral do dia tende a ser maior (média ${avgGood.toFixed(1)}) do que em dias após noites mal avaliadas (média ${avgBad.toFixed(1)}).`,
    base: `baseado em ${good.length} dias com sono bom e ${bad.length} dias com sono ruim`,
    strength: Math.abs(diff) / 4,
  }];
}

function activityInsights(days, tagById) {
  const allDates = days.map((d) => d.date).sort();
  const tagDaySets = new Map();
  days.forEach((d) => {
    (d.atividades || []).forEach((tagId) => {
      if (!tagDaySets.has(tagId)) tagDaySets.set(tagId, new Set());
      tagDaySets.get(tagId).add(d.date);
    });
  });

  function compareMetric(metricKey, metricLabel) {
    const out = [];
    for (const [tagId, dateSet] of tagDaySets) {
      if (dateSet.size < MIN_DAYS) continue;
      const withVals = days.filter((d) => dateSet.has(d.date) && d[metricKey] !== null).map((d) => d[metricKey]);
      const withoutVals = days.filter((d) => !dateSet.has(d.date) && d[metricKey] !== null).map((d) => d[metricKey]);
      if (withVals.length < MIN_DAYS || withoutVals.length < MIN_DAYS) continue;

      const avgWith = avg(withVals);
      const avgWithout = avg(withoutVals);
      const diff = avgWith - avgWithout;
      if (Math.abs(diff) < 0.4) continue;

      const nome = tagById.get(tagId)?.nome || "essa atividade";
      const direcao = diff > 0 ? "maior" : "menor";
      const estabilidade = stabilityTag(dateSet, allDates);
      out.push({
        id: `atividade-${metricKey}-${tagId}`,
        category: `atividade-${metricKey}`,
        text: `Seu(sua) ${metricLabel} tende a ser ${direcao} em dias com "${nome}" (média ${avgWith.toFixed(1)} contra ${avgWithout.toFixed(1)})${estabilidade ? ` (padrão ${estabilidade})` : ""}.`,
        base: `baseado em ${withVals.length} dias com "${nome}"`,
        strength: Math.abs(diff) / 4,
      });
    }
    return out;
  }

  return [...compareMetric("energia", "energia"), ...compareMetric("estresse", "nível de estresse")];
}

/** startDate/endDate (YYYY-MM-DD, inclusive) restringem a análise a um
 * período — usado pelo Modo Consulta. Sem eles, usa todo o histórico. */
export async function generateInsights({ startDate, endDate } = {}) {
  const [allCheckins, allTags, allMomentos, allCiclo] = await Promise.all([
    getAllCheckIns(), getAllTags(), getAllMomentos(), getAllCiclo(),
  ]);
  const series = buildDailySeries(allCheckins, allMomentos, allCiclo);
  let days = [...series.values()];
  if (startDate) days = days.filter((d) => d.date >= startDate);
  if (endDate) days = days.filter((d) => d.date <= endDate);
  const tagById = new Map(allTags.map((t) => [t.id, t]));

  const totalDaysComRegistro = days.filter((d) => d.temAlgumRegistro).length;

  const insights = [
    ...painFrequencyInsights(days, tagById),
    ...factorSymptomInsights(days, tagById, (d) => d.comidas, "comida"),
    ...factorSymptomInsights(days, tagById, (d) => d.medicamentos || [], "medicamento", { reverseCausality: true }),
    ...moodByTagInsights(days, tagById, (d) => d.lugares, "lugar"),
    ...moodByTagInsights(days, tagById, (d) => d.pessoas, "pessoa"),
    ...sleepNextDayInsights(days),
    ...activityInsights(days, tagById),
  ];

  insights.sort((a, b) => b.strength - a.strength);

  return { insights: insights.slice(0, MAX_INSIGHTS), totalDaysComRegistro };
}

export function strengthLabel(strength) {
  if (strength >= 0.5) return "Padrão forte";
  if (strength >= 0.3) return "Padrão moderado";
  return "Padrão leve";
}
