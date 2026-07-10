import { route, setNotFound, startRouter } from "./router.js";
import { renderHojePage } from "./pages/hoje.js";
import { renderCheckinPage } from "./pages/checkin.js";
import { renderMomentoPage } from "./pages/momento.js";
import { renderAjustesPage } from "./pages/ajustes.js";
import { renderTagsPage } from "./pages/tags.js";
import { renderPerfilPage } from "./pages/perfil.js";
import { renderHistoricoMonthPage, renderHistoricoDayPage } from "./pages/historico.js";
import { renderTendenciasPage } from "./pages/tendencias.js";
import { renderDescobertasPage } from "./pages/descobertas.js";
import { h, mount } from "./ui/dom.js";
import { startReminderLoop } from "./notifications.js";
import { getAuthSettings, isUnlockedThisSession, markUnlocked } from "./auth.js";
import { renderLockScreen } from "./pages/lock.js";
import { renderConsultaPage } from "./pages/consulta.js";
import { ensurePersistentStorage } from "./storageProtection.js";
import { renderInstallBanner } from "./ui/banner.js";
import { runAutoBackupIfDue } from "./autoBackup.js";
import { updateBadge } from "./badge.js";

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
route("/perfil", renderPerfilPage);
route("/consulta", renderConsultaPage);

setNotFound(async () => {
  mount(document.getElementById("app"), h("div", { class: "page-header" }, [h("h1", { text: "Página não encontrada" })]));
});

function startApp() {
  startRouter();
  startReminderLoop();
  renderInstallBanner();
  updateBadge();
  ensurePersistentStorage();
  runAutoBackupIfDue();
}

async function boot() {
  const authSettings = await getAuthSettings();
  const tabbar = document.getElementById("tabbar");

  if (authSettings.enabled && !isUnlockedThisSession()) {
    tabbar.classList.add("hidden");
    await renderLockScreen({
      hasFaceId: Boolean(authSettings.faceId),
      onUnlock: () => {
        markUnlocked();
        tabbar.classList.remove("hidden");
        startApp();
      },
    });
  } else {
    startApp();
  }
}

boot();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("service-worker.js").catch(() => {});
  });
}
