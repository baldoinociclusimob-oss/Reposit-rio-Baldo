import { h, clear } from "./dom.js";
import { createTagAutocomplete } from "./tagPicker.js";
import { getAllTags } from "../db.js";

/**
 * Lista repetível de medicamentos tomados: tag (nome do remédio) + dose em
 * texto livre. value: [{tagId, dose}]
 */
export function createMedsListField({ value = [], onChange }) {
  const container = h("div", {});
  const list = h("div", {});
  container.appendChild(list);

  const entries = value.map((v) => ({ ...v }));
  const excludeIds = entries.map((e) => e.tagId);
  let tagNames = new Map();

  async function loadTagNames() {
    const tags = await getAllTags("medicamento");
    tagNames = new Map(tags.map((t) => [t.id, t.nome]));
    renderList();
  }
  loadTagNames();

  function emit() {
    onChange(entries.map(({ tagId, dose }) => ({ tagId, dose })));
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

    const doseInput = h("input", {
      type: "text", placeholder: "Dose (ex.: 1 comprimido, 500mg)…", value: entry.dose || "",
      onInput: (e) => { entry.dose = e.target.value; emit(); },
    });
    const doseRow = h("div", { class: "pain-sub-row" }, [doseInput]);

    return h("div", { class: "pain-entry" }, [head, doseRow]);
  }

  function renderList() {
    clear(list);
    entries.forEach((entry) => list.appendChild(renderEntry(entry)));
  }
  renderList();

  const addWrap = createTagAutocomplete({
    categoria: "medicamento",
    placeholder: "Adicionar medicamento (ex.: dipirona)…",
    excludeIds,
    onSelect: (tag) => {
      entries.push({ tagId: tag.id, dose: "" });
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
