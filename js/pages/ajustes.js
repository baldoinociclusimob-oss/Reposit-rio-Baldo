import { h, mount, clear } from "../ui/dom.js";
import { navigate } from "../router.js";
import { getSetting, setSetting } from "../db.js";
import { showToast } from "../ui/toast.js";
import { exportJSON, exportCSV, importJSON } from "../exportImport.js";
import {
  getReminderSettings, setReminderSettings, requestNotificationPermission, notificationsSupported,
} from "../notifications.js";
import { CHECKIN_ORDER, CHECKIN_TYPES } from "../checkinSchema.js";
import {
  getAuthSettings, setPassword, verifyPassword, disableLock,
  platformBiometricAvailable, enableFaceId, disableFaceId,
} from "../auth.js";
import { ensurePersistentStorage, isStoragePersisted, isIOS, isStandalone } from "../storageProtection.js";
import {
  fileSystemAccessSupported, chooseBackupFolder, getBackupFolderHandle, clearBackupFolder,
  getLastBackupAt, daysSince, BACKUP_NUDGE_DAYS,
} from "../autoBackup.js";
import { gerarICSLembretes, baixarICS } from "../utils/ics.js";

export async function renderAjustesPage() {
  const app = document.getElementById("app");

  const header = h("div", { class: "page-header" }, [h("h1", { text: "Ajustes" })]);

  const perfilCard = h("div", { class: "card" }, [
    h("div", { class: "card-title", text: "🧾 Meu perfil" }),
    h("div", { class: "card-sub", text: "Nome, idade, CPF, telefone, alergias e ficha médica." }),
    h("button", { class: "btn btn-primary", type: "button", text: "Abrir", onClick: () => navigate("/perfil") }),
  ]);

  const securityCard = h("div", { class: "card" }, []);

  const tagsCard = h("div", { class: "card" }, [
    h("div", { class: "card-title", text: "🏷️ Gerenciar tags" }),
    h("div", { class: "card-sub", text: "Renomeie tags de comidas, dores, lugares, atividades e pessoas." }),
    h("button", { class: "btn btn-primary", type: "button", text: "Abrir", onClick: () => navigate("/tags") }),
  ]);

  const protectionCard = h("div", { class: "card" }, []);

  const backupCard = h("div", { class: "card" }, [
    h("div", { class: "card-title", text: "💾 Backup manual" }),
    h("div", { class: "card-sub", text: "Seus dados ficam só neste aparelho. Exporte regularmente para não perder nada." }),
    h("div", { class: "stack" }, [
      h("button", { class: "btn btn-primary btn-block", type: "button", text: "Exportar tudo (JSON)", onClick: async () => { await exportJSON(); showToast("Backup JSON exportado"); await renderProtection(protectionCard); } }),
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

  const cicloCard = h("div", { class: "card" }, []);
  const remindersCard = h("div", { class: "card" }, []);
  mount(app, header, perfilCard, securityCard, protectionCard, backupCard, tagsCard, cicloCard, remindersCard);
  await renderReminders(remindersCard);
  await renderSeguranca(securityCard);
  await renderProtection(protectionCard);
  await renderCicloToggle(cicloCard);
}

async function renderCicloToggle(card) {
  clear(card);
  card.appendChild(h("div", { class: "card-title", text: "🩸 Ciclo menstrual (opcional)" }));
  card.appendChild(h("div", {
    class: "card-sub",
    text: "É um dos fatores mais associados a humor, dor e sono. Ative para registrar o fluxo do dia na tela Hoje e considerá-lo nas Descobertas.",
  }));
  const ativado = await getSetting("cicloAtivado", false);
  const switchInput = h("input", {
    type: "checkbox", checked: ativado,
    onChange: async (e) => { await setSetting("cicloAtivado", e.target.checked); },
  });
  card.appendChild(h("div", { class: "settings-row" }, [
    h("div", { class: "label", text: "Acompanhar ciclo" }),
    h("label", { class: "switch" }, [switchInput, h("span", { class: "track" })]),
  ]));
}

async function renderProtection(card) {
  clear(card);
  card.appendChild(h("div", { class: "card-title", text: "🛡️ Proteção de dados" }));

  const persisted = await isStoragePersisted();
  const statusRow = h("div", { class: "settings-row" }, [
    h("div", {}, [
      h("div", { class: "label", text: "Armazenamento persistente" }),
      h("div", { class: "desc", text: "Pede ao navegador para não apagar seus dados automaticamente." }),
    ]),
    h("span", {
      class: "status-badge " + (persisted ? "done" : "pending"),
      text: persisted === null ? "N/D" : persisted ? "Concedido" : "Negado",
    }),
  ]);
  card.appendChild(statusRow);

  if (persisted === false) {
    card.appendChild(h("button", {
      class: "btn btn-sm btn-ghost", type: "button", text: "Tentar novamente",
      onClick: async () => { await ensurePersistentStorage(); await renderProtection(card); },
    }));
  }

  if (isIOS() && !isStandalone()) {
    card.appendChild(h("p", {
      class: "card-sub",
      text: "⚠️ Você está usando pelo Safari, não instalado. No iPhone, isso significa risco real de o sistema apagar seus dados após um tempo sem abrir o app. Adicione à Tela de Início (veja o aviso no topo da tela Hoje).",
    }));
  }

  const lastBackup = await getLastBackupAt();
  const days = daysSince(lastBackup);
  const backupInfo = h("p", {
    class: "card-sub",
    text: lastBackup
      ? `Último backup: ${days === 0 ? "hoje" : days === 1 ? "há 1 dia" : `há ${days} dias`}.`
      : "Você ainda não fez nenhum backup.",
  });
  if (days !== null && days >= BACKUP_NUDGE_DAYS) {
    backupInfo.style.color = "var(--danger)";
    backupInfo.style.fontWeight = "700";
  }
  card.appendChild(backupInfo);

  if (fileSystemAccessSupported()) {
    const handle = await getBackupFolderHandle();
    if (handle) {
      card.appendChild(h("div", { class: "settings-row" }, [
        h("div", {}, [
          h("div", { class: "label", text: "Backup automático semanal" }),
          h("div", { class: "desc", text: `Pasta: ${handle.name}` }),
        ]),
        h("button", {
          class: "btn btn-sm btn-ghost", type: "button", text: "Remover",
          onClick: async () => { await clearBackupFolder(); showToast("Backup automático desativado"); await renderProtection(card); },
        }),
      ]));
    } else {
      card.appendChild(h("button", {
        class: "btn btn-block", type: "button", text: "📁 Escolher pasta para backup automático semanal",
        onClick: async () => {
          try {
            await chooseBackupFolder();
            showToast("Pasta configurada — o backup roda sozinho a cada 7 dias");
            await renderProtection(card);
          } catch {
            // usuário cancelou o seletor de pasta
          }
        },
      }));
    }
  }
}

async function renderSeguranca(card) {
  clear(card);
  card.appendChild(h("div", { class: "card-title", text: "🔒 Segurança" }));

  const authSettings = await getAuthSettings();
  const bioAvailable = await platformBiometricAvailable();

  if (!authSettings.enabled) {
    card.appendChild(h("div", {
      class: "card-sub",
      text: "Peça uma senha para abrir o app. Sem servidor, não há como recuperar uma senha esquecida — guarde bem.",
    }));
    const newPass = h("input", { type: "password", placeholder: "Nova senha", autocomplete: "new-password" });
    const confirmPass = h("input", { type: "password", placeholder: "Confirmar senha", autocomplete: "new-password" });
    const errorMsg = h("p", { class: "lock-error hidden" });
    card.appendChild(h("div", { class: "security-setup-form stack" }, [
      newPass, confirmPass, errorMsg,
      h("button", {
        class: "btn btn-primary btn-block", type: "button", text: "Ativar senha",
        onClick: async () => {
          if (newPass.value.length < 4) {
            errorMsg.textContent = "Use pelo menos 4 caracteres.";
            errorMsg.classList.remove("hidden");
            return;
          }
          if (newPass.value !== confirmPass.value) {
            errorMsg.textContent = "As senhas não coincidem.";
            errorMsg.classList.remove("hidden");
            return;
          }
          await setPassword(newPass.value);
          showToast("Senha ativada");
          await renderSeguranca(card);
        },
      }),
    ]));
    return;
  }

  card.appendChild(h("div", { class: "security-status", text: "🔓 Protegido por senha" }));

  const changeErrorMsg = h("p", { class: "lock-error hidden" });
  const currentPass = h("input", { type: "password", placeholder: "Senha atual", autocomplete: "current-password" });
  const newPass = h("input", { type: "password", placeholder: "Nova senha", autocomplete: "new-password" });
  const confirmPass = h("input", { type: "password", placeholder: "Confirmar nova senha", autocomplete: "new-password" });

  card.appendChild(h("div", { class: "security-setup-form stack" }, [
    currentPass, newPass, confirmPass, changeErrorMsg,
    h("div", { class: "row" }, [
      h("button", {
        class: "btn btn-primary", type: "button", text: "Alterar senha",
        onClick: async () => {
          const ok = await verifyPassword(currentPass.value);
          if (!ok) { changeErrorMsg.textContent = "Senha atual incorreta."; changeErrorMsg.classList.remove("hidden"); return; }
          if (newPass.value.length < 4) { changeErrorMsg.textContent = "Use pelo menos 4 caracteres."; changeErrorMsg.classList.remove("hidden"); return; }
          if (newPass.value !== confirmPass.value) { changeErrorMsg.textContent = "As senhas não coincidem."; changeErrorMsg.classList.remove("hidden"); return; }
          await setPassword(newPass.value);
          showToast("Senha alterada");
          await renderSeguranca(card);
        },
      }),
      h("button", {
        class: "btn btn-danger", type: "button", text: "Remover proteção",
        onClick: async () => {
          try {
            await disableLock(currentPass.value);
            showToast("Proteção por senha removida");
            await renderSeguranca(card);
          } catch (err) {
            changeErrorMsg.textContent = err.message;
            changeErrorMsg.classList.remove("hidden");
          }
        },
      }),
    ]),
  ]));

  if (bioAvailable) {
    if (authSettings.faceId) {
      card.appendChild(h("div", { class: "settings-row" }, [
        h("div", { class: "label", text: "Face ID / Touch ID ativado" }),
        h("button", {
          class: "btn btn-sm btn-ghost", type: "button", text: "Desativar",
          onClick: async () => { await disableFaceId(); showToast("Face ID/Touch ID desativado"); await renderSeguranca(card); },
        }),
      ]));
    } else {
      card.appendChild(h("button", {
        class: "btn btn-block", type: "button", text: "🔐 Habilitar Face ID / Touch ID", style: "margin-top:12px;",
        onClick: async () => {
          try {
            await enableFaceId();
            showToast("Face ID/Touch ID habilitado");
            await renderSeguranca(card);
          } catch {
            showToast("Não foi possível habilitar — tente novamente");
          }
        },
      }));
    }
  }
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
