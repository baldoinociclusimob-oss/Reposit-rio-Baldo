import { test, expect } from "@playwright/test";

test("mostra 'ainda coletando dados' com histórico curto", async ({ page }) => {
  await page.goto("/index.html#/hoje");
  await page.waitForSelector(".checkin-row");
  await page.evaluate(async () => {
    const { saveCheckIn } = await import("/js/db.js");
    await saveCheckIn({ date: "2026-01-01", tipo: "noturno", notaGeral: 3 });
  });
  await page.goto("/index.html#/descobertas");
  await page.waitForSelector(".empty-state");
  await expect(page.locator(".empty-state p").first()).toHaveText("Ainda coletando dados.");
});

test("encontra padrão comida x dor com dados suficientes", async ({ page }) => {
  await page.goto("/index.html#/hoje");
  await page.waitForSelector(".checkin-row");

  await page.evaluate(async () => {
    const { saveCheckIn, findOrCreateTag } = await import("/js/db.js");
    const gluten = await findOrCreateTag("comida", "Glúten");
    const dor = await findOrCreateTag("dor", "Dor de cabeça");
    for (let i = 0; i < 20; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const comeu = i % 2 === 0;
      await saveCheckIn({
        date: key, tipo: "vespertino",
        cafeDaManha: comeu ? [gluten.id] : [],
        dores: comeu ? [{ tagId: dor.id, intensidade: 3 }] : [],
      });
    }
  });

  await page.goto("/index.html#/descobertas");
  await page.waitForSelector(".insight-card");
  const firstCard = page.locator(".insight-card").first();
  await expect(firstCard.locator(".insight-text")).toContainText("Glúten");
  await expect(firstCard.locator(".insight-base")).toContainText("dias");
  await expect(page.locator(".disclaimer")).toContainText("não é um diagnóstico");
});
