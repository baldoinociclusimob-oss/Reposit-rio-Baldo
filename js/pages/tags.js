import { h, mount, clear } from "../ui/dom.js";
import { getAllTags, renameTag } from "../db.js";
import { navigate } from "../router.js";
import { showToast } from "../ui/toast.js";

const CATEGORIES = [
  { key: "comida", label: "Comidas" },
  { key: "dor", label: "Dores" },
  { key: "lugar", label: "Lugares" },
  { key: "atividade", label: "Atividades" },
  { key: "pessoa", label: "Pessoas" },
  { key: "alergia", label: "Alergias" },
];

export async function renderTagsPage() {
  const app = document.getElementById("app");

  const header = h("div", { class: "page-header" }, [
    h("a", {
      href: "#/ajustes", class: "back-link", text: "‹ Voltar",
      onClick: (e) => { e.preventDefault(); navigate("/ajustes"); },
    }),
    h("h1", { text: "Gerenciar tags" }),
    h("div", { class: "subtitle", text: "Renomeie tags para manter seus dados consistentes." }),
  ]);

  const sectionsWrap = h("div", {});
  mount(app, header, sectionsWrap);

  async function renderSections() {
    clear(sectionsWrap);
    for (const cat of CATEGORIES) {
      const tags = (await getAllTags(cat.key)).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
      const card = h("div", { class: "card" }, [
        h("div", { class: "card-title", text: `${cat.label} (${tags.length})` }),
      ]);
      if (tags.length === 0) {
        card.appendChild(h("p", { class: "card-sub", text: "Nenhuma tag criada ainda." }));
      } else {
        tags.forEach((tag) => card.appendChild(renderTagRow(tag)));
      }
      sectionsWrap.appendChild(card);
    }
  }

  function renderTagRow(tag) {
    const row = h("div", { class: "settings-row" });
    const label = h("span", { class: "label", text: tag.nome });
    const editBtn = h("button", {
      class: "btn btn-sm btn-ghost", type: "button", text: "Renomear",
      onClick: () => startEdit(),
    });
    row.append(label, editBtn);

    function startEdit() {
      clear(row);
      const input = h("input", { type: "text", value: tag.nome });
      const saveBtn = h("button", {
        class: "btn btn-sm btn-primary", type: "button", text: "Salvar",
        onClick: async () => {
          const novo = input.value.trim();
          if (!novo || novo === tag.nome) { await renderSections(); return; }
          await renameTag(tag.id, novo);
          showToast("Tag renomeada");
          await renderSections();
        },
      });
      const cancelBtn = h("button", {
        class: "btn btn-sm btn-ghost", type: "button", text: "Cancelar",
        onClick: () => renderSections(),
      });
      row.append(input, saveBtn, cancelBtn);
      input.focus();
      input.select();
    }

    return row;
  }

  await renderSections();
}
