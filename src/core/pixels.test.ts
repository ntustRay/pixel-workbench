import { describe, expect, it } from "vitest";
import { sharpenPixels } from "./pixels";

function gray(values: number[], alphas = values.map(() => 255)) {
  return new Uint8ClampedArray(
    values.flatMap((value, i) => [value, value, value, alphas[i]]),
  );
}

describe("sharpenPixels", () => {
  it("leaves flat areas and a single pixel unchanged", () => {
    const flat = gray(Array(9).fill(80));
    expect(sharpenPixels(flat, 3, 3, 100)).toEqual(flat);
    expect(sharpenPixels(gray([80]), 1, 1, 100)).toEqual(gray([80]));
  });
  it("sharpens a center edge with proportional strength without modifying the input", () => {
    const input = gray([80, 80, 80, 80, 100, 80, 80, 80, 80]);
    const original = input.slice();
    expect(sharpenPixels(input, 3, 3, 100)[4 * 4]).toBe(180);
    expect(sharpenPixels(input, 3, 3, 25)[4 * 4]).toBe(120);
    expect(input).toEqual(original);
    expect(sharpenPixels(input, 3, 3, 0)).toEqual(original);
  });
  it("clamps channel values and preserves every alpha value", () => {
    const input = gray([0, 255, 0], [255, 255, 128]);
    const output = sharpenPixels(input, 3, 1, 100);
    expect(output[0]).toBe(0);
    expect(output[4]).toBe(255);
    expect([output[3], output[7], output[11]]).toEqual([255, 255, 128]);
  });
  it("ignores transparent neighbors so an opaque edge gains no black halo", () => {
    const input = gray([0, 80, 80], [0, 255, 255]);
    expect(sharpenPixels(input, 3, 1, 100)).toEqual(input);
    const hiddenColor = new Uint8ClampedArray([255, 0, 0, 0, 80, 80, 80, 255]);
    expect(sharpenPixels(hiddenColor, 2, 1, 100)).toEqual(hiddenColor);
  });
  it("weights partially transparent neighbors and handles one-row images", () => {
    const input = gray([80, 100, 80], [128, 255, 128]);
    const center = sharpenPixels(input, 3, 1, 100)[4];
    expect(center).toBe(120);
  });
  it.each([
    [0, 1, 50],
    [2, 1, 50],
    [1.5, 1, 50],
    [1, 1, NaN],
    [1, 1, -1],
    [1, 1, 101],
  ])(
    "rejects malformed geometry or strength (%s, %s, %s)",
    (width, height, strength) => {
      expect(() =>
        sharpenPixels(gray([80]), width, height, strength),
      ).toThrow();
    },
  );
});
