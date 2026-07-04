import { h, mount } from "../ui/dom.js";
import { navigate } from "../router.js";

export async function renderAjustesPage() {
  const app = document.getElementById("app");

  const header = h("div", { class: "page-header" }, [
    h("h1", { text: "Ajustes" }),
  ]);

  const tagsCard = h("div", { class: "card" }, [
    h("div", { class: "card-title", text: "🏷️ Gerenciar tags" }),
    h("div", { class: "card-sub", text: "Renomeie tags de comidas, dores, lugares, atividades e pessoas." }),
    h("button", {
      class: "btn btn-primary", type: "button", text: "Abrir",
      onClick: () => navigate("/tags"),
    }),
  ]);

  mount(app, header, tagsCard);
}
