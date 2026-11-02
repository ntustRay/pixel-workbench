import { describe, expect, it } from "vitest";
import { formatBytes, outputName, validateFile } from "./files";
import { DEFAULT_SETTINGS } from "./types";

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
