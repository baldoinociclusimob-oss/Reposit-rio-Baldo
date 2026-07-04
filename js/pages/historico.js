import { h, mount } from "../ui/dom.js";
import { getCheckInsInRange, getCheckInsByDate } from "../db.js";
import { CHECKIN_TYPES, CHECKIN_ORDER, isCheckInFilled } from "../checkinSchema.js";
import {
  WEEKDAYS_SHORT, daysInMonth, monthKeyRange, monthLabel, pad2,
  todayKey, formatKeyLong, keyToDate,
} from "../utils/date.js";
import { navigate } from "../router.js";

export async function renderHistoricoMonthPage({ year, month } = {}) {
  const app = document.getElementById("app");
  const now = new Date();
  const y = year !== undefined ? Number(year) : now.getFullYear();
  const m = month !== undefined ? Number(month) : now.getMonth();

  const { start, end } = monthKeyRange(y, m);
  const records = await getCheckInsInRange(start, end);
  const byDate = new Map();
  records.forEach((r) => {
    if (!byDate.has(r.date)) byDate.set(r.date, {});
    byDate.get(r.date)[r.tipo] = r;
  });

  function monthUrl(yy, mm) {
    let ny = yy, nm = mm;
    if (nm < 0) { nm = 11; ny -= 1; }
    if (nm > 11) { nm = 0; ny += 1; }
    return `/historico/mes/${ny}/${nm}`;
  }

  const header = h("div", { class: "page-header" }, [h("h1", { text: "Histórico" })]);

  const nav = h("div", { class: "month-nav" }, [
    h("button", {
      class: "icon-btn", text: "‹",
      onClick: () => navigate(monthUrl(y, m - 1)),
    }),
    h("h2", { text: monthLabel(y, m) }),
    h("button", {
      class: "icon-btn", text: "›",
      onClick: () => navigate(monthUrl(y, m + 1)),
    }),
  ]);

  const weekdayRow = WEEKDAYS_SHORT.map((w) => h("div", { class: "calendar-weekday", text: w }));

  const firstWeekday = new Date(y, m, 1).getDay();
  const total = daysInMonth(y, m);
  const cells = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(h("div", { class: "calendar-day empty" }));
  for (let d = 1; d <= total; d++) {
    const key = `${y}-${pad2(m + 1)}-${pad2(d)}`;
    const dayRecords = byDate.get(key) || {};
    const dots = CHECKIN_ORDER.map((tipo) =>
      h("span", { class: "dot" + (isCheckInFilled(dayRecords[tipo]) ? " filled" : "") })
    );
    cells.push(
      h("div", {
        class: "calendar-day" + (key === todayKey() ? " today" : ""),
        onClick: () => navigate(`/historico/dia/${key}`),
      }, [
        h("span", { text: String(d) }),
        h("div", { class: "dots" }, dots),
      ])
    );
  }

  const grid = h("div", { class: "calendar-grid" }, [...weekdayRow, ...cells]);

  const legend = h("div", { class: "legend" }, [
    h("div", { class: "legend-item" }, [h("span", { class: "legend-dot", style: "background:var(--primary)" }), "check-in registrado"]),
    h("div", { class: "legend-item" }, [h("span", { class: "legend-dot", style: "background:var(--border)" }), "sem registro"]),
  ]);

  mount(app, header, nav, grid, legend);
}

export async function renderHistoricoDayPage({ date }) {
  const app = document.getElementById("app");
  const records = await getCheckInsByDate(date);
  const byTipo = Object.fromEntries(records.map((r) => [r.tipo, r]));
  const d = keyToDate(date);

  const header = h("div", { class: "page-header" }, [
    h("a", {
      href: "#/historico", class: "back-link", text: "‹ Voltar ao calendário",
      onClick: (e) => { e.preventDefault(); navigate(`/historico/mes/${d.getFullYear()}/${d.getMonth()}`); },
    }),
    h("h1", { text: formatKeyLong(date) }),
  ]);

  const rows = CHECKIN_ORDER.map((tipo) => {
    const config = CHECKIN_TYPES[tipo];
    const record = byTipo[tipo];
    const done = isCheckInFilled(record);
    return h("a", {
      href: `#/checkin/${tipo}/${date}`,
      class: "checkin-row",
      onClick: (e) => { e.preventDefault(); navigate(`/checkin/${tipo}/${date}`); },
    }, [
      h("span", { class: "emoji", text: config.emoji }),
      h("div", { class: "info" }, [
        h("div", { class: "title", text: config.titulo }),
        h("div", { class: "desc", text: config.descCurta }),
      ]),
      h("span", {
        class: "status-badge " + (done ? "done" : "pending"),
        text: done ? "Feito" : "Registrar",
      }),
    ]);
  });

  mount(app, header, h("div", { class: "day-detail-list" }, rows));
}
