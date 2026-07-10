import { h, mount } from "../ui/dom.js";
import { CHECKIN_TYPES } from "../checkinSchema.js";
import { getCheckIn, saveCheckIn } from "../db.js";
import { formatKeyLong, todayKey, isToday, nowHHMM } from "../utils/date.js";
import { renderField } from "../ui/fieldRenderers.js";
import { navigate } from "../router.js";
import { showToast } from "../ui/toast.js";
import { updateBadge } from "../badge.js";

export async function renderCheckinPage({ tipo, date }) {
  const app = document.getElementById("app");
  const config = CHECKIN_TYPES[tipo];
  const dateKey = date || todayKey();

  if (!config) {
    mount(app, h("p", { text: "Check-in inválido." }));
    return;
  }

  const existing = (await getCheckIn(dateKey, tipo)) || {};
  const data = { ...existing };
  const backPath = isToday(dateKey) ? "/hoje" : `/historico/dia/${dateKey}`;

  // Sugere a hora atual como valor inicial do "hora deste check-in" em
  // registros novos de hoje — só vira dado de fato se algum campo for salvo.
  if (!existing.id && isToday(dateKey) && config.fields.some((f) => f.key === "horaCheckin")) {
    data.horaCheckin = nowHHMM();
  }

  const savedStatus = h("span", { class: "text-muted", text: existing.updatedAt ? "Salvo" : "Ainda não salvo" });

  async function persist() {
    const record = await saveCheckIn({ date: dateKey, tipo, ...data });
    savedStatus.textContent = "Salvo ✓";
    Object.assign(existing, record);
    if (isToday(dateKey)) updateBadge();
  }

  const fieldsContainer = h("div", {});
  config.fields.forEach((field) => {
    fieldsContainer.appendChild(
      renderField(field, data[field.key], (val) => {
        data[field.key] = val;
        persist();
      })
    );
  });

  const header = h("div", { class: "page-header" }, [
    h("a", {
      href: `#${backPath}`, class: "back-link", text: "‹ Voltar",
      onClick: (e) => { e.preventDefault(); navigate(backPath); },
    }),
    h("h1", { text: `${config.emoji} ${config.titulo}` }),
    h("div", { class: "subtitle" }, [
      h("span", { text: isToday(dateKey) ? `Hoje, ${formatKeyLong(dateKey)}` : formatKeyLong(dateKey) }),
      h("span", { text: " · " }),
      savedStatus,
    ]),
  ]);

  const doneBtn = h("button", {
    class: "btn btn-primary btn-block", type: "button", text: "Concluir",
    onClick: () => {
      showToast("Check-in salvo");
      navigate(backPath);
    },
  });

  mount(app, header, fieldsContainer, h("div", { class: "fab-save" }, [doneBtn]));
}
