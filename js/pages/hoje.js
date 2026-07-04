import { h, mount } from "../ui/dom.js";
import { CHECKIN_TYPES, CHECKIN_ORDER, isCheckInFilled } from "../checkinSchema.js";
import { getCheckInsByDate } from "../db.js";
import { todayKey, formatKeyLong } from "../utils/date.js";
import { navigate } from "../router.js";

export async function renderHojePage() {
  const app = document.getElementById("app");
  const dateKey = todayKey();
  const records = await getCheckInsByDate(dateKey);
  const byTipo = Object.fromEntries(records.map((r) => [r.tipo, r]));

  const header = h("div", { class: "page-header" }, [
    h("h1", { text: "Hoje" }),
    h("div", { class: "subtitle", text: formatKeyLong(dateKey) }),
  ]);

  const rows = CHECKIN_ORDER.map((tipo) => {
    const config = CHECKIN_TYPES[tipo];
    const record = byTipo[tipo];
    const done = isCheckInFilled(record);
    return h("a", {
      href: `#/checkin/${tipo}`,
      class: "checkin-row",
      onClick: (e) => { e.preventDefault(); navigate(`/checkin/${tipo}`); },
    }, [
      h("span", { class: "emoji", text: config.emoji }),
      h("div", { class: "info" }, [
        h("div", { class: "title", text: config.titulo }),
        h("div", { class: "desc", text: config.descCurta }),
      ]),
      h("span", {
        class: "status-badge " + (done ? "done" : "pending"),
        text: done ? "Feito" : "Pendente",
      }),
    ]);
  });

  mount(app, header, ...rows);
}
