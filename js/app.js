import { route, setNotFound, startRouter } from "./router.js";
import { renderHojePage } from "./pages/hoje.js";
import { renderCheckinPage } from "./pages/checkin.js";
import { renderMomentoPage } from "./pages/momento.js";
import { renderAjustesPage } from "./pages/ajustes.js";
import { renderTagsPage } from "./pages/tags.js";
import { renderHistoricoMonthPage, renderHistoricoDayPage } from "./pages/historico.js";
import { renderTendenciasPage } from "./pages/tendencias.js";
import { renderDescobertasPage } from "./pages/descobertas.js";
import { h, mount } from "./ui/dom.js";
import { startReminderLoop } from "./notifications.js";

route("/hoje", renderHojePage);
route("/checkin/:tipo", ({ tipo }) => renderCheckinPage({ tipo }));
route("/checkin/:tipo/:date", ({ tipo, date }) => renderCheckinPage({ tipo, date }));
route("/momento/novo/:date", ({ date }) => renderMomentoPage({ date }));
route("/momento/:id", ({ id }) => renderMomentoPage({ id }));

route("/historico", () => renderHistoricoMonthPage({}));
route("/historico/mes/:year/:month", ({ year, month }) => renderHistoricoMonthPage({ year, month }));
route("/historico/dia/:date", ({ date }) => renderHistoricoDayPage({ date }));
route("/tendencias", renderTendenciasPage);
route("/descobertas", renderDescobertasPage);
route("/ajustes", renderAjustesPage);
route("/tags", renderTagsPage);

setNotFound(async () => {
  mount(document.getElementById("app"), h("div", { class: "page-header" }, [h("h1", { text: "Página não encontrada" })]));
});

startRouter();
startReminderLoop();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("service-worker.js").catch(() => {});
  });
}
