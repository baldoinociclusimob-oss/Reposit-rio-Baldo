// Agrega os registros brutos dos 3 check-ins de um dia em métricas prontas
// para gráficos (Tendências) e para o motor de correlações (Descobertas).

function avg(values) {
  const nums = values.filter((v) => typeof v === "number" && !Number.isNaN(v));
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

/** Agrupa uma lista plana de check-ins por data. */
export function groupByDate(checkins) {
  const byDate = new Map();
  checkins.forEach((c) => {
    if (!byDate.has(c.date)) byDate.set(c.date, {});
    byDate.get(c.date)[c.tipo] = c;
  });
  return byDate;
}

/** Métricas de um único dia a partir de {matinal, vespertino, noturno} (cada um opcional)
 * mais os registros espontâneos ("momentos") daquele dia, que entram nas mesmas
 * métricas (humor, dores, comidas, atividades) para o motor de Descobertas enxergar tudo junto. */
export function dailyMetrics(date, dayRecords = {}, momentosDoDia = []) {
  const { matinal, vespertino, noturno } = dayRecords;

  const humor = avg([matinal?.humorAcordar, vespertino?.humor, noturno?.humor, ...momentosDoDia.map((m) => m.humor)]);
  const energia = avg([matinal?.energia, vespertino?.energia]);
  const sono = typeof matinal?.sonoQualidade === "number" ? matinal.sonoQualidade : null;
  const horasDormidas = typeof matinal?.horasDormidas === "number" ? matinal.horasDormidas : null;
  const estresse = typeof noturno?.estresse === "number" ? noturno.estresse : null;
  const notaGeral = typeof noturno?.notaGeral === "number" ? noturno.notaGeral : null;

  const painEntries = [
    ...(matinal?.doresAcordar || []).map((p) => ({ ...p, tipo: "matinal" })),
    ...(vespertino?.dores || []).map((p) => ({ ...p, tipo: "vespertino" })),
    ...(noturno?.dores || []).map((p) => ({ ...p, tipo: "noturno" })),
    ...momentosDoDia.flatMap((m) => (m.dores || []).map((p) => ({ ...p, tipo: "momento" }))),
  ];

  const comidas = [
    ...(vespertino?.cafeDaManha || []).map((tagId) => ({ tagId, refeicao: "cafe" })),
    ...(vespertino?.almoco || []).map((tagId) => ({ tagId, refeicao: "almoco" })),
    ...(noturno?.jantar || []).map((tagId) => ({ tagId, refeicao: "jantar" })),
    ...momentosDoDia.flatMap((m) => (m.comidas || []).map((tagId) => ({ tagId, refeicao: "momento" }))),
  ];

  const lugares = vespertino?.lugares || [];
  const atividades = [...(vespertino?.atividades || []), ...momentosDoDia.flatMap((m) => m.atividades || [])];
  const pessoas = vespertino?.pessoas || [];

  return {
    date,
    humor, energia, sono, estresse, notaGeral, horasDormidas,
    painEntries, comidas, lugares, atividades, pessoas,
    temAlgumRegistro: Boolean(matinal || vespertino || noturno || momentosDoDia.length),
  };
}

/** Constrói o mapa date -> métricas para todo o histórico. */
export function buildDailySeries(allCheckins, allMomentos = []) {
  const byDate = groupByDate(allCheckins);
  const momentosByDate = new Map();
  allMomentos.forEach((m) => {
    if (!momentosByDate.has(m.date)) momentosByDate.set(m.date, []);
    momentosByDate.get(m.date).push(m);
  });

  const allDates = new Set([...byDate.keys(), ...momentosByDate.keys()]);
  const series = new Map();
  allDates.forEach((date) => {
    series.set(date, dailyMetrics(date, byDate.get(date) || {}, momentosByDate.get(date) || []));
  });
  return series;
}

export { avg };

/** Agrega uma série diária (Map) em buckets semanais, na ordem de dayKeysOrdered. */
export function weeklyAggregate(series, dayKeysOrdered, startOfWeekFn) {
  const buckets = new Map();
  dayKeysOrdered.forEach((day) => {
    const wk = startOfWeekFn(day);
    if (!buckets.has(wk)) {
      buckets.set(wk, { weekStart: wk, humor: [], energia: [], sono: [], estresse: [], dores: 0 });
    }
    const m = series.get(day);
    if (!m) return;
    const b = buckets.get(wk);
    if (m.humor !== null) b.humor.push(m.humor);
    if (m.energia !== null) b.energia.push(m.energia);
    if (m.sono !== null) b.sono.push(m.sono);
    if (m.estresse !== null) b.estresse.push(m.estresse);
    b.dores += m.painEntries.length;
  });
  return [...buckets.values()].map((b) => ({
    weekStart: b.weekStart,
    humor: avg(b.humor),
    energia: avg(b.energia),
    sono: avg(b.sono),
    estresse: avg(b.estresse),
    dores: b.dores,
  }));
}
