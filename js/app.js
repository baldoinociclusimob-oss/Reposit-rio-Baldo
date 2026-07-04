import { route, setNotFound, startRouter } from "./router.js";
import { renderHojePage } from "./pages/hoje.js";
import { renderCheckinPage } from "./pages/checkin.js";
import { renderAjustesPage } from "./pages/ajustes.js";
import { renderTagsPage } from "./pages/tags.js";
import { h, mount } from "./ui/dom.js";

route("/hoje", renderHojePage);
route("/checkin/:tipo", ({ tipo }) => renderCheckinPage({ tipo }));
route("/checkin/:tipo/:date", ({ tipo, date }) => renderCheckinPage({ tipo, date }));

route("/historico", async () => {
  mount(document.getElementById("app"), h("div", { class: "page-header" }, [h("h1", { text: "Histórico" }), h("p", { class: "text-muted", text: "Em construção…" })]));
});
route("/tendencias", async () => {
  mount(document.getElementById("app"), h("div", { class: "page-header" }, [h("h1", { text: "Tendências" }), h("p", { class: "text-muted", text: "Em construção…" })]));
});
route("/descobertas", async () => {
  mount(document.getElementById("app"), h("div", { class: "page-header" }, [h("h1", { text: "Descobertas" }), h("p", { class: "text-muted", text: "Em construção…" })]));
});
route("/ajustes", renderAjustesPage);
route("/tags", renderTagsPage);

setNotFound(async () => {
  mount(document.getElementById("app"), h("div", { class: "page-header" }, [h("h1", { text: "Página não encontrada" })]));
});

startRouter();
