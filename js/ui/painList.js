import { h, clear } from "./dom.js";
import { createTagAutocomplete } from "./tagPicker.js";
import { getAllTags } from "../db.js";
import { BODY_LOCATIONS } from "../checkinSchema.js";

/**
 * Lista repetível de dores: cada entrada tem tag (ex.: "dor de cabeça"),
 * intensidade (1-5), local no corpo e duração (ainda dói / até que hora).
 * Duração é um dos dados que médicos mais usam e antes não era capturado.
 * value: [{tagId, intensidade, local, aindaDoi, fim}]
 */
export function createPainListField({ value = [], onChange }) {
  const container = h("div", {});
  const list = h("div", {});
  container.appendChild(list);

  const entries = value.map((v) => ({ ...v }));
  // Mantido em sincronia por referência (nunca reatribuído) para que o
  // autocomplete de baixo sempre exclua as dores já adicionadas.
  const excludeIds = entries.map((e) => e.tagId);
  let tagNames = new Map();

  async function loadTagNames() {
    const tags = await getAllTags("dor");
    tagNames = new Map(tags.map((t) => [t.id, t.nome]));
    renderList();
  }
  loadTagNames();

  function emit() {
    onChange(entries.map(({ tagId, intensidade, local, aindaDoi, fim }) => ({ tagId, intensidade, local, aindaDoi, fim })));
  }

  function renderEntry(entry) {
    const head = h("div", { class: "pain-entry-head" }, [
      h("span", { class: "name", text: tagNames.get(entry.tagId) || "…" }),
      h("button", {
        class: "btn btn-sm btn-danger", type: "button", text: "Remover",
        onClick: () => {
          const idx = entries.indexOf(entry);
          if (idx >= 0) entries.splice(idx, 1);
          excludeIds.splice(excludeIds.indexOf(entry.tagId), 1);
          renderList();
          emit();
        },
      }),
    ]);

    const intensityBtns = [1, 2, 3, 4, 5].map((n) =>
      h("button", {
        type: "button",
        text: String(n),
        class: entry.intensidade === n ? "active" : "",
        onClick: () => {
          entry.intensidade = entry.intensidade === n ? null : n;
          renderList();
          emit();
        },
      })
    );
    const intensityRow = h("div", { class: "pain-sub-row" }, [
      h("label", { text: "Intensidade" }),
      h("div", { class: "mini-scale" }, intensityBtns),
    ]);

    const localSelect = h("select", {
      onChange: (e) => {
        entry.local = e.target.value || null;
        emit();
      },
    }, [
      h("option", { value: "", text: "Local no corpo…" }),
      ...BODY_LOCATIONS.map((loc) =>
        h("option", { value: loc, text: loc, selected: entry.local === loc })
      ),
    ]);
    const localRow = h("div", { class: "pain-sub-row" }, [localSelect]);

    const fimInput = h("input", {
      type: "time", value: entry.fim || "", disabled: Boolean(entry.aindaDoi),
      onInput: (e) => { entry.fim = e.target.value || null; emit(); },
    });
    const aindaDoiChip = h("button", {
      type: "button", class: "toggle-chip" + (entry.aindaDoi ? " active" : ""), text: "Ainda dói",
      onClick: () => {
        entry.aindaDoi = !entry.aindaDoi;
        if (entry.aindaDoi) entry.fim = null;
        renderList();
        emit();
      },
    });
    const duracaoRow = h("div", { class: "pain-sub-row" }, [
      h("label", { text: "Até quando" }),
      aindaDoiChip,
      fimInput,
    ]);

    return h("div", { class: "pain-entry" }, [head, intensityRow, localRow, duracaoRow]);
  }

  function renderList() {
    clear(list);
    entries.forEach((entry) => list.appendChild(renderEntry(entry)));
  }
  renderList();

  const addWrap = createTagAutocomplete({
    categoria: "dor",
    placeholder: "Adicionar dor (ex.: dor de cabeça)…",
    excludeIds,
    onSelect: (tag) => {
      entries.push({ tagId: tag.id, intensidade: null, local: null });
      excludeIds.push(tag.id);
      tagNames.set(tag.id, tag.nome);
      renderList();
      emit();
      addWrap.el.querySelector("input")?.focus();
    },
  });
  container.appendChild(addWrap.el);

  return container;
}
