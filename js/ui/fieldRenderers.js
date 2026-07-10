import { h, clear } from "./dom.js";
import { MOOD_OPTIONS } from "../checkinSchema.js";
import { createTagMultiField } from "./tagPicker.js";
import { createPainListField } from "./painList.js";
import { createMedsListField } from "./medsList.js";
import { createPhotoListField } from "./photoList.js";
import { debounce } from "../utils/debounce.js";

const BOOL3_OPTIONS = [
  { val: "sim", label: "Sim" },
  { val: "nao", label: "Não" },
  { val: "nao_sei", label: "Não sei" },
];

let fieldIdCounter = 0;

/** Quando control é um <input>/<textarea>/<select> direto, associa via
 * for/id (padrão mais robusto para leitores de tela); nos campos compostos
 * (escalas, tags, listas) o label continua descrevendo o grupo visualmente. */
function fieldWrap(label, control) {
  const labelProps = { class: "field-label", text: label };
  if (["INPUT", "TEXTAREA", "SELECT"].includes(control.tagName)) {
    const id = `field-${++fieldIdCounter}`;
    control.id = id;
    labelProps.for = id;
  }
  return h("div", { class: "field" }, [h("label", labelProps), control]);
}

function renderScale5(field, value, onChange) {
  const row = h("div", { class: "scale-row" });
  function paint() {
    clear(row);
    [1, 2, 3, 4, 5].forEach((n) => {
      row.appendChild(
        h("button", {
          type: "button",
          class: "scale-btn" + (value === n ? " active" : ""),
          dataset: { val: String(n) },
          text: String(n),
          onClick: () => {
            value = value === n ? null : n;
            onChange(value);
            paint();
          },
        })
      );
    });
  }
  paint();
  return fieldWrap(field.label, row);
}

function renderMood(field, value, onChange) {
  const row = h("div", { class: "mood-row" });
  function paint() {
    clear(row);
    MOOD_OPTIONS.forEach((opt) => {
      row.appendChild(
        h("button", {
          type: "button",
          class: "mood-btn" + (value === opt.val ? " active" : ""),
          onClick: () => {
            value = value === opt.val ? null : opt.val;
            onChange(value);
            paint();
          },
        }, [
          h("span", { class: "emoji", text: opt.emoji }),
          h("span", { class: "lbl", text: opt.label }),
        ])
      );
    });
  }
  paint();
  return fieldWrap(field.label, row);
}

function renderBoolean3(field, value, onChange) {
  const row = h("div", { class: "choice-row" });
  function paint() {
    clear(row);
    BOOL3_OPTIONS.forEach((opt) => {
      row.appendChild(
        h("button", {
          type: "button",
          class: "choice-btn" + (value === opt.val ? " active" : ""),
          text: opt.label,
          onClick: () => {
            value = value === opt.val ? null : opt.val;
            onChange(value);
            paint();
          },
        })
      );
    });
  }
  paint();
  return fieldWrap(field.label, row);
}

function renderNumber(field, value, onChange) {
  const input = h("input", {
    type: "number",
    min: field.min,
    max: field.max,
    step: field.step || 1,
    placeholder: field.placeholder || "",
    value: value ?? "",
  });
  const emit = debounce(() => {
    const v = input.value === "" ? null : Number(input.value);
    onChange(Number.isNaN(v) ? null : v);
  }, 300);
  input.addEventListener("input", emit);
  return fieldWrap(field.label, input);
}

function renderTime(field, value, onChange) {
  const input = h("input", { type: "time", value: value || "" });
  const emit = debounce(() => onChange(input.value || null), 250);
  input.addEventListener("input", emit);
  return fieldWrap(field.label, input);
}

function renderText(field, value, onChange) {
  const textarea = h("textarea", { placeholder: field.placeholder || "", value: value || "" });
  const emit = debounce(() => onChange(textarea.value), 350);
  textarea.addEventListener("input", emit);
  return fieldWrap(field.label, textarea);
}

function renderTagsMulti(field, value, onChange) {
  const control = createTagMultiField({
    categoria: field.categoria,
    placeholder: `Adicionar ${field.label.toLowerCase()}…`,
    value: value || [],
    onChange,
  });
  return fieldWrap(field.label, control);
}

function renderPainList(field, value, onChange) {
  const control = createPainListField({ value: value || [], onChange });
  return fieldWrap(field.label, control);
}

function renderMedsList(field, value, onChange) {
  const control = createMedsListField({ value: value || [], onChange });
  return fieldWrap(field.label, control);
}

function renderPhotoList(field, value, onChange) {
  const control = createPhotoListField({ value: value || [], onChange });
  return fieldWrap(field.label, control);
}

const RENDERERS = {
  scale5: renderScale5,
  mood: renderMood,
  boolean3: renderBoolean3,
  number: renderNumber,
  time: renderTime,
  text: renderText,
  "tags-multi": renderTagsMulti,
  "pain-list": renderPainList,
  "meds-list": renderMedsList,
  "photo-list": renderPhotoList,
};

export function renderField(field, value, onChange) {
  const renderer = RENDERERS[field.type];
  if (!renderer) throw new Error(`Tipo de campo desconhecido: ${field.type}`);
  return renderer(field, value, onChange);
}
