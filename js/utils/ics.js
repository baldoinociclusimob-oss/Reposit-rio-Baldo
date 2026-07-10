// js/utils/ics.js
// Lembretes confiáveis sem servidor: gera um arquivo iCalendar (RFC 5545)
// com um evento diário recorrente + alarme para cada check-in. Importado uma
// vez no calendário do aparelho, o sistema operacional passa a notificar nos
// horários — com o app e o navegador totalmente fechados.
//
// Uso típico na página de Ajustes:
//   import { gerarICSLembretes, baixarICS } from '../utils/ics.js';
//   const ics = gerarICSLembretes([
//     { tipo: 'matinal',    titulo: '🌅 Check-in matinal',    hora: '08:00' },
//     { tipo: 'vespertino', titulo: '🌤️ Check-in vespertino', hora: '14:00' },
//     { tipo: 'noturno',    titulo: '🌙 Check-in noturno',    hora: '21:30' },
//   ], { urlApp: location.origin + location.pathname });
//   baixarICS(ics);
//
// Observações de compatibilidade (documentar na interface):
// - Calendário da Apple e a maioria dos apps respeitam o alarme embutido
//   (VALARM). Alguns calendários — notadamente o Google Calendar ao importar —
//   podem ignorá-lo e aplicar o lembrete padrão do usuário.
// - Os UIDs são estáveis por tipo de check-in; ao mudar um horário, gere o
//   arquivo de novo com `sequencia` maior que a anterior e reimporte — a
//   maioria dos calendários atualiza o evento em vez de duplicar. Se o app de
//   calendário duplicar mesmo assim, oriente a apagar os eventos antigos.

const CRLF = '\r\n';

// Escapa texto conforme a RFC 5545 (\, ; , e quebras de linha).
function escaparTexto(txt) {
  return String(txt)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

// Dobra linhas longas (RFC 5545 limita a 75 octetos; dobramos em 60
// caracteres para sobrar folga com acentos, que ocupam 2 bytes em UTF-8).
function dobrarLinha(linha) {
  const MAX = 60;
  if (linha.length <= MAX) return linha;
  const pedacos = [linha.slice(0, MAX)];
  let resto = linha.slice(MAX);
  while (resto.length > MAX - 1) {
    pedacos.push(' ' + resto.slice(0, MAX - 1));
    resto = resto.slice(MAX - 1);
  }
  if (resto) pedacos.push(' ' + resto);
  return pedacos.join(CRLF);
}

const dois = (n) => String(n).padStart(2, '0');

// Data/hora "flutuante" (sem fuso): dispara no horário local do aparelho,
// que é exatamente o comportamento desejado para um lembrete diário.
function formatarLocal(d) {
  return (
    `${d.getFullYear()}${dois(d.getMonth() + 1)}${dois(d.getDate())}` +
    `T${dois(d.getHours())}${dois(d.getMinutes())}00`
  );
}

// Carimbo em UTC exigido no DTSTAMP.
function formatarUTC(d) {
  return (
    `${d.getUTCFullYear()}${dois(d.getUTCMonth() + 1)}${dois(d.getUTCDate())}` +
    `T${dois(d.getUTCHours())}${dois(d.getUTCMinutes())}${dois(d.getUTCSeconds())}Z`
  );
}

// Primeira ocorrência: hoje no horário configurado, ou amanhã se já passou.
function proximaOcorrencia(horaMinuto) {
  const [h, m] = String(horaMinuto).split(':').map(Number);
  const agora = new Date();
  const d = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), h, m, 0, 0);
  if (d <= agora) d.setDate(d.getDate() + 1);
  return d;
}

/**
 * Gera o conteúdo do arquivo .ics com um evento diário por lembrete.
 * @param {Array<{tipo:string, titulo:string, hora:string}>} lembretes
 *   tipo: identificador estável ('matinal' | 'vespertino' | 'noturno'),
 *   titulo: texto exibido no calendário, hora: 'HH:MM' local.
 * @param {object}  [opcoes]
 * @param {string}  [opcoes.urlApp]    URL do app, incluída na descrição.
 * @param {number}  [opcoes.sequencia] incremente a cada regeneração (padrão 0).
 * @returns {string} conteúdo iCalendar pronto para download
 */
export function gerarICSLembretes(lembretes, { urlApp = '', sequencia = 0 } = {}) {
  if (!Array.isArray(lembretes) || lembretes.length === 0) {
    throw new Error('gerarICSLembretes: informe ao menos um lembrete');
  }
  const agoraUTC = formatarUTC(new Date());
  const linhas = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Diario Vital//Lembretes//PT-BR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Diário Vital — lembretes',
  ];

  for (const { tipo, titulo, hora } of lembretes) {
    const inicio = proximaOcorrencia(hora);
    const descricao =
      'Abra o Diário Vital e registre como você está.' +
      (urlApp ? `\n${urlApp}` : '');
    linhas.push(
      'BEGIN:VEVENT',
      `UID:diario-vital-${tipo}@diario-vital.local`,
      `SEQUENCE:${sequencia}`,
      `DTSTAMP:${agoraUTC}`,
      `DTSTART:${formatarLocal(inicio)}`,
      'DURATION:PT15M',
      'RRULE:FREQ=DAILY',
      `SUMMARY:${escaparTexto(titulo)}`,
      `DESCRIPTION:${escaparTexto(descricao)}`,
      ...(urlApp ? [`URL:${urlApp}`] : []),
      'TRANSP:TRANSPARENT',
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${escaparTexto(titulo)}`,
      'TRIGGER:-PT0M',
      'END:VALARM',
      'END:VEVENT'
    );
  }

  linhas.push('END:VCALENDAR');
  return linhas.map(dobrarLinha).join(CRLF) + CRLF;
}

/**
 * Dispara o download do arquivo .ics no navegador.
 * No iOS o Safari abre a folha de compartilhamento; ao escolher o app
 * Calendário, os eventos são adicionados.
 */
export function baixarICS(conteudo, nomeArquivo = 'lembretes-diario-vital.ics') {
  const blob = new Blob([conteudo], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nomeArquivo;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
