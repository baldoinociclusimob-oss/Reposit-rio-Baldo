import { h, mount } from "../ui/dom.js";
import { CHECKIN_TYPES, CHECKIN_ORDER, isCheckInFilled, MOMENTO_SCHEMA } from "../checkinSchema.js";
import { getCheckInsByDate, getMomentosByDate, getAllTags } from "../db.js";
import { todayKey, formatKeyLong } from "../utils/date.js";
import { navigate } from "../router.js";
import { momentoSummaryText } from "../momentoSummary.js";

export async function renderHojePage() {
  const app = document.getElementById("app");
  const dateKey = todayKey();
  const [records, momentos, tags] = await Promise.all([
    getCheckInsByDate(dateKey),
    getMomentosByDate(dateKey),
    getAllTags(),
  ]);
  const byTipo = Object.fromEntries(records.map((r) => [r.tipo, r]));
  const tagById = new Map(tags.map((t) => [t.id, t]));

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

  const momentoBtn = h("button", {
    class: "btn btn-block momento-add-btn", type: "button",
    onClick: () => navigate(`/momento/novo/${dateKey}`),
  }, [`${MOMENTO_SCHEMA.emoji} Registrar como estou agora`]);

  const momentoRows = momentos.map((m) =>
    h("a", {
      href: `#/momento/${m.id}`,
      class: "checkin-row",
      onClick: (e) => { e.preventDefault(); navigate(`/momento/${m.id}`); },
    }, [
      h("span", { class: "emoji", text: MOMENTO_SCHEMA.emoji }),
      h("div", { class: "info" }, [
        h("div", { class: "title", text: m.horario ? `Às ${m.horario}` : "Registro espontâneo" }),
        h("div", { class: "desc", text: momentoSummaryText(m, tagById) }),
      ]),
    ])
  );

  const momentoSection = momentos.length
    ? h("div", {}, [h("h2", { class: "section-title", text: "Registros espontâneos de hoje" }), ...momentoRows])
    : null;

  mount(app, header, ...rows, momentoBtn, momentoSection);
}
