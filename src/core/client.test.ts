import { afterEach, describe, expect, it, vi } from "vitest";
import { ImageProcessor } from "./client";
import type { SourceImage } from "./files";
import { DEFAULT_SETTINGS } from "./types";
import type { PipelineResult, ProcessRequest, WorkerReply } from "./types";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ImageProcessor", () => {
  it("reports a single image failure and accepts a retry", async () => {
    const source: SourceImage = {
      id: "photo",
      file: new File(["input"], "photo.png", { type: "image/png" }),
      url: "blob:photo",
      width: 1,
      height: 1,
    };
    const result: PipelineResult = {
      blob: new Blob(["output"], { type: "image/png" }),
      width: 1,
      height: 1,
      faces: 0,
      warnings: [],
    };
    const workerReply = vi
      .fn<(id: number) => WorkerReply>()
      .mockImplementationOnce((id) => ({
        type: "error",
        id,
        message: "Image encoding failed",
      }))
      .mockImplementationOnce((id) => ({ type: "result", id, result }));

    class WorkerStub {
      onmessage?: (event: MessageEvent<WorkerReply>) => void;
      postMessage({ id }: ProcessRequest) {
        this.onmessage?.(
          new MessageEvent("message", { data: workerReply(id) }),
        );
      }
      terminate = vi.fn();
    }

    vi.stubGlobal("Worker", WorkerStub);
    vi.stubGlobal("window", { location: { href: "https://example.test/" } });
    vi.stubGlobal("OffscreenCanvas", class {});
    vi.stubGlobal("createImageBitmap", async () => ({ close: vi.fn() }));

    const processor = new ImageProcessor();
    try {
      await expect(processor.process(source, DEFAULT_SETTINGS)).rejects.toThrow(
        "Image encoding failed",
      );
      await expect(processor.process(source, DEFAULT_SETTINGS)).resolves.toBe(
        result,
      );
    } finally {
      processor.dispose();
    }
  });
});
