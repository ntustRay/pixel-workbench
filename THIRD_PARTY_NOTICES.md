# Third-party notices

本檔記錄第三方套件與模型的授權來源，**不授予 Pixel Workbench 自有程式碼開源授權**。第三方項目仍依各自授權使用。

隨部署保留的授權全文位於 `public/licenses/`，包括 Apache-2.0 與各瀏覽器套件的 copyright／license。

下列套件版本與授權依初版安裝的 package metadata 核對；後續精確版本以 `package-lock.json` 為準。重新散布套件、WASM 或模型時，應保留上游 copyright、license 與適用 notice。

## 瀏覽器執行套件

| 項目                                   | 初版版本 | 授權                         | 來源與權利人                                                                                                                                                                                                |
| -------------------------------------- | -------- | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| React、React DOM                       | 19.3.1   | MIT                          | Meta Platforms, Inc. and affiliates；[上游授權](https://github.com/facebook/react/blob/main/LICENSE)                                                                                                        |
| `@mediapipe/tasks-vision`，含配套 WASM | 0.10.32  | Apache-2.0                   | Google／MediaPipe contributors；[上游授權](https://github.com/google-ai-edge/mediapipe/blob/master/LICENSE)、[套件來源](https://github.com/google-ai-edge/mediapipe/tree/master/mediapipe/tasks/web/vision) |
| `fflate`                               | 0.8.3    | MIT                          | Arjun Barrett；[上游授權](https://github.com/101arrowz/fflate/blob/v0.8.3/LICENSE)。                                                                                                                        |
| `lucide-react`                         | 0.468.0  | ISC；部分來源為 Feather／MIT | Lucide Contributors，及 Cole Bemis 的 Feather 衍生部分；[上游授權與 Feather 說明](https://github.com/lucide-icons/lucide/blob/main/LICENSE)。安裝套件的 LICENSE 保留兩者來源。                              |

## 預訓練模型

| 模型                                    | 授權       | 官方資產與模型卡                                                                                                                                                                                                                                                                                        |
| --------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| MediaPipe Selfie Segmenter，square FP16 | Apache-2.0 | [官方模型目錄版本 1 資產](https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/1/selfie_segmenter.tflite)、[模型卡](https://storage.googleapis.com/mediapipe-assets/Model%20Card%20MediaPipe%20Selfie%20Segmentation.pdf)；Google，2021-05-06。                     |
| MediaPipe BlazeFace short-range，FP16   | Apache-2.0 | [官方模型目錄版本 1 資產](https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite)、[模型卡](https://storage.googleapis.com/mediapipe-assets/MediaPipe%20BlazeFace%20Model%20Card%20%28Short%20Range%29.pdf)；Google，2021-06-09。 |

模型的 Apache-2.0 授權依各自模型卡明示確認，並非由套件授權推定。模型僅作人像分割與人臉位置偵測，不作身分辨識。

## 建置與測試

| 項目                                              | 授權       | 來源                                                                                                                                    |
| ------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Vite、`@vitejs/plugin-react`                      | MIT        | [Vite](https://github.com/vitejs/vite/blob/main/LICENSE)、[React plugin](https://github.com/vitejs/vite-plugin-react/blob/main/LICENSE) |
| TypeScript                                        | Apache-2.0 | [Microsoft／TypeScript](https://github.com/microsoft/TypeScript/blob/main/LICENSE.txt)                                                  |
| Vitest                                            | MIT        | [Vitest](https://github.com/vitest-dev/vitest/blob/main/LICENSE.md)                                                                     |
| Playwright                                        | Apache-2.0 | [Microsoft／Playwright](https://github.com/microsoft/playwright/blob/main/LICENSE)                                                      |
| `@types/node`、`@types/react`、`@types/react-dom` | MIT        | [DefinitelyTyped](https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/LICENSE)                                               |

完整傳遞依賴由 lockfile 記錄；本表不取代依賴套件隨附的授權文字。未整合的 YuNet、DnCNN、TEED、IMG.LY 與風格模型僅列於[選型文件](docs/model-decisions.md)，不因列入 roadmap 而成為本版依賴。

## MediaPipe 隱私說明

Google [upstream privacy notice](https://github.com/google-ai-edge/mediapipe/blob/master/mediapipe/tasks/web/vision/README.md#privacy-notice) 表示輸入影像在裝置端處理，並提及 API 效能／使用量 metrics。初版固定的 `0.10.32` 套件 README 未含該段；版本實際行為仍應以網路檢查為準。不要將「照片在本機處理」延伸宣稱為「所有第三方程式絕不發出網路請求」。
