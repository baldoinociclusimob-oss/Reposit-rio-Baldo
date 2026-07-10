import { test, expect } from "@playwright/test";

test("tag criada no check-in aparece e pode ser renomeada", async ({ page }) => {
  await page.goto("/index.html#/checkin/vespertino");
  await page.waitForSelector(".page-header h1");

  const tagInputs = page.locator('input[placeholder*="Adicionar"]');
  let lugarInput = null;
  for (const input of await tagInputs.all()) {
    const ph = await input.getAttribute("placeholder");
    if (ph?.toLowerCase().includes("onde esteve")) lugarInput = input;
  }
  await lugarInput.fill("Academia");
  await page.waitForTimeout(200);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(300);

  await page.goto("/index.html#/tags");
  await page.waitForSelector(".card");
  await expect(page.locator("body")).toContainText("Academia");

  const row = page.locator(".settings-row", { hasText: "Academia" });
  await row.locator("button", { hasText: "Renomear" }).click();
  await row.locator("input").fill("Academia do Bairro");
  await row.locator("button", { hasText: "Salvar" }).click();
  await page.waitForTimeout(300);

  await expect(page.locator("body")).toContainText("Academia do Bairro");
  await expect(page.locator("body")).not.toContainText("Academia\n");
});

test("registro espontâneo aparece na tela Hoje sem afetar os check-ins fixos", async ({ page }) => {
  await page.goto("/index.html#/hoje");
  await page.waitForSelector(".checkin-row");
  await page.click(".momento-add-btn");
  await page.waitForSelector(".page-header h1");

  const textarea = page.locator("textarea").first();
  await textarea.fill("Estômago começou a doer depois do almoço");
  await page.waitForTimeout(500);

  await page.click(".back-link");
  await page.waitForSelector(".checkin-row");

  const badges = await page.locator(".checkin-row .status-badge").allTextContents();
  expect(badges.every((b) => b === "Pendente")).toBe(true);

  await expect(page.locator(".section-title")).toHaveText("Registros espontâneos de hoje");
});
