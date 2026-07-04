import { h, mount, clear } from "../ui/dom.js";
import { getAllCheckIns } from "../db.js";
import { buildDailySeries, weeklyAggregate } from "../aggregate.js";
import { lastNDayKeys, formatKeyShort, startOfWeek } from "../utils/date.js";
import { lineChart, barChart } from "../charts.js";

const METRICS = [
  { key: "humor", title: "😊 Humor", color: "var(--primary)", min: 1, max: 5 },
  { key: "energia", title: "⚡ Energia", color: "#c98a5e", min: 1, max: 5 },
  { key: "sono", title: "🌙 Qualidade do sono", color: "#6ea3c9", min: 1, max: 5 },
  { key: "estresse", title: "😣 Nível de estresse", color: "#b5564a", min: 1, max: 5 },
];

export async function renderTendenciasPage() {
  const app = document.getElementById("app");
  const allCheckins = await getAllCheckIns();
  const series = buildDailySeries(allCheckins);

  // Primeiro dia com algum registro: evita gráficos com um trecho inicial
  // vazio quando o histórico da pessoa ainda é mais curto que a janela padrão.
  const recordedDates = [...series.values()].filter((m) => m.temAlgumRegistro).map((m) => m.date).sort();
  const firstRecordDate = recordedDates[0] || null;

  function trimmedDayKeys(windowSize) {
    const full = lastNDayKeys(windowSize);
    if (!firstRecordDate) return full;
    const idx = full.findIndex((d) => d >= firstRecordDate);
    return idx <= 0 ? full : full.slice(idx);
  }

  const header = h("div", { class: "page-header" }, [
    h("h1", { text: "Tendências" }),
    h("div", { class: "subtitle", text: "Como você tem estado ao longo do tempo." }),
  ]);

  let range = "dia";
  const switchWrap = h("div", { class: "range-switch" });
  const chartsWrap = h("div", {});

  function renderSwitch() {
    clear(switchWrap);
    switchWrap.append(
      h("button", {
        class: range === "dia" ? "active" : "", text: "Últimos 30 dias",
        onClick: () => { range = "dia"; renderSwitch(); renderCharts(); },
      }),
      h("button", {
        class: range === "semana" ? "active" : "", text: "Últimos 6 meses",
        onClick: () => { range = "semana"; renderSwitch(); renderCharts(); },
      })
    );
  }

  function dailyPoints(metricKey) {
    return trimmedDayKeys(30).map((day) => ({
      label: formatKeyShort(day),
      value: series.get(day)?.[metricKey] ?? null,
    }));
  }

  function dailyPainPoints() {
    return trimmedDayKeys(30).map((day) => ({
      label: formatKeyShort(day),
      value: series.get(day)?.painEntries?.length ?? 0,
    }));
  }

  function weeklyPoints(metricKey) {
    const days = trimmedDayKeys(182);
    const buckets = weeklyAggregate(series, days, startOfWeek);
    return buckets.map((b) => ({ label: formatKeyShort(b.weekStart), value: b[metricKey] }));
  }

  function weeklyPainPoints() {
    const days = trimmedDayKeys(182);
    const buckets = weeklyAggregate(series, days, startOfWeek);
    return buckets.map((b) => ({ label: formatKeyShort(b.weekStart), value: b.dores }));
  }

  function hasAnyData(points) {
    return points.some((p) => p.value !== null && p.value !== undefined);
  }

  function renderCharts() {
    clear(chartsWrap);

    METRICS.forEach((metric) => {
      const points = range === "dia" ? dailyPoints(metric.key) : weeklyPoints(metric.key);
      const card = h("div", { class: "card" }, [
        h("div", { class: "card-title", text: metric.title }),
      ]);
      if (!hasAnyData(points)) {
        card.appendChild(h("p", { class: "card-sub", text: "Ainda sem dados suficientes para este gráfico." }));
      } else {
        const wrap = h("div", { class: "chart-wrap" });
        wrap.appendChild(lineChart({ points, min: metric.min, max: metric.max, color: metric.color, labelEvery: range === "dia" ? 4 : 2 }));
        card.appendChild(wrap);
      }
      chartsWrap.appendChild(card);
    });

    const painPoints = range === "dia" ? dailyPainPoints() : weeklyPainPoints();
    const painCard = h("div", { class: "card" }, [
      h("div", { class: "card-title", text: "🤕 Frequência de dores" }),
    ]);
    if (!painPoints.some((p) => p.value > 0)) {
      painCard.appendChild(h("p", { class: "card-sub", text: "Nenhuma dor registrada neste período." }));
    } else {
      const wrap = h("div", { class: "chart-wrap" });
      wrap.appendChild(barChart({ points: painPoints, labelEvery: range === "dia" ? 4 : 2 }));
      painCard.appendChild(wrap);
    }
    chartsWrap.appendChild(painCard);
  }

  renderSwitch();
  renderCharts();
  mount(app, header, switchWrap, chartsWrap);
}
