// Utilidades de data — tudo em horário local do aparelho, formato de chave YYYY-MM-DD.

export const WEEKDAYS_SHORT = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
export const MONTHS = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

export function pad2(n) {
  return String(n).padStart(2, "0");
}

export function toKey(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

export function todayKey() {
  return toKey(new Date());
}

export function keyToDate(key) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDaysToKey(key, days) {
  const d = keyToDate(key);
  d.setDate(d.getDate() + days);
  return toKey(d);
}

export function formatKeyLong(key) {
  const d = keyToDate(key);
  return `${d.getDate()} de ${MONTHS[d.getMonth()]} de ${d.getFullYear()}`;
}

export function formatKeyShort(key) {
  const d = keyToDate(key);
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}`;
}

export function isToday(key) {
  return key === todayKey();
}

export function weekdayLabel(key) {
  const d = keyToDate(key);
  return WEEKDAYS_SHORT[d.getDay()];
}

/** Retorna array de YYYY-MM-DD dos últimos n dias, incluindo hoje, em ordem crescente. */
export function lastNDayKeys(n) {
  const out = [];
  let key = todayKey();
  for (let i = 0; i < n; i++) {
    out.push(key);
    key = addDaysToKey(key, -1);
  }
  return out.reverse();
}

export function startOfWeek(key) {
  const d = keyToDate(key);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  return toKey(d);
}

export function isoWeekLabel(key) {
  const start = startOfWeek(key);
  return `${formatKeyShort(start)}`;
}
