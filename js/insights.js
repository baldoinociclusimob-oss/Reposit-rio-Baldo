// Motor de Descobertas: procura padrões simples no histórico e os descreve
// em linguagem de tendência (nunca de certeza médica), sempre informando a
// base de dados usada. Nada daqui é enviado para fora do aparelho.

import { getAllCheckIns, getAllTags, getAllMomentos, getAllCiclo } from "./db.js";
import { buildDailySeries, avg } from "./aggregate.js";
import { weekdayLabel } from "./utils/date.js";

export const MIN_DAYS = 5;

const PERIODO_LABEL = { matinal: "ao acordar", vespertino: "durante o dia", noturno: "à noite" };

function topEntry(counts) {
  const entries = Object.entries(counts);
  if (entries.length === 0) return null;
  return entries.sort((a, b) => b[1] - a[1])[0];
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

function foodSymptomInsights(days, tagById) {
  const foodDays = new Map();
  const painDays = new Map();
  const allDates = new Set(days.map((d) => d.date));

  days.forEach((d) => {
    d.comidas.forEach((c) => {
      if (!foodDays.has(c.tagId)) foodDays.set(c.tagId, new Set());
      foodDays.get(c.tagId).add(d.date);
    });
    d.painEntries.forEach((p) => {
      if (!p.tagId) return;
      if (!painDays.has(p.tagId)) painDays.set(p.tagId, new Set());
      painDays.get(p.tagId).add(d.date);
    });
  });

  const results = [];
  for (const [foodId, withFood] of foodDays) {
    if (withFood.size < MIN_DAYS) continue;
    const withoutFood = [...allDates].filter((d) => !withFood.has(d));
    if (withoutFood.length < MIN_DAYS) continue;

    for (const [painId, painSet] of painDays) {
      const withFoodAndPain = [...withFood].filter((d) => painSet.has(d)).length;
      const withoutFoodAndPain = withoutFood.filter((d) => painSet.has(d)).length;
      const pctWith = withFoodAndPain / withFood.size;
      const pctWithout = withoutFoodAndPain / withoutFood.length;
      const diff = pctWith - pctWithout;
      if (diff < 0.2) continue;

      const foodName = tagById.get(foodId)?.nome || "esse alimento";
      const painName = tagById.get(painId)?.nome || "essa dor";
      results.push({
        id: `comida-dor-${foodId}-${painId}`,
        category: "comida-dor",
        text: `Em ${Math.round(pctWith * 100)}% dos dias em que você comeu "${foodName}", também registrou "${painName}", contra ${Math.round(pctWithout * 100)}% nos outros dias.`,
        base: `baseado em ${withFood.size} dias com "${foodName}"`,
        strength: diff,
      });
    }
  }
  return results;
}

function moodByTagInsights(days, tagById, getIds, categoryLabel) {
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
    results.push({
      id: `${categoryLabel}-humor-${tagId}`,
      category: `${categoryLabel}-humor`,
      text: `Seu humor parece ${direcao} em dias com "${nome}" (média ${avgWith.toFixed(1)} contra ${avgWithout.toFixed(1)} em uma escala de 1 a 5).`,
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
      out.push({
        id: `atividade-${metricKey}-${tagId}`,
        category: `atividade-${metricKey}`,
        text: `Seu(sua) ${metricLabel} tende a ser ${direcao} em dias com "${nome}" (média ${avgWith.toFixed(1)} contra ${avgWithout.toFixed(1)}).`,
        base: `baseado em ${withVals.length} dias com "${nome}"`,
        strength: Math.abs(diff) / 4,
      });
    }
    return out;
  }

  return [...compareMetric("energia", "energia"), ...compareMetric("estresse", "nível de estresse")];
}

export async function generateInsights() {
  const [allCheckins, allTags, allMomentos, allCiclo] = await Promise.all([
    getAllCheckIns(), getAllTags(), getAllMomentos(), getAllCiclo(),
  ]);
  const series = buildDailySeries(allCheckins, allMomentos, allCiclo);
  const days = [...series.values()];
  const tagById = new Map(allTags.map((t) => [t.id, t]));

  const totalDaysComRegistro = days.filter((d) => d.temAlgumRegistro).length;

  const insights = [
    ...painFrequencyInsights(days, tagById),
    ...foodSymptomInsights(days, tagById),
    ...moodByTagInsights(days, tagById, (d) => d.lugares, "lugar"),
    ...moodByTagInsights(days, tagById, (d) => d.pessoas, "pessoa"),
    ...sleepNextDayInsights(days),
    ...activityInsights(days, tagById),
  ];

  insights.sort((a, b) => b.strength - a.strength);

  return { insights, totalDaysComRegistro };
}

export function strengthLabel(strength) {
  if (strength >= 0.5) return "Padrão forte";
  if (strength >= 0.3) return "Padrão moderado";
  return "Padrão leve";
}
