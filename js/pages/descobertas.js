import { h, mount } from "../ui/dom.js";
import { generateInsights, strengthLabel, MIN_DAYS } from "../insights.js";

export async function renderDescobertasPage() {
  const app = document.getElementById("app");

  const header = h("div", { class: "page-header" }, [
    h("h1", { text: "Descobertas" }),
    h("div", { class: "subtitle", text: "Padrões encontrados no seu histórico." }),
  ]);

  const disclaimer = h("div", { class: "disclaimer" }, [
    "⚠️ Isso não é um diagnóstico. São apenas tendências percebidas nos seus próprios registros — não uma relação de causa e efeito comprovada. Converse com um profissional de saúde se algo te preocupar.",
  ]);

  const { insights, totalDaysComRegistro } = await generateInsights();

  const content = [];

  if (totalDaysComRegistro < MIN_DAYS) {
    content.push(
      h("div", { class: "empty-state" }, [
        h("span", { class: "emoji", text: "🌱" }),
        h("p", { text: "Ainda coletando dados." }),
        h("p", { class: "text-muted", text: `Registre pelo menos ${MIN_DAYS} dias para começarmos a notar padrões (você tem ${totalDaysComRegistro} até agora).` }),
      ])
    );
  } else if (insights.length === 0) {
    content.push(
      h("div", { class: "empty-state" }, [
        h("span", { class: "emoji", text: "🔍" }),
        h("p", { text: "Ainda não encontramos padrões claros." }),
        h("p", { class: "text-muted", text: "Continue registrando — quanto mais dias, mais fácil notar tendências reais." }),
      ])
    );
  } else {
    insights.forEach((ins) => {
      content.push(
        h("div", { class: "card insight-card" }, [
          h("div", { class: "insight-strength", text: strengthLabel(ins.strength) }),
          h("div", { class: "insight-text", text: ins.text }),
          h("div", { class: "insight-base", text: ins.base }),
        ])
      );
    });
  }

  mount(app, header, disclaimer, ...content);
}
