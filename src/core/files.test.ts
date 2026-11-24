import { describe, expect, it, vi } from "vitest";
import {
  archiveResults,
  formatBytes,
  outputName,
  validateFile,
  type SourceImage,
} from "./files";
import { DEFAULT_SETTINGS, type PipelineResult } from "./types";

describe("file validation and export naming", () => {
  it("rejects empty, oversized, and unsupported input before decoding", () => {
    expect(() =>
      validateFile({ name: "bad.svg", type: "image/svg+xml", size: 10 }),
    ).toThrow("JPG");
    expect(() =>
      validateFile({ name: "empty.png", type: "image/png", size: 0 }),
    ).toThrow("空的");
    expect(() =>
      validateFile({
        name: "large.png",
        type: "image/png",
        size: 31 * 1024 * 1024,
      }),
    ).toThrow("30 MB");
    expect(() =>
      validateFile({ name: "valid.png", type: "image/png", size: 100 }),
    ).not.toThrow();
  });

  it("keeps Unicode names, removes unsafe path characters, and avoids batch collisions", () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      tool: "export" as const,
      format: "image/jpeg" as const,
    };
    expect(outputName("台北 相片.png", settings)).toBe("台北-相片-export.jpg");
    expect(outputName("../../photo.png", settings, 0)).toBe(
      "01--photo-export.jpg",
    );
    expect(outputName("same.png", settings, 0)).not.toBe(
      outputName("same.png", settings, 1),
    );
  });

  it("formats output sizes without misleading megabyte rounding for small files", () => {
    expect(formatBytes(5120)).toBe("5 KB");
    expect(formatBytes(1572864)).toBe("1.5 MB");
  });
});

function image(name: string): SourceImage {
  return {
    id: name,
    file: new File(["input"], name, { type: "image/png" }),
    url: `blob:${name}`,
    width: 1,
    height: 1,
  };
}

function processedImage(): PipelineResult {
  return {
    blob: new Blob(["output"], { type: "image/png" }),
    width: 1,
    height: 1,
    faces: 0,
    warnings: [],
  };
}

describe("batch ZIP export", () => {
  it("skips the entire batch when canceled before processing", async () => {
    const process = vi.fn(async () => processedImage());
    const onProgress = vi.fn();

    await expect(
      archiveResults(
        [image("first.png")],
        DEFAULT_SETTINGS,
        process,
        onProgress,
        AbortSignal.abort(),
      ),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(process).not.toHaveBeenCalled();
    expect(onProgress).not.toHaveBeenCalled();
  });

  it("discards an in-flight result and skips remaining images on cancellation", async () => {
    const controller = new AbortController();
    const first = image("first.png");
    const result = processedImage();
    const readBytes = vi.spyOn(result.blob, "arrayBuffer");
    const process = vi.fn(async () => {
      controller.abort();
      return result;
    });
    const onProgress = vi.fn();

    await expect(
      archiveResults(
        [first, image("second.png")],
        DEFAULT_SETTINGS,
        process,
        onProgress,
        controller.signal,
      ),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(process.mock.calls).toEqual([[first]]);
    expect(onProgress.mock.calls).toEqual([[1, 2]]);
    expect(readBytes).not.toHaveBeenCalled();
  });

  it("rejects if canceled while reading the final image for the ZIP", async () => {
    const controller = new AbortController();
    const result = processedImage();
    const readBytes = result.blob.arrayBuffer.bind(result.blob);
    vi.spyOn(result.blob, "arrayBuffer").mockImplementation(async () => {
      controller.abort();
      return readBytes();
    });

    await expect(
      archiveResults(
        [image("only.png")],
        DEFAULT_SETTINGS,
        async () => result,
        vi.fn(),
        controller.signal,
      ),
    ).rejects.toMatchObject({ name: "AbortError" });
  });

  it("reports a single image failure and stops without returning a partial ZIP", async () => {
    const first = image("first.png");
    const failed = image("failed.png");
    const error = new Error("Image encoding failed");
    const process = vi
      .fn<(source: SourceImage) => Promise<PipelineResult>>()
      .mockResolvedValueOnce(processedImage())
      .mockRejectedValueOnce(error);
    const onProgress = vi.fn();

    await expect(
      archiveResults(
        [first, failed, image("last.png")],
        DEFAULT_SETTINGS,
        process,
        onProgress,
        new AbortController().signal,
      ),
    ).rejects.toBe(error);
    expect(process.mock.calls).toEqual([[first], [failed]]);
    expect(onProgress.mock.calls).toEqual([
      [1, 3],
      [2, 3],
    ]);
  });
});
