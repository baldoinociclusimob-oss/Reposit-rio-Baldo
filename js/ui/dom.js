// Pequeno helper para criar elementos DOM sem template strings (evita escaping manual de HTML).

export function h(tag, props = {}, children = []) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props || {})) {
    if (value === undefined || value === null || value === false) continue;
    if (key === "class") el.className = value;
    else if (key === "text") el.textContent = value;
    else if (key === "html") el.innerHTML = value;
    else if (key.startsWith("on") && typeof value === "function") {
      el.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (key === "dataset") {
      for (const [dk, dv] of Object.entries(value)) el.dataset[dk] = dv;
    } else if (key in el) {
      try { el[key] = value; } catch { el.setAttribute(key, value); }
    } else {
      el.setAttribute(key, value);
    }
  }
  for (const child of [].concat(children)) {
    if (child === null || child === undefined || child === false) continue;
    el.appendChild(typeof child === "string" ? document.createTextNode(child) : child);
  }
  return el;
}

export function clear(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
}

export function mount(root, ...children) {
  clear(root);
  for (const c of children) if (c) root.appendChild(c);
}
