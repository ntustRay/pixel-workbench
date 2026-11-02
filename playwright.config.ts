import { defineConfig } from "@playwright/test";

const production = process.env.TEST_PRODUCTION === "1";
const externalURL = process.env.E2E_BASE_URL?.trim();
const localURL = "http://127.0.0.1:4173";
const baseURL = externalURL || localURL;

if (!["http:", "https:"].includes(new URL(baseURL).protocol)) {
  throw new Error("E2E_BASE_URL 必須是完整的 HTTP 或 HTTPS 網址。");
}

export default defineConfig({
  testDir: "./tests",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  // 遠端部署沒有 Vite 的原始碼匯入入口；仍執行完整 UI 與真模型測試。
  testIgnore: production || externalURL ? "**/pipeline.spec.ts" : undefined,
  workers: 2,
  use: {
    baseURL,
    channel: process.env.PLAYWRIGHT_CHANNEL,
    headless: true,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: externalURL
    ? undefined
    : {
        command: `npm run ${production ? "preview" : "dev"} -- --port 4173 --strictPort`,
        url: localURL,
        reuseExistingServer: !process.env.CI,
        timeout: 30_000,
      },
});
