import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "./",
  // Worker 與 ZIP 的動態載入不一定被首次掃描找到。
  // 預先最佳化，避免首次使用功能時 Vite 重載頁面、清掉編輯狀態。
  optimizeDeps: { include: ["@mediapipe/tasks-vision", "fflate"] },
  worker: { format: "es" },
  test: { include: ["src/**/*.test.ts"], environment: "node" },
});
