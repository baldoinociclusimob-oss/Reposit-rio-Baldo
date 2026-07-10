import { h, mount, clear } from "../ui/dom.js";
import { getAllCheckIns, getAllMomentos, getAllTags, getSetting } from "../db.js";
import { buildDailySeries } from "../aggregate.js";
import { generateInsights, strengthLabel } from "../insights.js";
import { lastNDayKeys, todayKey, formatKeyLong, formatKeyShort, weekdayLabel } from "../utils/date.js";
import { lineChart, barChart } from "../charts.js";
import { MOOD_OPTIONS } from "../checkinSchema.js";

const PERIODO_LABEL = { matinal: "ao acordar", vespertino: "durante o dia", noturno: "à noite", momento: "registro avulso" };
const MAX_PADROES = 6;
const MAX_CRISES = 5;

const BLOCKS = [
  { key: "cabecalho", label: "Cabeçalho (perfil e ficha médica)" },
  { key: "sintomas", label: "Tabela de sintomas" },
  { key: "medicamentos", label: "Medicamentos tomados" },
  { key: "graficos", label: "Gráficos" },
  { key: "crises", label: "Linha do tempo dos piores dias" },
  { key: "padroes", label: "Padrões observados (Descobertas)" },
];

function moodLabel(val) {
  return MOOD_OPTIONS.find((o) => o.val === val)?.label || null;
}

export async function renderConsultaPage() {
  const app = document.getElementById("app");
  let periodDays = 30;
  const enabledBlocks = new Set(BLOCKS.map((b) => b.key));
  let includeCpf = false;

  const header = h("div", { class: "page-header no-print" }, [
    h("h1", { text: "🩺 Modo Consulta" }),
    h("div", { class: "subtitle", text: "Resumo organizado para levar numa consulta médica — não é um diagnóstico." }),
  ]);

  const periodSwitch = h("div", { class: "range-switch no-print" });
  function renderPeriodSwitch() {
    clear(periodSwitch);
    [30, 60, 90].forEach((n) => {
      periodSwitch.appendChild(h("button", {
        class: periodDays === n ? "active" : "", text: `${n} dias`,
        onClick: () => { periodDays = n; renderPeriodSwitch(); renderReport(); },
      }));
    });
  }

  const controlsCard = h("div", { class: "card no-print" });
  function renderControls() {
    clear(controlsCard);
    controlsCard.appendChild(h("div", { class: "card-title", text: "Seções incluídas" }));
    BLOCKS.forEach((b) => {
      const input = h("input", {
        type: "checkbox", checked: enabledBlocks.has(b.key),
        onChange: (e) => {
          if (e.target.checked) enabledBlocks.add(b.key); else enabledBlocks.delete(b.key);
          renderReport();
        },
      });
      controlsCard.appendChild(h("label", { class: "settings-row", style: "cursor:pointer;" }, [
        h("span", { class: "label", text: b.label }), input,
      ]));
    });
    const cpfInput = h("input", {
      type: "checkbox", checked: includeCpf,
      onChange: (e) => { includeCpf = e.target.checked; renderReport(); },
    });
    controlsCard.appendChild(h("label", { class: "settings-row", style: "cursor:pointer;" }, [
      h("span", { class: "label", text: "Incluir CPF e convênio no cabeçalho" }), cpfInput,
    ]));
  }

  const printBtn = h("button", {
    class: "btn btn-primary btn-block no-print", type: "button", text: "🖨️ Salvar como PDF / Imprimir",
    onClick: () => window.print(),
  });

  const reportArea = h("div", { id: "consulta-print-area" });

  async function renderReport() {
    clear(reportArea);
    const endDate = todayKey();
    const dayKeys = lastNDayKeys(periodDays);
    const startDate = dayKeys[0];

    const [allCheckins, allMomentos, allTags, perfil] = await Promise.all([
      getAllCheckIns(), getAllMomentos(), getAllTags(), getSetting("perfil", null),
    ]);
    const tagById = new Map(allTags.map((t) => [t.id, t]));
    const tagName = (id) => tagById.get(id)?.nome || "—";

    const series = buildDailySeries(allCheckins, allMomentos);
    const days = dayKeys.map((d) => series.get(d)).filter(Boolean);

    reportArea.appendChild(h("div", { class: "consulta-block" }, [
      h("h1", { style: "font-size:20px;margin-bottom:2px;", text: "Diário Vital — Resumo para consulta" }),
      h("p", { class: "text-muted", text: `Período: ${formatKeyLong(startDate)} até ${formatKeyLong(endDate)} (${periodDays} dias)` }),
    ]));

    if (enabledBlocks.has("cabecalho")) reportArea.appendChild(renderCabecalho(perfil, tagName, includeCpf));
    if (enabledBlocks.has("sintomas")) reportArea.appendChild(renderSintomas(days, tagName));
    if (enabledBlocks.has("medicamentos")) reportArea.appendChild(renderMedicamentos(days, tagName));
    if (enabledBlocks.has("graficos")) reportArea.appendChild(renderGraficos(dayKeys, series));
    if (enabledBlocks.has("crises")) reportArea.appendChild(renderCrises(days, tagName));
    if (enabledBlocks.has("padroes")) reportArea.appendChild(await renderPadroes(startDate, endDate));

    reportArea.appendChild(h("div", { class: "consulta-block consulta-footer" }, [
      h("p", { text: `Gerado pelo Diário Vital em ${formatKeyLong(todayKey())}. Registro pessoal do paciente; não substitui avaliação profissional.` }),
    ]));
  }

  mount(app, header, periodSwitch, controlsCard, printBtn, reportArea);
  renderPeriodSwitch();
  renderControls();
  await renderReport();
}

