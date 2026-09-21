import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "test/e2e",
  webServer: {
    command: "npx http-server . -p 4173 -c-1 --silent",
    port: 4173,
    reuseExistingServer: !process.env.CI,
  },
  use: {
    baseURL: "http://localhost:4173",
  },
});
