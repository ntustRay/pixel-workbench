import { describe, expect, it } from "vitest";
import { watermarkLayout } from "./watermark-layout";
import { WATERMARK_POSITIONS } from "./types";

describe("watermarkLayout", () => {
  it.each(WATERMARK_POSITIONS)(
    "anchors %s with a proportional margin",
    (position) => {
      const layout = watermarkLayout(320, 180, 10, position, 4);
      expect(layout.fontSize).toBe(18);
      expect(layout.margin).toBeCloseTo(7.2);
      expect(layout.x).toBeCloseTo(
        position === "center" ? 160 : position.endsWith("right") ? 312.8 : 7.2,
      );
      expect(layout.y).toBeCloseTo(
        position === "center" ? 90 : position.startsWith("top") ? 7.2 : 172.8,
      );
      expect(layout.align).toBe(
        position === "center"
          ? "center"
          : position.endsWith("right")
            ? "right"
            : "left",
      );
      expect(layout.baseline).toBe(
        position === "center"
          ? "middle"
          : position.startsWith("top")
            ? "top"
            : "bottom",
      );
    },
  );
  it("shrinks long text to fit while keeping short text at the requested size", () => {
    const long = watermarkLayout(320, 180, 15, "center", 64);
    expect(long.fontSize).toBeLessThan(27);
    expect(long.fontSize * 64 + long.margin * 2).toBeCloseTo(320);
    expect(watermarkLayout(320, 180, 15, "center", 1).fontSize).toBe(27);
  });
  it("uses the short edge for portrait and landscape batches", () => {
    const portrait = watermarkLayout(180, 320, 10, "center", 1);
    const landscape = watermarkLayout(320, 180, 10, "center", 1);
    expect(portrait.fontSize).toBe(landscape.fontSize);
    expect(watermarkLayout(640, 360, 10, "center", 1).fontSize).toBe(36);
  });
  it("keeps tiny images and zero-width text finite", () => {
    const tiny = watermarkLayout(1, 1, 5, "center", 80);
    expect(tiny.fontSize).toBeGreaterThan(0);
    expect(tiny.fontSize * 80).toBeLessThanOrEqual(1 - tiny.margin * 2);
    expect(watermarkLayout(320, 180, 10, "center", 0).fontSize).toBe(18);
  });
  it.each([
    [0, 180, 10, 1],
    [320, -1, 10, 1],
    [320, 180, NaN, 1],
    [320, 180, 10, -1],
    [320, 180, 10, Infinity],
  ])(
    "rejects invalid dimensions or measurements (%s, %s, %s, %s)",
    (w, h, size, textWidth) => {
      expect(() => watermarkLayout(w, h, size, "center", textWidth)).toThrow();
    },
  );
});
