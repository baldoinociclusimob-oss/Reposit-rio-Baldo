import { h, mount } from "../ui/dom.js";
import { MOMENTO_SCHEMA } from "../checkinSchema.js";
import { getMomento, saveMomento, deleteMomento } from "../db.js";
import { formatKeyLong, todayKey, isToday, nowHHMM } from "../utils/date.js";
import { renderField } from "../ui/fieldRenderers.js";
import { navigate } from "../router.js";
import { showToast } from "../ui/toast.js";

/**
 * id: presente ao editar um registro espontâneo existente.
 * date: usado só ao criar um novo (padrão hoje).
 * focus: chave de um campo (ex.: "medicamentos") para rolar/focar ao abrir —
 * usado pelo atalho "💊 Tomei um remédio" da tela Hoje.
 */
export async function renderMomentoPage({ id, date, focus }) {
  const app = document.getElementById("app");

  const existing = id ? await getMomento(id) : null;
  const dateKey = existing?.date || date || todayKey();
  const backPath = isToday(dateKey) ? "/hoje" : `/historico/dia/${dateKey}`;

  const data = existing ? { ...existing } : { date: dateKey, horario: nowHHMM() };
  let savedId = existing?.id || null;

  const savedStatus = h("span", { class: "text-muted", text: existing ? "Salvo" : "Ainda não salvo" });

  async function persist() {
    const record = await saveMomento({ ...data, id: savedId, date: dateKey });
    savedId = record.id;
    savedStatus.textContent = "Salvo ✓";
  }

  const fieldsContainer = h("div", {});
  let focusEl = null;
  MOMENTO_SCHEMA.fields.forEach((field) => {
    const el = renderField(field, data[field.key], (val) => {
      data[field.key] = val;
      persist();
    });
    if (field.key === focus) focusEl = el;
    fieldsContainer.appendChild(el);
  });

  const header = h("div", { class: "page-header" }, [
    h("a", {
      href: `#${backPath}`, class: "back-link", text: "‹ Voltar",
      onClick: (e) => { e.preventDefault(); navigate(backPath); },
    }),
    h("h1", { text: `${MOMENTO_SCHEMA.emoji} ${MOMENTO_SCHEMA.titulo}` }),
    h("div", { class: "subtitle" }, [
      h("span", { text: isToday(dateKey) ? `Hoje, ${formatKeyLong(dateKey)}` : formatKeyLong(dateKey) }),
      h("span", { text: " · " }),
      savedStatus,
    ]),
  ]);

  const doneBtn = h("button", {
    class: "btn btn-primary btn-block", type: "button", text: "Concluir",
    onClick: () => {
      showToast(savedId ? "Registro salvo" : "Nada foi preenchido, então nada foi salvo");
      navigate(backPath);
    },
  });

  const actions = [doneBtn];
  if (existing) {
    actions.push(
      h("button", {
        class: "btn btn-danger btn-block", type: "button", text: "Excluir este registro",
        onClick: async () => {
          if (!confirm("Excluir este registro espontâneo? Essa ação não pode ser desfeita.")) return;
          await deleteMomento(existing.id);
          showToast("Registro excluído");
          navigate(backPath);
        },
      })
    );
  }

  mount(app, header, fieldsContainer, h("div", { class: "fab-save stack" }, actions));

  if (focusEl) {
    focusEl.scrollIntoView({ behavior: "smooth", block: "center" });
    focusEl.querySelector("input, textarea, select, button")?.focus();
  }
}
