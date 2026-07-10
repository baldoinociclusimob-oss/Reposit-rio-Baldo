import { MOOD_OPTIONS } from "./checkinSchema.js";

/** Resumo curto de um registro espontâneo, para listas (Hoje / Histórico). */
export function momentoSummaryText(momento, tagById) {
  if (momento.texto && momento.texto.trim()) {
    const t = momento.texto.trim();
    return t.length > 60 ? `${t.slice(0, 60)}…` : t;
  }
  if (momento.dores && momento.dores.length) {
    return momento.dores.map((d) => tagById.get(d.tagId)?.nome || "dor").join(", ");
  }
  if (momento.medicamentos && momento.medicamentos.length) {
    return `💊 ${momento.medicamentos.map((m) => tagById.get(m.tagId)?.nome || "medicamento").join(", ")}`;
  }
  if (momento.humor) {
    return MOOD_OPTIONS.find((o) => o.val === momento.humor)?.label || "Registro";
  }
  if (momento.fotos && momento.fotos.length) {
    return `📷 ${momento.fotos.length} foto${momento.fotos.length > 1 ? "s" : ""}`;
  }
  return "Registro sem detalhes";
}
