// Exportação e importação manuais dos dados — o único jeito de tirar uma
// cópia dos dados do aparelho, já que tudo fica local (sem nuvem, sem servidor).

import { exportAllData, bulkPutCheckIns, bulkPutTags, bulkPutMomentos, bulkPutCiclo, momentosFromImport } from "./db.js";
import { CHECKIN_TYPES } from "./checkinSchema.js";
import { markBackupDone } from "./autoBackup.js";

function downloadBlob(content, filename, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function todayStamp() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export async function exportJSON() {
  const data = await exportAllData();
  downloadBlob(JSON.stringify(data, null, 2), `diario-vital-backup-${todayStamp()}.json`, "application/json");
  await markBackupDone();
}

function csvEscape(value) {
  const str = value === null || value === undefined ? "" : String(value);
  if (/[",\n;]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

export async function exportCSV() {
  const data = await exportAllData();
  const tagById = new Map(data.tags.map((t) => [t.id, t.nome]));

  function tagName(id) { return tagById.get(id) || id; }
  function tagList(ids) { return (ids || []).map(tagName).join("; "); }
  function painList(entries) {
    return (entries || [])
      .map((p) => {
        const detalhes = [];
        if (p.intensidade) detalhes.push(`intensidade ${p.intensidade}`);
        if (p.local) detalhes.push(p.local);
        if (p.aindaDoi) detalhes.push("ainda dói");
        else if (p.fim) detalhes.push(`até ${p.fim}`);
        return `${tagName(p.tagId)}${detalhes.length ? ` (${detalhes.join(", ")})` : ""}`;
      })
      .join("; ");
  }
  function foodList(entries) {
    return (entries || []).map((tagId) => tagName(tagId)).join("; ");
  }
  function medsList(entries) {
    return (entries || []).map((m) => `${tagName(m.tagId)}${m.dose ? ` (${m.dose})` : ""}`).join("; ");
  }

  const columns = [
    "data", "hora", "tipo",
    "qualidade_sono", "horas_dormidas", "acordou_meio_da_noite", "sonhou", "hora_acordou", "hora_dormir",
    "humor", "energia", "nota_geral", "estresse",
    "cafe_da_manha", "almoco", "jantar", "medicamentos",
    "dores", "lugares", "atividades", "pessoas",
    "momento_bom", "momento_ruim", "observacoes",
  ];

  const rows = [columns.join(",")];

  data.checkins
    .sort((a, b) => (a.date + a.tipo).localeCompare(b.date + b.tipo))
    .forEach((c) => {
      const humor = c.tipo === "matinal" ? c.humorAcordar : c.humor;
      const dores = c.tipo === "matinal" ? c.doresAcordar : c.dores;
      const row = [
        c.date,
        c.horaCheckin ?? "",
        c.tipo,
        c.sonoQualidade ?? "",
        c.horasDormidas ?? "",
        c.acordouMeio ?? "",
        c.sonhou ?? "",
        c.horaAcordou ?? "",
        c.horaDormir ?? "",
        humor ?? "",
        c.energia ?? "",
        c.notaGeral ?? "",
        c.estresse ?? "",
        foodList(c.cafeDaManha),
        foodList(c.almoco),
        foodList(c.jantar),
        "",
        painList(dores),
        tagList(c.lugares),
        tagList(c.atividades),
        tagList(c.pessoas),
        c.momentoBom ?? "",
        c.momentoRuim ?? "",
        c.observacoes ?? "",
      ].map(csvEscape);
      rows.push(row.join(","));
    });

  (data.momentos || [])
    .sort((a, b) => (a.date + (a.horario || "")).localeCompare(b.date + (b.horario || "")))
    .forEach((m) => {
      const row = [
        m.date, m.horario ?? "", "momento",
        "", "", "", "", "", "",
        m.humor ?? "", "", "", "",
        foodList(m.comidas), "", "", medsList(m.medicamentos),
        painList(m.dores), "", tagList(m.atividades), "",
        "", "", m.texto ?? "",
      ].map(csvEscape);
      rows.push(row.join(","));
    });

  downloadBlob("﻿" + rows.join("\n"), `diario-vital-checkins-${todayStamp()}.csv`, "text/csv;charset=utf-8");
}

/** Importa um backup JSON exportado por este mesmo app. Mescla com os dados existentes (por id). */
export async function importJSON(file) {
  const text = await file.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("Arquivo inválido: não é um JSON legível.");
  }
  if (!data || !Array.isArray(data.checkins) || !Array.isArray(data.tags)) {
    throw new Error("Arquivo inválido: formato de backup do Diário Vital não reconhecido.");
  }

  const validTipos = new Set(Object.keys(CHECKIN_TYPES));
  const checkins = data.checkins.filter((c) => c && c.date && validTipos.has(c.tipo));
  const tags = data.tags.filter((t) => t && t.id && t.categoria && t.nome);
  const momentosRaw = Array.isArray(data.momentos) ? data.momentos.filter((m) => m && m.id && m.date) : [];
  const momentos = momentosFromImport(momentosRaw);
  const ciclo = Array.isArray(data.ciclo) ? data.ciclo.filter((c) => c && c.date) : [];

  await bulkPutTags(tags);
  await bulkPutCheckIns(checkins);
  if (momentos.length) await bulkPutMomentos(momentos);
  if (ciclo.length) await bulkPutCiclo(ciclo);

  return { checkinsCount: checkins.length, tagsCount: tags.length, momentosCount: momentos.length };
}
