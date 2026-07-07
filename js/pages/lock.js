import { h, mount } from "../ui/dom.js";
import { verifyPassword, verifyFaceId } from "../auth.js";

export async function renderLockScreen({ hasFaceId, onUnlock }) {
  const app = document.getElementById("app");

  const errorMsg = h("p", { class: "lock-error hidden" });
  const passwordInput = h("input", {
    type: "password", placeholder: "Sua senha", autocomplete: "current-password",
  });

  async function attemptPassword() {
    const ok = await verifyPassword(passwordInput.value);
    if (ok) {
      onUnlock();
      return;
    }
    errorMsg.textContent = "Senha incorreta.";
    errorMsg.classList.remove("hidden");
    passwordInput.value = "";
    passwordInput.focus();
  }

  async function attemptFaceId() {
    errorMsg.classList.add("hidden");
    const ok = await verifyFaceId();
    if (ok) onUnlock();
  }

  passwordInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") attemptPassword();
  });

  const unlockBtn = h("button", {
    class: "btn btn-primary btn-block", type: "button", text: "Desbloquear",
    onClick: attemptPassword,
  });

  const faceIdBtn = hasFaceId
    ? h("button", {
      class: "btn btn-block lock-faceid-btn", type: "button", text: "🔐 Usar Face ID / Touch ID",
      onClick: attemptFaceId,
    })
    : null;

  const card = h("div", { class: "lock-card" }, [
    h("div", { class: "lock-icon", text: "🔒" }),
    h("h1", { text: "Diário Vital" }),
    h("p", { class: "text-muted", text: "Digite sua senha para continuar." }),
    faceIdBtn,
    faceIdBtn ? h("div", { class: "lock-divider", text: "ou" }) : null,
    h("div", { class: "field" }, [passwordInput]),
    errorMsg,
    unlockBtn,
  ]);

  mount(app, h("div", { class: "lock-screen" }, [card]));
  passwordInput.focus();

  if (hasFaceId) attemptFaceId();
}
