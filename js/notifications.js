// Lembretes locais para os 3 check-ins. Sem servidor/push: funcionam apenas
// enquanto o app estiver aberto no navegador (mesmo que em segundo plano).

import { getSetting, setSetting, getCheckIn } from "./db.js";
import { CHECKIN_ORDER, CHECKIN_TYPES, isCheckInFilled } from "./checkinSchema.js";
import { todayKey } from "./utils/date.js";

const SETTINGS_KEY = "lembretes";
const CHECK_INTERVAL_MS = 30_000;

const DEFAULT_SETTINGS = {
  matinal: { enabled: false, hora: "08:00" },
  vespertino: { enabled: false, hora: "15:00" },
  noturno: { enabled: false, hora: "21:30" },
  lastNotified: {},
};

export function notificationsSupported() {
  return typeof Notification !== "undefined";
}

export async function getReminderSettings() {
  const stored = await getSetting(SETTINGS_KEY, null);
  return { ...DEFAULT_SETTINGS, ...stored, lastNotified: { ...(stored?.lastNotified || {}) } };
}

export async function setReminderSettings(settings) {
  await setSetting(SETTINGS_KEY, settings);
}

export async function requestNotificationPermission() {
  if (!notificationsSupported()) return "unsupported";
  if (Notification.permission === "default") return Notification.requestPermission();
  return Notification.permission;
}

async function checkAndNotify() {
  if (!notificationsSupported() || Notification.permission !== "granted") return;
  const settings = await getReminderSettings();
  const now = new Date();
  const hhmm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const today = todayKey();

  let changed = false;
  for (const tipo of CHECKIN_ORDER) {
    const cfg = settings[tipo];
    if (!cfg?.enabled || cfg.hora !== hhmm) continue;
    if (settings.lastNotified[tipo] === today) continue;

    const existing = await getCheckIn(today, tipo);
    if (isCheckInFilled(existing)) {
      settings.lastNotified[tipo] = today;
      changed = true;
      continue;
    }

    const config = CHECKIN_TYPES[tipo];
    new Notification("Diário Vital", {
      body: `Hora do seu check-in ${config.titulo.replace("Check-in ", "").toLowerCase()} — ${config.descCurta.toLowerCase()}.`,
      icon: "icons/icon.svg",
      tag: `diario-vital-${tipo}-${today}`,
    });
    settings.lastNotified[tipo] = today;
    changed = true;
  }
  if (changed) await setReminderSettings(settings);
}

let started = false;
export function startReminderLoop() {
  if (started) return;
  started = true;
  checkAndNotify();
  setInterval(checkAndNotify, CHECK_INTERVAL_MS);
}
