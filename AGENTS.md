# Pixel Workbench

## 程式結構

- `src/ui/` 負責匯入、預覽、操作狀態和下載。經 `src/core/client.ts` 和 `src/workers/image.worker.ts` 使用共用處理流程。
- 在 `src/features/` 實作圖片效果，透過 `src/core/pipeline.ts` 和 `src/core/catalog.ts` 接上工具。將模型存取留在 `src/inference/` 的 adapter。
- 維持照片在瀏覽器處理。變更模型或 WASM 時，同步更新固定版本、資產 SHA-256、授權與 [第三方聲明](THIRD_PARTY_NOTICES.md)。

## 開發與驗證

- 使用 Node.js 24。執行 `npm ci` 安裝依賴和準備模型，再以 `npm run dev` 開啟。
- 跑 `npm test` 和 `npm run build`。改動檔案輸入、Worker、畫布或 AI 工具時，另跑 `npm run test:e2e`，檢查單張及批次輸出。
- 修改處理流程時，核對取消、錯誤恢復、透明度與接續編輯。詳見 [架構文件](docs/architecture.md)。