function renderCabecalho(perfil, tagName, includeCpf) {
  const card = h("div", { class: "consulta-block card" }, [h("div", { class: "card-title", text: "Dados do paciente" })]);
  if (!perfil) {
    card.appendChild(h("p", { class: "card-sub", text: "Perfil não preenchido. Vá em Ajustes → Meu perfil para completar." }));
    return card;
  }
  const linhas = [
    ["Nome", perfil.nome],
    ["Idade", perfil.idade ? `${perfil.idade} anos` : null],
    includeCpf ? ["CPF", perfil.cpf] : null,
    ["Telefone", perfil.telefone],
    ["Tipo sanguíneo", perfil.fichaMedica?.tipoSanguineo],
    ["Alergias", (perfil.alergiaIds || []).map(tagName).join(", ") || null],
    ["Condições crônicas", perfil.fichaMedica?.condicoes],
    ["Medicamentos de uso contínuo", perfil.fichaMedica?.medicamentos],
    includeCpf ? ["Convênio médico", perfil.fichaMedica?.convenio] : null,
    ["Contato de emergência", [perfil.fichaMedica?.contatoEmergenciaNome, perfil.fichaMedica?.contatoEmergenciaTelefone].filter(Boolean).join(" — ")],
  ].filter((l) => l && l[1]);

  const table = h("table", { class: "consulta-table" });
  linhas.forEach(([label, val]) => {
    table.appendChild(h("tr", {}, [h("td", { class: "consulta-table-label", text: label }), h("td", { text: val })]));
  });
  card.appendChild(table);
  return card;
}

function renderSintomas(days, tagName) {
  const card = h("div", { class: "consulta-block card" }, [
    h("div", { class: "card-title", text: "Sintomas e dores no período" }),
  ]);

  const byTag = new Map();
  days.forEach((d) => {
    d.painEntries.forEach((p) => {
      if (!p.tagId) return;
      if (!byTag.has(p.tagId)) byTag.set(p.tagId, { dias: new Set(), intensidades: [], tipos: {}, aindaDoi: 0, fins: [] });
      const rec = byTag.get(p.tagId);
      rec.dias.add(d.date);
      if (p.intensidade) rec.intensidades.push(p.intensidade);
      rec.tipos[p.tipo] = (rec.tipos[p.tipo] || 0) + 1;
      if (p.aindaDoi) rec.aindaDoi += 1;
      else if (p.fim) rec.fins.push(p.fim);
    });
  });

  if (byTag.size === 0) {
    card.appendChild(h("p", { class: "card-sub", text: "Nenhum sintoma registrado no período." }));
    return card;
  }

  const rows = [...byTag.entries()].sort((a, b) => b[1].dias.size - a[1].dias.size);
  const table = h("table", { class: "consulta-table consulta-table-grid" }, [
    h("tr", {}, ["Sintoma", "Dias", "Intensidade média", "Intensidade máx.", "Período predominante", "Duração"].map((t) =>
      h("th", { text: t })
    )),
  ]);
  rows.forEach(([tagId, rec]) => {
    const media = rec.intensidades.length ? (rec.intensidades.reduce((a, b) => a + b, 0) / rec.intensidades.length).toFixed(1) : "—";
    const max = rec.intensidades.length ? Math.max(...rec.intensidades) : "—";
    const topTipo = Object.entries(rec.tipos).sort((a, b) => b[1] - a[1])[0]?.[0];
    const periodo = PERIODO_LABEL[topTipo] || "—";
    let duracao = "não registrada";
    if (rec.aindaDoi > 0 && rec.fins.length === 0) duracao = "geralmente ainda presente no registro";
    else if (rec.fins.length > 0) duracao = `costuma passar até ~${rec.fins.sort()[Math.floor(rec.fins.length / 2)]}`;
    table.appendChild(h("tr", {}, [
      h("td", { text: tagName(tagId) }),
      h("td", { text: String(rec.dias.size) }),
      h("td", { text: media }),
      h("td", { text: String(max) }),
      h("td", { text: periodo }),
      h("td", { text: duracao }),
    ]));
  });
  card.appendChild(table);
  return card;
}

