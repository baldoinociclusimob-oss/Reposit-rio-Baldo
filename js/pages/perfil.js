import { h, mount } from "../ui/dom.js";
import { getSetting, setSetting } from "../db.js";
import { navigate } from "../router.js";
import { debounce } from "../utils/debounce.js";
import { formatCPF, isValidCPF } from "../utils/cpf.js";
import { formatPhone } from "../utils/phone.js";
import { createTagMultiField } from "../ui/tagPicker.js";

const SETTINGS_KEY = "perfil";
const TIPOS_SANGUINEOS = ["Não sei", "A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

function emptyPerfil() {
  return {
    nome: "", idade: null, cpf: "", telefone: "", alergiaIds: [],
    fichaMedica: {
      tipoSanguineo: "", condicoes: "", medicamentos: "",
      contatoEmergenciaNome: "", contatoEmergenciaTelefone: "", convenio: "", observacoes: "",
    },
  };
}

function field(label, control, hint) {
  return h("div", { class: "field" }, [
    h("label", { class: "field-label" }, [label, hint ? h("span", { class: "field-hint", text: ` ${hint}` }) : null]),
    control,
  ]);
}

export async function renderPerfilPage() {
  const app = document.getElementById("app");
  const stored = await getSetting(SETTINGS_KEY, null);
  const perfil = { ...emptyPerfil(), ...stored, fichaMedica: { ...emptyPerfil().fichaMedica, ...stored?.fichaMedica } };

  const savedStatus = h("span", { class: "text-muted", text: stored ? "Salvo" : "Ainda não salvo" });
  const persist = debounce(async () => {
    await setSetting(SETTINGS_KEY, perfil);
    savedStatus.textContent = "Salvo ✓";
  }, 300);

  const header = h("div", { class: "page-header" }, [
    h("a", {
      href: "#/ajustes", class: "back-link", text: "‹ Voltar",
      onClick: (e) => { e.preventDefault(); navigate("/ajustes"); },
    }),
    h("h1", { text: "🧾 Meu perfil" }),
    h("div", { class: "subtitle" }, [
      "Dados de referência e ficha médica, guardados só neste aparelho. ",
      savedStatus,
    ]),
  ]);

  const nomeInput = h("input", { type: "text", value: perfil.nome, placeholder: "Nome completo" });
  nomeInput.addEventListener("input", () => { perfil.nome = nomeInput.value; persist(); });

  const idadeInput = h("input", { type: "number", min: 0, max: 130, value: perfil.idade ?? "", placeholder: "ex.: 34" });
  idadeInput.addEventListener("input", () => {
    const v = idadeInput.value === "" ? null : Number(idadeInput.value);
    perfil.idade = Number.isNaN(v) ? null : v;
    persist();
  });

  const cpfInput = h("input", { type: "text", inputmode: "numeric", value: perfil.cpf, placeholder: "000.000.000-00" });
  const cpfHint = h("span", { class: "field-hint" });
  function updateCpfHint() {
    if (!cpfInput.value) { cpfHint.textContent = ""; return; }
    cpfHint.textContent = isValidCPF(cpfInput.value) ? "" : "CPF incompleto ou inválido";
  }
  updateCpfHint();
  cpfInput.addEventListener("input", () => {
    cpfInput.value = formatCPF(cpfInput.value);
    perfil.cpf = cpfInput.value;
    updateCpfHint();
    persist();
  });

  const telefoneInput = h("input", { type: "tel", value: perfil.telefone, placeholder: "(00) 00000-0000" });
  telefoneInput.addEventListener("input", () => {
    telefoneInput.value = formatPhone(telefoneInput.value);
    perfil.telefone = telefoneInput.value;
    persist();
  });

  const alergiasField = createTagMultiField({
    categoria: "alergia",
    placeholder: "Adicionar alergia (ex.: dipirona, amendoim)…",
    value: perfil.alergiaIds,
    onChange: (ids) => { perfil.alergiaIds = ids; persist(); },
  });

  function textField(obj, key, placeholder, type = "text") {
    const input = h(type === "textarea" ? "textarea" : "input", {
      type: type === "textarea" ? undefined : type,
      value: obj[key] || "",
      placeholder,
    });
    input.addEventListener("input", () => { obj[key] = input.value; persist(); });
    return input;
  }

  const tipoSanguineoSelect = h("select", {
    onChange: (e) => { perfil.fichaMedica.tipoSanguineo = e.target.value; persist(); },
  }, TIPOS_SANGUINEOS.map((t) =>
    h("option", { value: t === "Não sei" ? "" : t, text: t, selected: (perfil.fichaMedica.tipoSanguineo || "") === (t === "Não sei" ? "" : t) })
  ));

  const contatoNomeInput = textField(perfil.fichaMedica, "contatoEmergenciaNome", "Nome do contato de emergência");
  const contatoTelInput = textField(perfil.fichaMedica, "contatoEmergenciaTelefone", "(00) 00000-0000", "tel");
  contatoTelInput.addEventListener("input", () => {
    contatoTelInput.value = formatPhone(contatoTelInput.value);
    perfil.fichaMedica.contatoEmergenciaTelefone = contatoTelInput.value;
  });

  const dadosCard = h("div", { class: "card" }, [
    h("div", { class: "card-title", text: "Dados pessoais" }),
    field("Nome completo", nomeInput),
    field("Idade", idadeInput),
    field("CPF", h("div", {}, [cpfInput, cpfHint])),
    field("Telefone", telefoneInput),
    field("Alergias", alergiasField),
  ]);

  const fichaCard = h("div", { class: "card" }, [
    h("div", { class: "card-title", text: "🩺 Ficha médica" }),
    h("div", { class: "card-sub", text: "Útil em caso de emergência. Preencha o que fizer sentido." }),
    field("Tipo sanguíneo", tipoSanguineoSelect),
    field("Condições médicas / crônicas", textField(perfil.fichaMedica, "condicoes", "ex.: hipertensão, diabetes…", "textarea")),
    field("Medicamentos em uso", textField(perfil.fichaMedica, "medicamentos", "ex.: losartana 50mg, 1x ao dia…", "textarea")),
    field("Contato de emergência — nome", contatoNomeInput),
    field("Contato de emergência — telefone", contatoTelInput),
    field("Convênio médico", textField(perfil.fichaMedica, "convenio", "Opcional")),
    field("Observações médicas", textField(perfil.fichaMedica, "observacoes", "Qualquer outra informação relevante…", "textarea")),
  ]);

  mount(app, header, dadosCard, fichaCard);
}
