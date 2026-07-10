import { h, clear, mount } from "./dom.js";
import { isIOS, isStandalone } from "../storageProtection.js";

let dismissedThisSession = false;

export function renderInstallBanner() {
  const root = document.getElementById("banner-root");
  if (!root) return;

  if (dismissedThisSession || !isIOS() || isStandalone()) {
    clear(root);
    return;
  }

  let expanded = false;
  const instructions = h("ol", { class: "install-banner-steps hidden" }, [
    h("li", { text: 'Toque no ícone de compartilhar (□ com uma seta pra cima) na barra do Safari.' }),
    h("li", { text: 'Escolha "Adicionar à Tela de Início".' }),
    h("li", { text: "Abra o app sempre por esse ícone novo, não mais pelo Safari." }),
  ]);

  const toggleBtn = h("button", {
    class: "btn btn-sm btn-ghost", type: "button", text: "Como adicionar",
    onClick: () => {
      expanded = !expanded;
      instructions.classList.toggle("hidden", !expanded);
      toggleBtn.textContent = expanded ? "Ocultar" : "Como adicionar";
    },
  });

  const banner = h("div", { class: "install-banner" }, [
    h("div", { class: "install-banner-row" }, [
      h("span", { class: "install-banner-icon", text: "⚠️" }),
      h("div", { class: "install-banner-text" }, [
        h("strong", { text: "Adicione à Tela de Início para não perder seus registros." }),
        h("p", { text: "Sem instalar, o iPhone pode apagar os dados deste site depois de um tempo sem uso." }),
      ]),
      h("button", {
        class: "install-banner-close", type: "button", text: "×", "aria-label": "Fechar aviso",
        onClick: () => { dismissedThisSession = true; clear(root); },
      }),
    ]),
    toggleBtn,
    instructions,
  ]);

  mount(root, banner);
}
