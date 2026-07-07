import { h, mount, clear } from "../ui/dom.js";
import { navigate } from "../router.js";
import { showToast } from "../ui/toast.js";
import { exportJSON, exportCSV, importJSON } from "../exportImport.js";
import {
  getReminderSettings, setReminderSettings, requestNotificationPermission, notificationsSupported,
} from "../notifications.js";
import { CHECKIN_ORDER, CHECKIN_TYPES } from "../checkinSchema.js";

export async function renderAjustesPage() {
  const app = document.getElementById("app");

  const header = h("div", { class: "page-header" }, [h("h1", { text: "Ajustes" })]);

  const tagsCard = h("div", { class: "card" }, [
    h("div", { class: "card-title", text: "🏷️ Gerenciar tags" }),
    h("div", { class: "card-sub", text: "Renomeie tags de comidas, dores, lugares, atividades e pessoas." }),
    h("button", { class: "btn btn-primary", type: "button", text: "Abrir", onClick: () => navigate("/tags") }),
  ]);

  const backupCard = h("div", { class: "card" }, [
    h("div", { class: "card-title", text: "💾 Backup dos dados" }),
    h("div", { class: "card-sub", text: "Seus dados ficam só neste aparelho. Exporte regularmente para não perder nada." }),
    h("div", { class: "stack" }, [
      h("button", { class: "btn btn-primary btn-block", type: "button", text: "Exportar tudo (JSON)", onClick: async () => { await exportJSON(); showToast("Backup JSON exportado"); } }),
      h("button", { class: "btn btn-block", type: "button", text: "Exportar planilha (CSV)", onClick: async () => { await exportCSV(); showToast("Planilha CSV exportada"); } }),
      h("label", { class: "btn btn-ghost btn-block", style: "cursor:pointer;" }, [
        "Importar backup (JSON)",
        h("input", {
          type: "file", accept: "application/json", class: "hidden",
          onChange: async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const ok = confirm("Importar este backup vai mesclar os dados do arquivo com os que já estão neste aparelho (registros com o mesmo dia/tipo serão substituídos). Deseja continuar?");
            if (!ok) { e.target.value = ""; return; }
            try {
              const result = await importJSON(file);
              showToast(`Importado: ${result.checkinsCount} check-ins, ${result.momentosCount} registros espontâneos, ${result.tagsCount} tags`);
            } catch (err) {
              alert(err.message);
            }
            e.target.value = "";
          },
        }),
      ]),
    ]),
  ]);

  const remindersCard = h("div", { class: "card" }, []);
  mount(app, header, tagsCard, backupCard, remindersCard);
  await renderReminders(remindersCard);
}

async function renderReminders(card) {
  clear(card);
  card.appendChild(h("div", { class: "card-title", text: "🔔 Lembretes" }));

  if (!notificationsSupported()) {
    card.appendChild(h("div", { class: "card-sub", text: "Este navegador não suporta notificações." }));
    return;
  }

  card.appendChild(h("div", {
    class: "card-sub",
    text: "Avisos opcionais nos horários dos check-ins. Funcionam enquanto o Diário Vital estiver aberto no navegador.",
  }));

  const settings = await getReminderSettings();

  for (const tipo of CHECKIN_ORDER) {
    const config = CHECKIN_TYPES[tipo];
    const cfg = settings[tipo];

    const timeInput = h("input", {
      type: "time", value: cfg.hora, style: "width:110px;",
      onChange: async (e) => {
        settings[tipo].hora = e.target.value;
        await setReminderSettings(settings);
      },
    });

    const switchInput = h("input", {
      type: "checkbox", checked: cfg.enabled,
      onChange: async (e) => {
        if (e.target.checked && Notification.permission !== "granted") {
          const perm = await requestNotificationPermission();
          if (perm !== "granted") {
            e.target.checked = false;
            showToast("Permissão de notificação negada");
            return;
          }
        }
        settings[tipo].enabled = e.target.checked;
        await setReminderSettings(settings);
      },
    });

    const row = h("div", { class: "settings-row" }, [
      h("div", {}, [
        h("div", { class: "label", text: `${config.emoji} ${config.titulo}` }),
        h("div", { class: "desc", text: config.janela }),
      ]),
      h("div", { class: "row", style: "align-items:center;" }, [
        timeInput,
        h("label", { class: "switch" }, [switchInput, h("span", { class: "track" })]),
      ]),
    ]);
    card.appendChild(row);
  }
}
