// Gráficos simples em SVG puro, sem dependências externas.

const SVG_NS = "http://www.w3.org/2000/svg";

function svg(tag, attrs = {}, children = []) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null) continue;
    el.setAttribute(k, v);
  }
  for (const c of [].concat(children)) if (c) el.appendChild(c);
  return el;
}

/**
 * Gráfico de linha. points: [{label, value}] onde value pode ser null (sem dado, não interpola).
 */
export function lineChart({ points, min = 1, max = 5, color = "#8f1d24", height = 150, labelEvery = 1 }) {
  const spacing = points.length > 14 ? 26 : 46;
  const marginL = 26, marginR = 12, marginT = 14, marginB = 26;
  const width = Math.max(280, points.length * spacing) + marginL + marginR;
  const plotH = height - marginT - marginB;
  const plotW = width - marginL - marginR;
  const stepX = points.length > 1 ? plotW / (points.length - 1) : 0;

  function yFor(v) {
    const clamped = Math.min(max, Math.max(min, v));
    return marginT + plotH - ((clamped - min) / (max - min)) * plotH;
  }
  function xFor(i) {
    return marginL + i * stepX;
  }

  const root = svg("svg", { width, height, viewBox: `0 0 ${width} ${height}`, role: "img" });

  // Linhas de grade horizontais (min, meio, max)
  [min, (min + max) / 2, max].forEach((gv) => {
    const y = yFor(gv);
    root.appendChild(svg("line", { x1: marginL, x2: width - marginR, y1: y, y2: y, stroke: "var(--border)", "stroke-width": 1 }));
    root.appendChild(svg("text", { x: 2, y: y + 4, "font-size": 10, fill: "var(--text-muted)" }, [document.createTextNode(String(gv))]));
  });

  // Segmentos de linha (pula quando não há dado)
  let pathSegments = [];
  let current = [];
  points.forEach((p, i) => {
    if (p.value === null || p.value === undefined) {
      if (current.length) pathSegments.push(current);
      current = [];
      return;
    }
    current.push(`${i === 0 || current.length === 0 ? "M" : "L"}${xFor(i)},${yFor(p.value)}`);
  });
  if (current.length) pathSegments.push(current);

  pathSegments.forEach((seg) => {
    root.appendChild(svg("path", { d: seg.join(" "), fill: "none", stroke: color, "stroke-width": 2.5, "stroke-linecap": "round", "stroke-linejoin": "round" }));
  });

  points.forEach((p, i) => {
    if (p.value === null || p.value === undefined) return;
    root.appendChild(svg("circle", { cx: xFor(i), cy: yFor(p.value), r: 3.5, fill: color }));
  });

  points.forEach((p, i) => {
    if (i % labelEvery !== 0 && i !== points.length - 1) return;
    root.appendChild(
      svg("text", {
        x: xFor(i), y: height - 6, "font-size": 10, fill: "var(--text-muted)", "text-anchor": "middle",
      }, [document.createTextNode(p.label)])
    );
  });

  return root;
}

/** Gráfico de barras simples (ex.: frequência de dores). points: [{label, value}] com value >= 0. */
export function barChart({ points, color = "#d1293b", height = 150, labelEvery = 1 }) {
  const spacing = points.length > 14 ? 26 : 46;
  const marginL = 20, marginR = 12, marginT = 14, marginB = 26;
  const width = Math.max(280, points.length * spacing) + marginL + marginR;
  const plotH = height - marginT - marginB;
  const plotW = width - marginL - marginR;
  const stepX = points.length > 0 ? plotW / points.length : 0;
  const maxVal = Math.max(1, ...points.map((p) => p.value || 0));

  const root = svg("svg", { width, height, viewBox: `0 0 ${width} ${height}`, role: "img" });

  root.appendChild(svg("line", { x1: marginL, x2: width - marginR, y1: marginT + plotH, y2: marginT + plotH, stroke: "var(--border)", "stroke-width": 1 }));

  const barW = Math.min(stepX * 0.55, 22);
  points.forEach((p, i) => {
    const v = p.value || 0;
    const h = v === 0 ? 0 : Math.max(3, (v / maxVal) * plotH);
    const x = marginL + i * stepX + (stepX - barW) / 2;
    const y = marginT + plotH - h;
    if (h > 0) root.appendChild(svg("rect", { x, y, width: barW, height: h, rx: 3, fill: color }));
    if (i % labelEvery === 0 || i === points.length - 1) {
      root.appendChild(svg("text", { x: x + barW / 2, y: height - 6, "font-size": 10, fill: "var(--text-muted)", "text-anchor": "middle" }, [document.createTextNode(p.label)]));
    }
  });

  return root;
}
