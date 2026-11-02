import { runPipeline } from "../core/pipeline";
import type {
  AnalysisProvider,
  FaceBox,
  PortraitMask,
  ProcessRequest,
  WorkerReply,
} from "../core/types";
import { createAnalysisProvider } from "../inference/mediapipe";

const scope = self as unknown as {
  onmessage: (event: MessageEvent<ProcessRequest>) => void;
  postMessage: (message: WorkerReply) => void;
};
let provider: AnalysisProvider | undefined;
let chain = Promise.resolve();
let progress: (message: string) => void = () => {};
let cached: { key: string; portrait?: PortraitMask; faces?: FaceBox[] } = {
  key: "",
};

// 按順序執行，避免模型與 Canvas 在同一個 worker 內重入。
scope.onmessage = (event) => {
  const request = event.data;
  if (request.type !== "process") return;
  chain = chain.then(async () => {
    const { id, sourceId, bitmap, settings, assetBase } = request;
    progress = (message) =>
      scope.postMessage({ type: "progress", id, message });
    try {
      provider ??= createAnalysisProvider(assetBase, (message) =>
        progress(message),
      );
      // 只保留目前這張圖的辨識結果；換效果時共用，換圖即釋放。
      const key = `${sourceId}:${bitmap.width}:${bitmap.height}`;
      if (cached.key !== key) cached = { key };
      const analysis: AnalysisProvider = {
        portrait: async (image) =>
          (cached.portrait ??= await provider!.portrait(image)),
        faces: async (image) => (cached.faces ??= await provider!.faces(image)),
      };
      progress("正在處理圖片…");
      const result = await runPipeline(bitmap, settings, analysis);
      scope.postMessage({ type: "result", id, result });
    } catch (error) {
      scope.postMessage({
        type: "error",
        id,
        message:
          error instanceof Error ? error.message : "圖片處理失敗，請重試。",
      });
    } finally {
      bitmap.close();
    }
  });
};
