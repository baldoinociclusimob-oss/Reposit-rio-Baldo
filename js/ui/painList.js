import { h, clear } from "./dom.js";
import { createTagAutocomplete } from "./tagPicker.js";
import { BODY_LOCATIONS } from "../checkinSchema.js";

/**
 * Lista repetível de dores: cada entrada tem tag (ex.: "dor de cabeça"),
 * intensidade (1-5) e local no corpo. value: [{tagId, nome, intensidade, local}]
 */
export function createPainListField({ value = [], onChange }) {
  const container = h("div", {});
  const list = h("div", {});
  container.appendChild(list);

  const entries = value.map((v) => ({ ...v }));

  function emit() {
    onChange(entries.map(({ tagId, nome, intensidade, local }) => ({ tagId, nome, intensidade, local })));
  }

  function renderEntry(entry) {
    const head = h("div", { class: "pain-entry-head" }, [
      h("span", { class: "name", text: entry.nome }),
      h("button", {
        class: "btn btn-sm btn-danger", type: "button", text: "Remover",
        onClick: () => {
          const idx = entries.indexOf(entry);
          if (idx >= 0) entries.splice(idx, 1);
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
        onClick: (e) => {
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

    return h("div", { class: "pain-entry" }, [head, intensityRow, localRow]);
  }

  function renderList() {
    clear(list);
    entries.forEach((entry) => list.appendChild(renderEntry(entry)));
  }
  renderList();

  const addWrap = createTagAutocomplete({
    categoria: "dor",
    placeholder: "Adicionar dor (ex.: dor de cabeça)…",
    excludeIds: entries.map((e) => e.tagId),
    onSelect: (tag) => {
      entries.push({ tagId: tag.id, nome: tag.nome, intensidade: null, local: null });
      renderList();
      emit();
    },
  });
  container.appendChild(addWrap.el);

  return container;
}
