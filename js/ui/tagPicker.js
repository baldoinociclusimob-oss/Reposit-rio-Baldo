import { h, clear } from "./dom.js";
import { findOrCreateTag, getAllTags } from "../db.js";
import { normalize } from "../utils/text.js";

/**
 * Campo de texto com autocompletar de tags de uma categoria. Ao escolher uma
 * sugestão (ou criar uma nova digitando e confirmando), chama onSelect(tag)
 * e limpa o campo. Mantém os dados consistentes reaproveitando tags existentes.
 */
export function createTagAutocomplete({ categoria, placeholder, onSelect, excludeIds = [] }) {
  const wrap = h("div", { class: "tag-input-wrap" });
  const input = h("input", { type: "text", placeholder: placeholder || "Digite para buscar ou criar…" });
  const suggestions = h("div", { class: "tag-suggestions hidden" });
  wrap.append(input, suggestions);

  let allTags = [];
  let highlightIndex = -1;

  async function loadTags() {
    allTags = await getAllTags(categoria);
  }
  loadTags();

  function currentMatches() {
    const q = normalize(input.value);
    const excluded = new Set(excludeIds);
    let list = allTags.filter((t) => !excluded.has(t.id));
    if (q) list = list.filter((t) => normalize(t.nome).includes(q));
    list = list.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")).slice(0, 8);
    return list;
  }

  function exactMatchExists(q) {
    return allTags.some((t) => normalize(t.nome) === q);
  }

  function renderSuggestions() {
    clear(suggestions);
    const q = normalize(input.value);
    const matches = currentMatches();
    const items = [];

    matches.forEach((tag, i) => {
      items.push(
        h("div", {
          class: "tag-suggestion-item" + (i === highlightIndex ? " highlight" : ""),
          onMousedown: (e) => {
            e.preventDefault();
            choose(tag);
          },
        }, [h("span", { text: tag.nome })])
      );
    });

    if (q && !exactMatchExists(q)) {
      const createIdx = matches.length;
      items.push(
        h("div", {
          class: "tag-suggestion-item" + (createIdx === highlightIndex ? " highlight" : ""),
          onMousedown: (e) => {
            e.preventDefault();
            createAndChoose(input.value);
          },
        }, [
          h("span", { text: `Criar "${input.value.trim()}"` }),
          h("span", { class: "new-badge", text: "novo" }),
        ])
      );
    }

    if (items.length === 0) {
      suggestions.classList.add("hidden");
      return;
    }
    items.forEach((it) => suggestions.appendChild(it));
    suggestions.classList.remove("hidden");
  }

  async function choose(tag) {
    input.value = "";
    suggestions.classList.add("hidden");
    highlightIndex = -1;
    onSelect(tag);
  }

  async function createAndChoose(nome) {
    const tag = await findOrCreateTag(categoria, nome);
    await loadTags();
    input.value = "";
    suggestions.classList.add("hidden");
    highlightIndex = -1;
    if (tag) onSelect(tag);
  }

  input.addEventListener("input", () => {
    highlightIndex = -1;
    renderSuggestions();
  });
  input.addEventListener("focus", renderSuggestions);
  input.addEventListener("blur", () => {
    setTimeout(() => suggestions.classList.add("hidden"), 120);
  });
  input.addEventListener("keydown", (e) => {
    const matches = currentMatches();
    const q = normalize(input.value);
    const hasCreate = q && !exactMatchExists(q);
    const total = matches.length + (hasCreate ? 1 : 0);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (total > 0) highlightIndex = (highlightIndex + 1) % total;
      renderSuggestions();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (total > 0) highlightIndex = (highlightIndex - 1 + total) % total;
      renderSuggestions();
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlightIndex >= 0 && highlightIndex < matches.length) {
        choose(matches[highlightIndex]);
      } else if (input.value.trim()) {
        if (hasCreate) createAndChoose(input.value);
        else if (matches.length) choose(matches[0]);
      }
    } else if (e.key === "Escape") {
      suggestions.classList.add("hidden");
    }
  });

  return { el: wrap, refresh: loadTags };
}

/** Chip de tag selecionada, com "x" para remover. */
export function tagChip(nome, onRemove) {
  return h("span", { class: "tag-chip active" }, [
    h("span", { text: nome }),
    onRemove ? h("span", { class: "remove", text: "×", onClick: onRemove }) : null,
  ]);
}

/**
 * Campo completo de múltiplas tags: chips das selecionadas + autocompletar para adicionar.
 * value: array de tagIds. onChange(newArray) é chamado a cada alteração.
 */
export function createTagMultiField({ categoria, placeholder, value = [], onChange }) {
  const container = h("div", {});
  const chipList = h("div", { class: "tag-chip-list" });
  container.appendChild(chipList);

  // Array mutado in-place (nunca reatribuído) para que o closure de excludeIds
  // dentro do autocomplete sempre veja o estado atual.
  let selectedIds = [];
  selectedIds.push(...value);
  let tagCache = new Map();

  async function primeCache() {
    const all = await getAllTags(categoria);
    all.forEach((t) => tagCache.set(t.id, t));
    renderChips();
  }

  function renderChips() {
    clear(chipList);
    selectedIds.forEach((id) => {
      const tag = tagCache.get(id);
      const label = tag ? tag.nome : "…";
      chipList.appendChild(
        tagChip(label, () => {
          selectedIds.splice(selectedIds.indexOf(id), 1);
          renderChips();
          onChange([...selectedIds]);
        })
      );
    });
  }

  const autocomplete = createTagAutocomplete({
    categoria,
    placeholder,
    excludeIds: selectedIds,
    onSelect: (tag) => {
      tagCache.set(tag.id, tag);
      if (!selectedIds.includes(tag.id)) selectedIds.push(tag.id);
      renderChips();
      onChange([...selectedIds]);
      autocomplete.el.querySelector("input")?.focus();
    },
  });

  container.appendChild(autocomplete.el);
  primeCache();

  return container;
}
