// @ts-check
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://localhost:8080",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "python3 -m http.server 8080",
    url: "http://localhost:8080/index.html",
    reuseExistingServer: !process.env.CI,
    timeout: 20_000,
  },
  projects: [
    { name: "chromium", use: { browserName: "chromium" } },
  ],
});
