// Definição declarativa dos 3 check-ins. Um único formulário genérico (js/pages/checkin.js)
// sabe renderizar qualquer um deles a partir desta configuração — evita repetir 3 telas quase iguais.

export const BODY_LOCATIONS = [
  "Cabeça", "Rosto", "Pescoço", "Ombro", "Braço", "Mão",
  "Peito", "Costas", "Abdômen", "Quadril", "Perna", "Pé", "Outro",
];

export const MOOD_OPTIONS = [
  { val: 1, emoji: "😞", label: "Muito mal" },
  { val: 2, emoji: "🙁", label: "Mal" },
  { val: 3, emoji: "😐", label: "Neutro" },
  { val: 4, emoji: "🙂", label: "Bem" },
  { val: 5, emoji: "😄", label: "Muito bem" },
];

export const CHECKIN_TYPES = {
  matinal: {
    tipo: "matinal",
    titulo: "Check-in Matinal",
    emoji: "🌅",
    descCurta: "Como foi a sua noite",
    janela: "ao acordar",
    fields: [
      { key: "sonoQualidade", type: "scale5", label: "Qualidade do sono" },
      { key: "horasDormidas", type: "number", label: "Horas dormidas", min: 0, max: 24, step: 0.5, placeholder: "ex.: 7.5" },
      { key: "acordouMeio", type: "boolean3", label: "Acordou no meio da noite?" },
      { key: "humorAcordar", type: "mood", label: "Humor ao acordar" },
      { key: "energia", type: "scale5", label: "Energia" },
      { key: "doresAcordar", type: "pain-list", label: "Dores ao acordar", categoria: "dor" },
      { key: "sonhou", type: "boolean3", label: "Sonhou?" },
      { key: "observacoes", type: "text", label: "Observações", placeholder: "Algo mais que queira registrar…" },
    ],
  },
  vespertino: {
    tipo: "vespertino",
    titulo: "Check-in Vespertino",
    emoji: "🌤️",
    descCurta: "Como está o seu dia",
    janela: "durante o dia",
    fields: [
      { key: "humor", type: "mood", label: "Humor agora" },
      { key: "energia", type: "scale5", label: "Energia agora" },
      { key: "cafeDaManha", type: "tags-multi", categoria: "comida", label: "O que comeu no café da manhã" },
      { key: "almoco", type: "tags-multi", categoria: "comida", label: "O que comeu no almoço" },
      { key: "dores", type: "pain-list", label: "Dores durante o dia", categoria: "dor" },
      { key: "lugares", type: "tags-multi", categoria: "lugar", label: "Onde esteve" },
      { key: "atividades", type: "tags-multi", categoria: "atividade", label: "O que fez" },
      { key: "pessoas", type: "tags-multi", categoria: "pessoa", label: "Com quem se relacionou" },
      { key: "observacoes", type: "text", label: "Observações", placeholder: "Algo mais que queira registrar…" },
    ],
  },
  noturno: {
    tipo: "noturno",
    titulo: "Check-in Noturno",
    emoji: "🌙",
    descCurta: "Balanço do dia",
    janela: "à noite",
    fields: [
      { key: "notaGeral", type: "scale5", label: "Nota geral do dia" },
      { key: "humor", type: "mood", label: "Humor" },
      { key: "jantar", type: "tags-multi", categoria: "comida", label: "O que jantou" },
      { key: "dores", type: "pain-list", label: "Dores", categoria: "dor" },
      { key: "estresse", type: "scale5", label: "Nível de estresse" },
      { key: "momentoBom", type: "text", label: "Um momento bom do dia", placeholder: "Opcional" },
      { key: "momentoRuim", type: "text", label: "Um momento ruim do dia", placeholder: "Opcional" },
      { key: "observacoes", type: "text", label: "Observações", placeholder: "Algo mais que queira registrar…" },
    ],
  },
};

export const CHECKIN_ORDER = ["matinal", "vespertino", "noturno"];

/** Um checkin é considerado "feito" se ao menos um campo tiver valor preenchido. */
export function isCheckInFilled(record) {
  if (!record) return false;
  const config = CHECKIN_TYPES[record.tipo];
  if (!config) return false;
  return config.fields.some((f) => {
    const v = record[f.key];
    if (v === undefined || v === null || v === "") return false;
    if (Array.isArray(v) && v.length === 0) return false;
    return true;
  });
}
