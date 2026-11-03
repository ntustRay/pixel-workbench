import { describe, expect, it } from "vitest";
import { normalizeSettings } from "./settings";
import { DEFAULT_SETTINGS, type EditSettings } from "./types";
import { TOOLS } from "./catalog";

function invalid(field: keyof EditSettings, value: unknown): EditSettings {
  const settings = { ...DEFAULT_SETTINGS };
  Reflect.set(settings, field, value);
  return settings;
}

describe("normalizeSettings", () => {
  it.each(TOOLS)("accepts the default settings for $label", ({ id }) => {
    const settings = {
      ...DEFAULT_SETTINGS,
      tool: id,
      watermarkText: "MingRay",
    };
    expect(normalizeSettings(settings).tool).toBe(id);
  });
  it("normalizes numeric limits without changing the input", () => {
    const input = Object.freeze({
      ...DEFAULT_SETTINGS,
      cropX: -10,
      cropY: 120,
      exposure: 3,
      quality: 2,
      saturation: -300,
      contrast: 300,
      sharpen: -5,
      watermarkOpacity: -1,
      watermarkSize: 100,
      maxEdge: 5000,
    });
    const output = normalizeSettings(input);
    expect(output).toMatchObject({
      cropX: 0,
      cropY: 100,
      exposure: 2,
      quality: 1,
      saturation: -100,
      contrast: 100,
      sharpen: 0,
      watermarkOpacity: 0.1,
      watermarkSize: 15,
      maxEdge: 4096,
    });
    expect(input.cropX).toBe(-10);
    expect(input.maxEdge).toBe(5000);
  });
  it.each([
    "cropX",
    "cropY",
    "contrast",
    "saturation",
    "sharpen",
    "watermarkOpacity",
    "watermarkSize",
    "maxEdge",
  ] satisfies (keyof EditSettings)[])("rejects non-finite %s", (field) => {
    expect(() => normalizeSettings(invalid(field, NaN))).toThrow("有效數值");
    expect(() => normalizeSettings(invalid(field, Infinity))).toThrow(
      "有效數值",
    );
  });
  it("rejects unsupported tools, ratios, rotation, output and watermark position", () => {
    for (const [field, value] of [
      ["tool", "unknown"],
      ["cropRatio", "2:3"],
      ["rotation", 45],
      ["format", "image/gif"],
      ["watermarkPosition", "outside"],
    ] as const) {
      expect(() => normalizeSettings(invalid(field, value))).toThrow();
    }
  });
  it.each([
    "backgroundColor",
    "outlineColor",
    "watermarkColor",
  ] satisfies (keyof EditSettings)[])("rejects invalid %s", (field) => {
    expect(() => normalizeSettings(invalid(field, "red"))).toThrow("顏色格式");
  });
  it("trims single-line watermarks and enforces text length only for that tool", () => {
    expect(
      normalizeSettings({
        ...DEFAULT_SETTINGS,
        tool: "watermark",
        watermarkText: "  MingRay\n2026  ",
      }).watermarkText,
    ).toBe("MingRay 2026");
    expect(() =>
      normalizeSettings({
        ...DEFAULT_SETTINGS,
        tool: "watermark",
        watermarkText: "   ",
      }),
    ).toThrow("1 至 80");
    expect(() =>
      normalizeSettings({
        ...DEFAULT_SETTINGS,
        tool: "watermark",
        watermarkText: "字".repeat(81),
      }),
    ).toThrow("1 至 80");
    expect(
      normalizeSettings({
        ...DEFAULT_SETTINGS,
        tool: "watermark",
        watermarkText: "字".repeat(80),
      }).watermarkText,
    ).toHaveLength(80);
    expect(
      normalizeSettings({
        ...DEFAULT_SETTINGS,
        tool: "export",
        watermarkText: "",
      }).tool,
    ).toBe("export");
  });
});
