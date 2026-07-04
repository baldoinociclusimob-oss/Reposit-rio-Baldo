export function showToast(message, duration = 2200) {
  const root = document.getElementById("toast-root");
  if (!root) return;
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = message;
  root.appendChild(el);
  setTimeout(() => {
    el.remove();
  }, duration);
}
