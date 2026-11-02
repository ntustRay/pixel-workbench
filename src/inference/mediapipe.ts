import type { AnalysisProvider, FaceBox, PortraitMask } from "../core/types";
import type { FaceDetector, ImageSegmenter } from "@mediapipe/tasks-vision";

type VisionLibrary = typeof import("@mediapipe/tasks-vision");
type WasmFileset = Parameters<
  VisionLibrary["ImageSegmenter"]["createFromOptions"]
>[0];
type ModuleFactory = (options?: object) => Promise<unknown>;

interface RuntimeGlobal {
  ModuleFactory?: ModuleFactory;
}

/** 每個 worker 共用模型；僅使用能力時才載入 ML 套件、WASM 與對應模型。 */
export function createAnalysisProvider(
  assetBase: string,
  onProgress: (message: string) => void,
): AnalysisProvider {
  const base = new URL(assetBase, globalThis.location.href);
  let library: Promise<VisionLibrary> | undefined;
  let segmenter: Promise<ImageSegmenter> | undefined;
  let detector: Promise<FaceDetector> | undefined;
  let initialization: Promise<void> = Promise.resolve();

  function loadLibrary(): Promise<VisionLibrary> {
    library ??= import("@mediapipe/tasks-vision").catch((error: unknown) => {
      library = undefined;
      throw new Error("無法載入圖片辨識引擎。請重新整理後重試。", {
        cause: error,
      });
    });
    return library;
  }

  /**
   * 0.10.32 的預設 loader 使用 importScripts；module worker 不支援它。
   * 準備資產時附加 ESM export，這裡使用官方支援的自訂 WasmFileset，
   * 先提供既有 ModuleFactory，再以空 loader path 跳過 script loader。
   * 初始化必須依序執行，因為 MediaPipe 會消耗並清除該全域 factory。
   */
  function initialize<T>(
    create: (vision: VisionLibrary, files: WasmFileset) => Promise<T>,
  ): Promise<T> {
    const pending = initialization.then(async () => {
      const vision = await loadLibrary();
      const suffix = (await vision.FilesetResolver.isSimdSupported())
        ? ""
        : "_nosimd";
      const name = `vision_wasm${suffix}_internal`;
      const loaderUrl = new URL(`wasm/${name}.mjs`, base).href;
      const loader = (await import(/* @vite-ignore */ loaderUrl)) as {
        default: ModuleFactory;
      };
      (globalThis as unknown as RuntimeGlobal).ModuleFactory = loader.default;
      return create(vision, {
        wasmLoaderPath: "",
        wasmBinaryPath: new URL(`wasm/${name}.wasm`, base).href,
      });
    });
    // 失敗的初始化不污染佇列，下一次點選仍可重試。
    initialization = pending.then(
      () => undefined,
      () => undefined,
    );
    return pending;
  }

  function getSegmenter(): Promise<ImageSegmenter> {
    if (!segmenter) {
      onProgress("正在載入人像去背模型，首次使用需要稍候…");
      segmenter = initialize((vision, files) =>
        vision.ImageSegmenter.createFromOptions(files, {
          baseOptions: {
            modelAssetPath: new URL("models/selfie_segmenter.tflite", base)
              .href,
            delegate: "CPU",
          },
          canvas: new OffscreenCanvas(1, 1),
          runningMode: "IMAGE",
          outputConfidenceMasks: true,
          outputCategoryMask: false,
        }),
      ).catch((error: unknown) => {
        segmenter = undefined;
        throw new Error(
          "人像去背模型載入失敗。請確認模型資產已準備完成，再重試。",
          { cause: error },
        );
      });
    }
    return segmenter;
  }

  function getDetector(): Promise<FaceDetector> {
    if (!detector) {
      onProgress("正在載入人臉偵測模型，首次使用需要稍候…");
      detector = initialize((vision, files) =>
        vision.FaceDetector.createFromOptions(files, {
          baseOptions: {
            modelAssetPath: new URL(
              "models/blaze_face_short_range.tflite",
              base,
            ).href,
            delegate: "CPU",
          },
          canvas: new OffscreenCanvas(1, 1),
          runningMode: "IMAGE",
          minDetectionConfidence: 0.45,
          minSuppressionThreshold: 0.3,
        }),
      ).catch((error: unknown) => {
        detector = undefined;
        throw new Error(
          "人臉偵測模型載入失敗。請確認模型資產已準備完成，再重試。",
          { cause: error },
        );
      });
    }
    return detector;
  }

  return {
    async portrait(image: ImageBitmap): Promise<PortraitMask> {
      const model = await getSegmenter();
      onProgress("正在辨識人像與背景…");
      const result = model.segment(image);
      try {
        // Selfie Segmenter 的單通道輸出是「人像」機率，1 為人像、0 為背景。
        const confidence = result.confidenceMasks?.[0];
        if (!confidence)
          throw new Error("模型沒有回傳人像遮罩，請換一張照片重試。");
        const probabilities = confidence.getAsFloat32Array();
        const alpha = new Uint8ClampedArray(probabilities.length);
        for (let index = 0; index < probabilities.length; index++) {
          alpha[index] = Math.round(
            Math.max(0, Math.min(1, probabilities[index])) * 255,
          );
        }
        return { width: confidence.width, height: confidence.height, alpha };
      } finally {
        result.close();
      }
    },

    async faces(image: ImageBitmap): Promise<FaceBox[]> {
      const model = await getDetector();
      onProgress("正在尋找人臉…");
      return model.detect(image).detections.flatMap((detection) => {
        const box = detection.boundingBox;
        if (!box) return [];
        const x = Math.max(0, Math.min(image.width, box.originX));
        const y = Math.max(0, Math.min(image.height, box.originY));
        const width = Math.max(
          0,
          Math.min(image.width, box.originX + box.width) - x,
        );
        const height = Math.max(
          0,
          Math.min(image.height, box.originY + box.height) - y,
        );
        if (width < 1 || height < 1) return [];
        return [
          { x, y, width, height, score: detection.categories[0]?.score ?? 0 },
        ];
      });
    },
  };
}
