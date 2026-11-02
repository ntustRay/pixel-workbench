# 圖片處理與模型選擇

查證日期：2026-11-02。以下區分初版選擇、模型已知限制與後續驗證工作；模型卡大小不包含 JavaScript、WASM 或執行時記憶體。

| 分類                             | 初版選擇                                       | 原因與限制                                                                                                                    |
| -------------------------------- | ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| 人像去背、換底色、背景虛化       | MediaPipe Selfie Segmenter，square FP16        | 官方模型卡約 249 KB、Apache-2.0。適合近距離人像；細髮、手指、遮擋及遠距人物可能不準，不是通用商品去背。                       |
| 自動人臉馬賽克、頭像裁切         | MediaPipe Face Detector／BlazeFace short-range | 官方模型卡約 224 KB、Apache-2.0；與人像分割共用 `@mediapipe/tasks-vision`。對遠距、小臉、側臉或人群可能漏判，輸出前仍需檢查。 |
| 貼紙描邊、陰影、背景合成         | Canvas 與既有人像遮罩                          | 不增加神經網路模型；遮罩只計算一次，調色及合成可重用。透明 PNG 也可直接提供既有透明度。                                       |
| 尺寸、格式、壓縮、亮度與色彩調整 | 瀏覽器解碼、Canvas 與編碼                      | 不增加模型；輸出支援取決於瀏覽器。一般色彩調整不能宣稱修復失焦或還原壓縮資訊。                                                |

## 為何初版改用 MediaPipe，而非 YuNet

YuNet 是合理候選：OpenCV Zoo 的 2023 FP32 ONNX 檔約 233 KB，模型目錄採 MIT。這次先用 MediaPipe，是因人像分割與人臉偵測可共用同一推論套件及 WASM，已有官方 Web interface；若加入 YuNet，還需引入 ONNX Runtime Web 或 OpenCV.js，並驗證輸入、輸出解碼與非極大值抑制。這是整合成本的取捨，並非已實測 MediaPipe 的準確度優於 YuNet。

MediaPipe 的 `detect()`、`segment()` 是同步運算；安排在 Worker，並將模型載入與處理進度傳回 UI。Selfie 模型原始單通道輸出是 **person probability**，0 為背景、1 為人像；adapter 必須確認 confidence mask 的通道語意，避免反轉遮罩。

## 後續功能

| 項目                            | 狀態                | 加入條件                                                                                                               |
| ------------------------------- | ------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| YuNet／ONNX adapter             | Roadmap，初版未整合 | 與現有流程使用相同人臉框資料；以小臉、群像和側臉資料比較準確度、下載量與延遲。                                         |
| DnCNN／DnCNN-3 去噪與 JPEG 改善 | Roadmap，初版未整合 | 固定來源權重及授權、完成 ONNX 匯出與數值比對；先測真實手機照片。原專案的 AWGN 去噪成果不代表所有真實雜訊都有效。       |
| TEED 線稿                       | Roadmap，初版未整合 | 原專案 58K parameters、MIT。約 232 KB 是 FP32 純參數估算，不是已驗證的 ONNX 下載量；需驗證匯出、前後處理及瀏覽器結果。 |
| Fast Neural Style Transfer      | Roadmap，初版未整合 | ONNX model zoo 約 6.6 MB／風格；按需下載並限制輸入尺寸，先評估手機記憶體及速度。                                       |
| 通用商品去背                    | Roadmap，初版未整合 | 另選適合物體的模型並核對權重授權。IMG.LY 現成套件為 AGPL，不在初版默默引入。                                           |

## 驗證與隱私界線

- 用實際裝置記錄首次下載總量、冷啟動、推論時間與批次記憶體；官方 Pixel 裝置 benchmark 不能當作本網站效能。
- 照片處理不需要上傳到圖片伺服器；這不等同於「完全離線」或「零網路請求」。模型與 WASM 的取得、第三方套件行為應另外確認。
- MediaPipe upstream README 的 2026-06-05 privacy notice 說明輸入資料在裝置處理，並提到效能／使用量 metrics。初版固定 `0.10.32`；該版隨包 README 未出現此段，不能只憑 upstream 文件斷定本版網路行為。升級時重查，並以實際請求驗證。
- 保留原圖；自動遮罩與人臉偵測均可能有誤，不能保證完整隱私遮蔽。

## 官方來源

- [Selfie Segmenter 模型卡：大小、Apache-2.0、輸出與限制](https://storage.googleapis.com/mediapipe-assets/Model%20Card%20MediaPipe%20Selfie%20Segmentation.pdf)
- [BlazeFace short-range 模型卡：大小、Apache-2.0、用途與限制](https://storage.googleapis.com/mediapipe-assets/MediaPipe%20BlazeFace%20Model%20Card%20%28Short%20Range%29.pdf)
- [MediaPipe 分割 Web 文件](https://developers.google.com/edge/mediapipe/solutions/vision/image_segmenter/web_js)、[人臉偵測 Web 文件](https://developers.google.com/edge/mediapipe/solutions/vision/face_detector/web_js)
- [MediaPipe Tasks Vision upstream README 與 privacy notice](https://github.com/google-ai-edge/mediapipe/blob/master/mediapipe/tasks/web/vision/README.md#privacy-notice)
- [YuNet 官方說明與 MIT 授權](https://github.com/opencv/opencv_zoo/tree/main/models/face_detection_yunet)、[OpenCV 官方 Hugging Face 檔案大小](https://huggingface.co/opencv/opencv_zoo/tree/main/models/face_detection_yunet)
- [ONNX Runtime Web 部署資產說明](https://onnxruntime.ai/docs/tutorials/web/deploy.html)
- [DnCNN 作者說明](https://github.com/cszn/DnCNN)、[TEED 原始專案](https://github.com/xavysp/TEED)、[TEED MIT 授權](https://github.com/xavysp/TEED/blob/main/LICENSE)
- [Fast Neural Style Transfer 模型表與授權](https://github.com/onnx/models/blob/main/validated/vision/style_transfer/fast_neural_style/README.md)、[IMG.LY 授權說明](https://github.com/imgly/background-removal-js#license)
