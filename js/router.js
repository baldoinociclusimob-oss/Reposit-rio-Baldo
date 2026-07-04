// Router simples baseado em hash — sem dependências externas.

const routes = [];

export function route(pattern, handler) {
  const paramNames = [];
  const regexStr = pattern
    .split("/")
    .map((seg) => {
      if (seg.startsWith(":")) {
        paramNames.push(seg.slice(1));
        return "([^/]+)";
      }
      return seg.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    })
    .join("/");
  const regex = new RegExp(`^${regexStr}$`);
  routes.push({ regex, paramNames, handler });
}

let notFoundHandler = () => {};
export function setNotFound(handler) {
  notFoundHandler = handler;
}

function currentPath() {
  const hash = location.hash || "#/hoje";
  return hash.slice(1) || "/hoje";
}

function updateActiveTab(path) {
  const top = "/" + path.split("/").filter(Boolean)[0];
  document.querySelectorAll("#tabbar .tab-item").forEach((a) => {
    const r = "/" + a.dataset.route;
    a.classList.toggle("active", r === top);
  });
}

export async function resolve() {
  const path = currentPath();
  updateActiveTab(path);
  for (const r of routes) {
    const m = path.match(r.regex);
    if (m) {
      const params = {};
      r.paramNames.forEach((name, i) => (params[name] = decodeURIComponent(m[i + 1])));
      window.scrollTo(0, 0);
      await r.handler(params);
      return;
    }
  }
  await notFoundHandler(path);
}

export function navigate(path) {
  location.hash = `#${path}`;
}

export function startRouter() {
  window.addEventListener("hashchange", resolve);
  resolve();
}
