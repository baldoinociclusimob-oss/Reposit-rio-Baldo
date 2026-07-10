import { test, expect } from "@playwright/test";

test("check-in noturno salva e persiste após reload", async ({ page }) => {
  await page.goto("/index.html#/checkin/noturno");
  await page.waitForSelector(".page-header h1");

  const scaleBtns = page.locator(".scale-row .scale-btn");
  await scaleBtns.nth(3).click(); // nota geral = 4

  const moodBtns = page.locator(".mood-row .mood-btn");
  await moodBtns.nth(3).click(); // humor = Bem

  await page.waitForTimeout(500); // debounce do autosave
  await expect(page.locator(".subtitle span").last()).toHaveText("Salvo ✓");

  await page.reload();
  await page.waitForSelector(".page-header h1");
  await expect(page.locator(".scale-row .scale-btn.active")).toHaveText("4");
  await expect(page.locator(".mood-row .mood-btn.active .lbl")).toHaveText("Bem");

  await page.goto("/index.html#/hoje");
  const noturnoBadge = page.locator(".checkin-row", { hasText: "Check-in Noturno" }).locator(".status-badge");
  await expect(noturnoBadge).toHaveText("Feito");
});

test("campos opcionais podem ficar vazios sem erro", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (err) => errors.push(err.message));
  await page.goto("/index.html#/checkin/matinal");
  await page.waitForSelector(".page-header h1");
  await page.goto("/index.html#/hoje");
  await page.waitForSelector(".checkin-row");
  const badge = page.locator(".checkin-row", { hasText: "Check-in Matinal" }).locator(".status-badge");
  await expect(badge).toHaveText("Pendente");
  expect(errors).toEqual([]);
});
