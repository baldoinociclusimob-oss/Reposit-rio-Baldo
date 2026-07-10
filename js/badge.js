// Badging API: mostra no ícone do app (quando instalado) quantos dos 3
// check-ins de hoje ainda estão pendentes. Reforço visual diário, sem custo.

import { getCheckInsByDate } from "./db.js";
import { CHECKIN_ORDER, isCheckInFilled } from "./checkinSchema.js";
import { todayKey } from "./utils/date.js";

export async function updateBadge() {
  if (!("setAppBadge" in navigator)) return;
  try {
    const records = await getCheckInsByDate(todayKey());
    const byTipo = Object.fromEntries(records.map((r) => [r.tipo, r]));
    const pendentes = CHECKIN_ORDER.filter((tipo) => !isCheckInFilled(byTipo[tipo])).length;
    if (pendentes > 0) await navigator.setAppBadge(pendentes);
    else if ("clearAppBadge" in navigator) await navigator.clearAppBadge();
  } catch {
    // Badging API pode falhar silenciosamente (ex.: sem permissão) — não é crítico.
  }
}
