import { describe, expect, it } from "vitest";
import {
  avatarRect,
  cropRect,
  fitWithin,
  privacyRect,
  stickerPadding,
  validFaces,
} from "./geometry";
import type { FaceBox } from "./types";

const face: FaceBox = { x: 140, y: 80, width: 120, height: 150, score: 0.95 };

describe("fitWithin", () => {
  it("keeps portrait and landscape dimensions within the upper limit without enlarging", () => {
    expect(fitWithin(4000, 3000, 1600)).toEqual({ width: 1600, height: 1200 });
    expect(fitWithin(600, 1200, 800)).toEqual({ width: 400, height: 800 });
    expect(fitWithin(100, 60, 1600)).toEqual({ width: 100, height: 60 });
    expect(fitWithin(1, 12000, 128)).toEqual({ width: 1, height: 128 });
  });
  it("rejects malformed dimensions", () => {
    expect(() => fitWithin(0, 10, 100)).toThrow();
    expect(() => fitWithin(NaN, 10, 100)).toThrow();
    expect(() => fitWithin(10, 10, -1)).toThrow();
  });
});

describe("avatar crop", () => {
  it.each([1, 4 / 5, 3 / 4])("preserves the requested ratio %s", (ratio) => {
    const rect = avatarRect(face, 600, 800, ratio);
    expect(rect.width / rect.height).toBeCloseTo(ratio);
    expect(rect.x).toBeGreaterThanOrEqual(0);
    expect(rect.y).toBeGreaterThanOrEqual(0);
    expect(rect.x + rect.width).toBeLessThanOrEqual(600);
    expect(rect.y + rect.height).toBeLessThanOrEqual(800);
    expect(rect.y).toBeLessThan(face.y);
  });
  it("clamps faces near image edges while retaining the crop ratio", () => {
    const rect = avatarRect({ ...face, x: 570, y: 730 }, 600, 800, 4 / 5);
    expect(rect.x + rect.width).toBeLessThanOrEqual(600);
    expect(rect.y + rect.height).toBeLessThanOrEqual(800);
    expect(rect.width / rect.height).toBeCloseTo(4 / 5);
  });
  it("works when the source is wider than the requested crop", () => {
    const rect = avatarRect(face, 1200, 100, 3 / 4);
    expect(rect.height).toBe(100);
    expect(rect.width).toBe(75);
  });
});

describe("face privacy rectangles", () => {
  it("extends beyond the detector box", () => {
    const rect = privacyRect(face, 600, 800);
    expect(rect.x).toBeLessThan(face.x);
    expect(rect.y).toBeLessThan(face.y);
    expect(rect.width).toBeGreaterThan(face.width);
    expect(rect.height).toBeGreaterThan(face.height);
  });
  it("stays inside all four edges", () => {
    expect(
      privacyRect(
        { ...face, x: -20, y: -20, width: 800, height: 900 },
        600,
        800,
      ),
    ).toEqual({ x: 0, y: 0, width: 600, height: 800 });
  });
  it("ignores invalid or entirely out-of-frame detections", () => {
    expect(
      validFaces(
        [face, { ...face, x: NaN }, { ...face, width: 0 }, { ...face, x: 800 }],
        600,
        800,
      ),
    ).toEqual([face]);
  });
});

describe("sticker canvas padding", () => {
  it("leaves room for the outline, blur and shadow offset", () => {
    expect(stickerPadding(12, 18)).toBe(57);
    expect(stickerPadding(0, 0)).toBe(0);
  });
});

describe("cropRect", () => {
  it("positions a square crop within a wide image without changing scale", () => {
    expect(cropRect(160, 120, 1, 0, 50)).toEqual({
      x: 0,
      y: 0,
      width: 120,
      height: 120,
    });
    expect(cropRect(160, 120, 1, 100, 50)).toEqual({
      x: 40,
      y: 0,
      width: 120,
      height: 120,
    });
    expect(cropRect(120, 160, 1, 50, 100)).toEqual({
      x: 0,
      y: 40,
      width: 120,
      height: 120,
    });
    expect(cropRect(160, 120, null, 100, 100)).toEqual({
      x: 0,
      y: 0,
      width: 160,
      height: 120,
    });
  });
  it("clamps anchors and rejects invalid geometry", () => {
    expect(cropRect(160, 120, 1, 200, -10).x).toBe(40);
    expect(() => cropRect(0, 120, 1, 50, 50)).toThrow();
    expect(() => cropRect(160, 120, NaN, 50, 50)).toThrow();
    expect(() => cropRect(160, 120, 1, NaN, 50)).toThrow();
  });
});
