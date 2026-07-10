import { h, clear } from "./dom.js";

const MAX_DIMENSION = 1280;
const JPEG_QUALITY = 0.8;

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

async function compressToBlob(file) {
  const img = await loadImage(file);
  const scale = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  URL.revokeObjectURL(img.src);
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY));
}

/**
 * Fotos de sintomas visíveis, comprimidas antes de salvar. value:
 * [{id, blob, criadaEm}]. Documenta evolução melhor que descrição.
 */
export function createPhotoListField({ value = [], onChange }) {
  const container = h("div", {});
  const grid = h("div", { class: "photo-grid" });
  container.appendChild(grid);

  const entries = value.map((v) => ({ ...v }));

  function emit() {
    onChange(entries.map(({ id, blob, criadaEm }) => ({ id, blob, criadaEm })));
  }

  function renderGrid() {
    clear(grid);
    entries.forEach((entry) => {
      const url = URL.createObjectURL(entry.blob);
      grid.appendChild(
        h("div", { class: "photo-thumb" }, [
          h("img", { src: url, alt: "Foto do sintoma" }),
          h("button", {
            class: "photo-thumb-remove", type: "button", text: "×", "aria-label": "Remover foto",
            onClick: () => {
              const idx = entries.indexOf(entry);
              if (idx >= 0) entries.splice(idx, 1);
              renderGrid();
              emit();
            },
          }),
        ])
      );
    });
  }
  renderGrid();

  const fileInput = h("input", {
    type: "file", accept: "image/*", class: "hidden",
    onChange: async (e) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file) return;
      const blob = await compressToBlob(file);
      if (!blob) return;
      entries.push({ id: crypto.randomUUID(), blob, criadaEm: new Date().toISOString() });
      renderGrid();
      emit();
    },
  });

  const addBtn = h("label", { class: "btn btn-sm btn-ghost photo-add-btn" }, ["📷 Adicionar foto", fileInput]);
  container.appendChild(addBtn);

  return container;
}
