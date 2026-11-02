import type { EditSettings, PipelineResult, WorkerReply } from "./types";
import type { SourceImage } from "./files";

type Pending = {
  resolve: (result: PipelineResult) => void;
  reject: (error: Error) => void;
  progress: (message: string) => void;
  timer: ReturnType<typeof setTimeout>;
};

export class ImageProcessor {
  private worker: Worker | undefined;
  private pending = new Map<number, Pending>();
  private nextId = 0;
  private generation = 0;

  private ensureWorker(): Worker {
    if (this.worker) return this.worker;
    if (
      !("OffscreenCanvas" in globalThis) ||
      !("createImageBitmap" in globalThis)
    ) {
      throw new Error(
        "此瀏覽器不支援背景圖片處理，請使用最新版 Chrome、Edge 或 Firefox。",
      );
    }
    const worker = new Worker(
      new URL("../workers/image.worker.ts", import.meta.url),
      { type: "module" },
    );
    worker.onmessage = (event: MessageEvent<WorkerReply>) => {
      const message = event.data;
      const pending = this.pending.get(message.id);
      if (!pending) return;
      if (message.type === "progress") {
        pending.progress(message.message);
        return;
      }
      clearTimeout(pending.timer);
      this.pending.delete(message.id);
      if (message.type === "result") pending.resolve(message.result);
      else pending.reject(new Error(message.message));
    };
    worker.onerror = () =>
      this.dispose(
        new Error("圖片處理程序中斷，請重試；如持續失敗請重新載入頁面。"),
      );
    this.worker = worker;
    return worker;
  }

  async process(
    source: SourceImage,
    settings: EditSettings,
    progress: (message: string) => void = () => {},
  ): Promise<PipelineResult> {
    const worker = this.ensureWorker();
    const generation = this.generation;
    const bitmap = await createImageBitmap(source.file, {
      resizeWidth: Math.max(
        1,
        Math.round(
          source.width *
            Math.min(1, 2400 / Math.max(source.width, source.height)),
        ),
      ),
      resizeHeight: Math.max(
        1,
        Math.round(
          source.height *
            Math.min(1, 2400 / Math.max(source.width, source.height)),
        ),
      ),
      resizeQuality: "high",
    });
    if (generation !== this.generation) {
      bitmap.close();
      throw new DOMException("處理已取消", "AbortError");
    }
    const id = ++this.nextId;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => this.dispose(new Error("處理超過 90 秒，請縮小圖片後重試。")),
        90_000,
      );
      this.pending.set(id, { resolve, reject, progress, timer });
      const assetBase = new URL(import.meta.env.BASE_URL, window.location.href)
        .href;
      worker.postMessage(
        {
          type: "process",
          id,
          sourceId: source.id,
          bitmap,
          settings,
          assetBase,
        },
        [bitmap],
      );
    });
  }

  dispose(error: Error = new DOMException("處理已取消", "AbortError")): void {
    this.generation++;
    this.worker?.terminate();
    this.worker = undefined;
    for (const task of this.pending.values()) {
      clearTimeout(task.timer);
      task.reject(error);
    }
    this.pending.clear();
  }
}
