import { h, mount } from "../ui/dom.js";

// Implementação completa vem na Fase C (Modo Consulta). Placeholder por
// enquanto para as demais fases poderem referenciar a rota /consulta.
export async function renderConsultaPage() {
  const app = document.getElementById("app");
  mount(app, h("div", { class: "page-header" }, [
    h("h1", { text: "🩺 Modo Consulta" }),
    h("p", { class: "text-muted", text: "Em construção…" }),
  ]));
}
