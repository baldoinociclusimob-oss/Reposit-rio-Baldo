import { test, expect } from "@playwright/test";

test("ativar senha bloqueia o app no próximo carregamento", async ({ page }) => {
  await page.goto("/index.html#/ajustes");
  await page.waitForSelector(".card-title");

  const passInputs = page.locator('.security-setup-form input[type="password"]');
  await passInputs.nth(0).fill("1234");
  await passInputs.nth(1).fill("1234");
  await page.click('button:has-text("Ativar senha")');
  await page.waitForTimeout(300);
  await expect(page.locator(".security-status")).toHaveText("🔓 Protegido por senha");

  await page.reload();
  await page.waitForSelector(".lock-screen");
  await expect(page.locator(".checkin-row")).toHaveCount(0);

  // senha errada não desbloqueia
  await page.fill(".lock-card input[type=password]", "0000");
  await page.click('.lock-card button:has-text("Desbloquear")');
  await page.waitForTimeout(200);
  await expect(page.locator(".lock-error")).toHaveText("Senha incorreta.");

  // senha certa desbloqueia e volta a mostrar a página (Ajustes, de onde veio)
  await page.fill(".lock-card input[type=password]", "1234");
  await page.click('.lock-card button:has-text("Desbloquear")');
  await page.waitForTimeout(300);
  await expect(page.locator(".lock-screen")).toHaveCount(0);
  await expect(page.locator(".card-title").first()).toBeVisible();
});
