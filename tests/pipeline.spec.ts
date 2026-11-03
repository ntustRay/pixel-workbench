import { expect, test, type Page } from "@playwright/test";
import type {
  AnalysisProvider,
  EditSettings,
  PipelineResult,
} from "../src/core/types";

type Scenario =
  | "backgrounds"
  | "blur"
  | "sticker"
  | "privacy"
  | "avatar"
  | "no-face"
  | "formats"
  | "resize";

async function inspect(page: Page, scenario: Scenario) {
  return page.evaluate(async (name) => {
    const pipelinePath = "/src/core/pipeline.ts";
    const typesPath = "/src/core/types.ts";
    const { runPipeline }: typeof import("../src/core/pipeline") = await import(
      pipelinePath
    );
    const { DEFAULT_SETTINGS }: typeof import("../src/core/types") =
      await import(typesPath);
    const width = 160;
    const height = 120;
    const source = new OffscreenCanvas(width, height);
    const ctx = source.getContext("2d")!;
    if (name !== "sticker") {
      for (let y = 0; y < height; y += 4) {
        for (let x = 0; x < width; x += 4) {
          ctx.fillStyle = (x / 4 + y / 4) % 2 ? "#91c6ff" : "#17365b";
          ctx.fillRect(x, y, 4, 4);
        }
      }
    }
    ctx.fillStyle = "#e34b52";
    ctx.fillRect(60, 30, 40, 60);
    if (name === "privacy") {
      for (let x = 60; x < 100; x++) {
        ctx.fillStyle = x % 2 ? "#000000" : "#ffffff";
        ctx.fillRect(x, 30, 1, 60);
      }
    }
    const sourcePixel = (x: number, y: number) =>
      Array.from(ctx.getImageData(x, y, 1, 1).data);
    const alpha = new Uint8ClampedArray(width * height);
    for (let y = 30; y < 90; y++)
      alpha.fill(255, y * width + 60, y * width + 100);
    let maskCalls = 0;
    let faceCalls = 0;
    const provider: AnalysisProvider = {
      async portrait() {
        maskCalls++;
        return { width, height, alpha };
      },
      async faces() {
        faceCalls++;
        return name === "no-face"
          ? []
          : [
              { x: 10, y: 10, width: 10, height: 10, score: 0.9 },
              { x: 60, y: 30, width: 40, height: 60, score: 0.99 },
            ];
      },
    };
    const bitmap = await createImageBitmap(source);
    const settings = (patch: Partial<EditSettings>): EditSettings => ({
      ...DEFAULT_SETTINGS,
      ...patch,
    });
    const values: Record<string, number | string | number[] | string[]> = {};
    async function pixels(
      result: PipelineResult,
      points: Record<string, [number, number]>,
    ) {
      const output = await createImageBitmap(result.blob);
      const canvas = new OffscreenCanvas(output.width, output.height);
      const out = canvas.getContext("2d")!;
      out.drawImage(output, 0, 0);
      for (const [key, [x, y]] of Object.entries(points))
        values[key] = Array.from(out.getImageData(x, y, 1, 1).data);
      output.close();
    }
    let result: PipelineResult;
    try {
      switch (name) {
        case "backgrounds": {
          result = await runPipeline(
            bitmap,
            settings({ tool: "background", backgroundMode: "transparent" }),
            provider,
          );
          await pixels(result, { transparent: [10, 10], subject: [80, 60] });
          result = await runPipeline(
            bitmap,
            settings({
              tool: "background",
              backgroundMode: "color",
              backgroundColor: "#2b72c5",
            }),
            provider,
          );
          await pixels(result, { color: [10, 10], colorSubject: [80, 60] });
          break;
        }
        case "blur": {
          result = await runPipeline(
            bitmap,
            settings({ tool: "background", backgroundMode: "blur", blur: 10 }),
            provider,
          );
          values.originalBackground = sourcePixel(10, 10);
          await pixels(result, {
            blurredBackground: [10, 10],
            clearSubject: [80, 60],
          });
          break;
        }
        case "sticker": {
          result = await runPipeline(
            bitmap,
            settings({
              tool: "sticker",
              usePortraitMask: false,
              outline: 8,
              shadow: 10,
            }),
            provider,
          );
          await pixels(result, {
            transparentCorner: [0, 0],
            outline: [89, 80],
            shadow: [113, 137],
            subject: [113, 93],
          });
          break;
        }
        case "privacy": {
          result = await runPipeline(
            bitmap,
            settings({ tool: "privacy", pixelSize: 18 }),
            provider,
          );
          values.originalFirst = sourcePixel(75, 55);
          values.originalSecond = sourcePixel(76, 55);
          values.originalOutside = sourcePixel(145, 110);
          await pixels(result, {
            first: [75, 55],
            second: [76, 55],
            outside: [145, 110],
          });
          break;
        }
        case "avatar": {
          result = await runPipeline(
            bitmap,
            settings({ tool: "avatar", avatarRatio: "4:5" }),
            provider,
          );
          await pixels(result, { subject: [48, 60] });
          break;
        }
        case "no-face": {
          result = await runPipeline(
            bitmap,
            settings({ tool: "privacy" }),
            provider,
          );
          values.privacyWarnings = result.warnings;
          await pixels(result, { unchanged: [80, 60] });
          result = await runPipeline(
            bitmap,
            settings({ tool: "avatar", avatarRatio: "1:1" }),
            provider,
          );
          break;
        }
        case "formats": {
          result = await runPipeline(
            bitmap,
            settings({
              tool: "background",
              format: "image/jpeg",
              backgroundMode: "transparent",
            }),
            provider,
          );
          values.jpegType = result.blob.type;
          values.jpegWarnings = result.warnings;
          await pixels(result, { jpegCorner: [10, 10] });
          result = await runPipeline(
            bitmap,
            settings({
              tool: "background",
              format: "image/webp",
              backgroundMode: "transparent",
            }),
            provider,
          );
          values.webpType = result.blob.type;
          await pixels(result, { webpCorner: [10, 10], webpSubject: [80, 60] });
          break;
        }
        case "resize": {
          result = await runPipeline(
            bitmap,
            settings({ tool: "export", maxEdge: 2400 }),
            provider,
          );
          values.originalSize = [result.width, result.height];
          result = await runPipeline(
            bitmap,
            settings({ tool: "export", maxEdge: 128 }),
            provider,
          );
          break;
        }
      }
      return {
        width: result.width,
        height: result.height,
        faces: result.faces,
        warnings: result.warnings,
        values,
        maskCalls,
        faceCalls,
      };
    } finally {
      bitmap.close();
    }
  }, scenario);
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("portrait matte preserves the subject and supports transparency or an exact replacement color", async ({
  page,
}) => {
  const result = await inspect(page, "backgrounds");
  expect(result.values.transparent).toEqual([0, 0, 0, 0]);
  expect(result.values.subject).toEqual([227, 75, 82, 255]);
  expect(result.values.color).toEqual([43, 114, 197, 255]);
  expect(result.values.colorSubject).toEqual([227, 75, 82, 255]);
  expect([result.width, result.height]).toEqual([160, 120]);
  expect(result.faceCalls).toBe(0);
});

test("background blur changes background detail while keeping the subject sharp and opaque", async ({
  page,
}) => {
  const result = await inspect(page, "blur");
  expect(result.values.blurredBackground).not.toEqual(
    result.values.originalBackground,
  );
  expect(result.values.clearSubject).toEqual([227, 75, 82, 255]);
});

test("transparent PNG stickers gain a visible outline and shadow without loading a model", async ({
  page,
}) => {
  const result = await inspect(page, "sticker");
  expect(result.width).toBeGreaterThan(160);
  expect(result.height).toBeGreaterThan(120);
  expect(result.values.transparentCorner).toEqual([0, 0, 0, 0]);
  expect(result.values.outline).toEqual([255, 255, 255, 255]);
  expect((result.values.shadow as number[])[3]).toBeGreaterThan(0);
  expect((result.values.shadow as number[])[3]).toBeLessThan(255);
  expect(result.values.subject).toEqual([227, 75, 82, 255]);
  expect(result.maskCalls).toBe(0);
  expect(result.faceCalls).toBe(0);
});

test("face mosaic removes fine detail locally and preserves pixels outside detected faces", async ({
  page,
}) => {
  const result = await inspect(page, "privacy");
  expect(result.values.originalFirst).not.toEqual(result.values.originalSecond);
  expect(result.values.first).toEqual(result.values.second);
  expect(result.values.outside).toEqual(result.values.originalOutside);
  expect(result.faces).toBe(2);
  expect(result.warnings.join(" ")).toContain("逐一檢查");
  expect(result.faceCalls).toBe(1);
});

test("avatar crop follows the largest face and produces the selected aspect ratio", async ({
  page,
}) => {
  const result = await inspect(page, "avatar");
  expect(result.width / result.height).toBeCloseTo(4 / 5, 2);
  expect(result.width).toBeLessThanOrEqual(160);
  expect(result.height).toBeLessThanOrEqual(120);
  expect(result.values.subject).toEqual([227, 75, 82, 255]);
  expect(result.faces).toBe(2);
  expect(result.faceCalls).toBe(1);
});

test("no-face results remain unchanged and explicitly warn instead of claiming success", async ({
  page,
}) => {
  const result = await inspect(page, "no-face");
  expect(result.values.unchanged).toEqual([227, 75, 82, 255]);
  expect([result.width, result.height]).toEqual([160, 120]);
  expect(result.faces).toBe(0);
  expect((result.values.privacyWarnings as string[]).join(" ")).toContain(
    "沒有套用馬賽克",
  );
  expect(result.warnings.join(" ")).toContain("保留原圖比例");
});

test("JPEG fills transparency with white and WebP retains it with the correct MIME type", async ({
  page,
}) => {
  const result = await inspect(page, "formats");
  expect(result.values.jpegType).toBe("image/jpeg");
  const jpegCorner = result.values.jpegCorner as number[];
  expect(jpegCorner[0]).toBeGreaterThanOrEqual(250);
  expect(jpegCorner[1]).toBeGreaterThanOrEqual(250);
  expect(jpegCorner[2]).toBeGreaterThanOrEqual(250);
  expect(jpegCorner[3]).toBe(255);
  expect((result.values.jpegWarnings as string[]).join(" ")).toContain(
    "透明區域已填入白色",
  );
  expect(result.values.webpType).toBe("image/webp");
  expect((result.values.webpCorner as number[])[3]).toBe(0);
  expect((result.values.webpSubject as number[])[3]).toBe(255);
});

test("export caps the long edge without enlarging small images or loading inference", async ({
  page,
}) => {
  const result = await inspect(page, "resize");
  expect(result.values.originalSize).toEqual([160, 120]);
  expect([result.width, result.height]).toEqual([128, 96]);
  expect(result.maskCalls).toBe(0);
  expect(result.faceCalls).toBe(0);
});