function renderMedicamentos(days, tagName) {
  const card = h("div", { class: "consulta-block card" }, [h("div", { class: "card-title", text: "Medicamentos tomados no período" })]);
  const byTag = new Map();
  days.forEach((d) => {
    (d.medicamentos || []).forEach((m) => {
      if (!m.tagId) return;
      if (!byTag.has(m.tagId)) byTag.set(m.tagId, { count: 0, doses: new Set() });
      const rec = byTag.get(m.tagId);
      rec.count += 1;
      if (m.dose) rec.doses.add(m.dose);
    });
  });
  if (byTag.size === 0) {
    card.appendChild(h("p", { class: "card-sub", text: "Nenhum medicamento registrado no período." }));
    return card;
  }
  const table = h("table", { class: "consulta-table consulta-table-grid" }, [
    h("tr", {}, ["Medicamento", "Vezes registradas", "Doses usadas"].map((t) => h("th", { text: t }))),
  ]);
  [...byTag.entries()].sort((a, b) => b[1].count - a[1].count).forEach(([tagId, rec]) => {
    table.appendChild(h("tr", {}, [
      h("td", { text: tagName(tagId) }),
      h("td", { text: String(rec.count) }),
      h("td", { text: [...rec.doses].join(", ") || "—" }),
    ]));
  });
  card.appendChild(table);
  return card;
}

function renderGraficos(dayKeys, series) {
  const card = h("div", { class: "consulta-block card" }, [h("div", { class: "card-title", text: "Gráficos do período" })]);
  const metrics = [
    { key: "humor", title: "Humor", min: 1, max: 5 },
    { key: "energia", title: "Energia", min: 1, max: 5 },
    { key: "sono", title: "Qualidade do sono", min: 1, max: 5 },
    { key: "estresse", title: "Estresse", min: 1, max: 5 },
  ];
  metrics.forEach((m) => {
    const points = dayKeys.map((d) => ({ label: formatKeyShort(d), value: series.get(d)?.[m.key] ?? null }));
    if (!points.some((p) => p.value !== null)) return;
    card.appendChild(h("p", { class: "consulta-chart-title", text: m.title }));
    const wrap = h("div", { class: "chart-wrap" });
    wrap.appendChild(lineChart({ points, min: m.min, max: m.max, height: 90, labelEvery: Math.ceil(dayKeys.length / 8) }));
    card.appendChild(wrap);
  });
  const painPoints = dayKeys.map((d) => ({ label: formatKeyShort(d), value: series.get(d)?.painEntries?.length ?? 0 }));
  if (painPoints.some((p) => p.value > 0)) {
    card.appendChild(h("p", { class: "consulta-chart-title", text: "Frequência de dores" }));
    const wrap = h("div", { class: "chart-wrap" });
    wrap.appendChild(barChart({ points: painPoints, height: 90, labelEvery: Math.ceil(dayKeys.length / 8) }));
    card.appendChild(wrap);
  }
  return card;
}

function renderCrises(days, tagName) {
  const card = h("div", { class: "consulta-block card" }, [h("div", { class: "card-title", text: "Piores dias do período" })]);
  const comNota = days.filter((d) => d.notaGeral !== null).sort((a, b) => a.notaGeral - b.notaGeral).slice(0, MAX_CRISES);
  if (comNota.length === 0) {
    card.appendChild(h("p", { class: "card-sub", text: "Nenhuma nota geral do dia registrada no período." }));
    return card;
  }
  comNota.forEach((d) => {
    const dores = d.painEntries.map((p) => tagName(p.tagId)).join(", ");
    card.appendChild(h("div", { class: "consulta-crise-item" }, [
      h("strong", { text: `${formatKeyLong(d.date)} (${weekdayLabel(d.date)}) — nota ${d.notaGeral}` }),
      h("p", { text: [
        d.humor ? `Humor: ${moodLabel(Math.round(d.humor))}` : null,
        dores ? `Dores: ${dores}` : null,
      ].filter(Boolean).join(" · ") || "Sem outros detalhes registrados." }),
    ]));
  });
  return card;
}

async function renderPadroes(startDate, endDate) {
  const card = h("div", { class: "consulta-block card" }, [
    h("div", { class: "card-title", text: "Padrões observados" }),
    h("p", { class: "card-sub", text: "Tendências percebidas nos registros do período — não é diagnóstico nem relação de causa e efeito comprovada." }),
  ]);
  const { insights } = await generateInsights({ startDate, endDate });
  if (insights.length === 0) {
    card.appendChild(h("p", { class: "card-sub", text: "Nenhum padrão com dados suficientes neste período." }));
    return card;
  }
  insights.slice(0, MAX_PADROES).forEach((ins) => {
    card.appendChild(h("div", { class: "consulta-padrao-item" }, [
      h("strong", { text: strengthLabel(ins.strength) + ": " }),
      h("span", { text: ins.text }),
      h("div", { class: "text-muted", style: "font-size:11px;", text: ins.base }),
    ]));
  });
  return card;
}
