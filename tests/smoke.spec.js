import { test, expect } from "@playwright/test";

const ROUTES = [
  "/hoje", "/checkin/matinal", "/checkin/vespertino", "/checkin/noturno",
  "/momento/novo/2026-01-01",
  "/historico", "/historico/mes/2026/0", "/historico/dia/2026-01-01",
  "/tendencias", "/descobertas", "/ajustes", "/tags", "/perfil", "/consulta",
];

test.describe("navegação básica", () => {
  for (const route of ROUTES) {
    test(`rota ${route} carrega sem erro`, async ({ page }) => {
      const errors = [];
      page.on("pageerror", (err) => errors.push(err.message));
      await page.goto(`/index.html#${route}`);
      await page.waitForSelector(".page-header, .checkin-row, .lock-screen", { timeout: 10_000 });
      expect(errors).toEqual([]);
    });
  }

  test("rota desconhecida mostra página não encontrada", async ({ page }) => {
    await page.goto("/index.html#/isso-nao-existe");
    await expect(page.locator("h1")).toHaveText("Página não encontrada");
  });
});
