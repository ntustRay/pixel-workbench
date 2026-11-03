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

// 真正執行 Canvas 與編碼；新增工具不得意外呼叫模型。
async function editPixels(
  page: Page,
  patch: Partial<EditSettings>,
  pattern: "quadrants" | "detail" | "black" = "quadrants",
) {
  return page.evaluate(
    async ({ patch, pattern }) => {
      const { runPipeline }: typeof import("../src/core/pipeline") =
        await import(String("/src/core/pipeline.ts"));
      const { DEFAULT_SETTINGS }: typeof import("../src/core/types") =
        await import(String("/src/core/types.ts"));
      const canvas = new OffscreenCanvas(
        pattern === "black" ? 320 : 80,
        pattern === "black" ? 180 : 40,
      );
      const ctx = canvas.getContext("2d")!;
      if (pattern === "quadrants") {
        for (const [x, y, color] of [
          [0, 0, "#ff0000"],
          [40, 0, "#00ff00"],
          [0, 20, "#0000ff"],
          [40, 20, "#ffff00"],
        ] as const) {
          ctx.fillStyle = color;
          ctx.fillRect(x, y, 40, 20);
        }
      } else if (pattern === "detail") {
        ctx.fillStyle = "rgb(80,80,80)";
        ctx.fillRect(0, 0, 80, 40);
        ctx.fillStyle = "rgb(100,100,100)";
        ctx.fillRect(40, 0, 1, 40);
        ctx.clearRect(0, 0, 4, 40);
      } else {
        ctx.fillStyle = "black";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      const bitmap = await createImageBitmap(canvas);
      const noModels: AnalysisProvider = {
        async portrait() {
          throw new Error("Unexpected model request");
        },
        async faces() {
          throw new Error("Unexpected model request");
        },
      };
      try {
        const result = await runPipeline(
          bitmap,
          { ...DEFAULT_SETTINGS, ...patch },
          noModels,
        );
        const output = await createImageBitmap(result.blob);
        const out = new OffscreenCanvas(output.width, output.height);
        const ctxOut = out.getContext("2d")!;
        ctxOut.drawImage(output, 0, 0);
        output.close();
        const pixel = (x: number, y: number) =>
          Array.from(ctxOut.getImageData(x, y, 1, 1).data);
        let left = out.width,
          top = out.height,
          right = -1,
          bottom = -1;
        const data = ctxOut.getImageData(0, 0, out.width, out.height).data;
        for (let y = 0; y < out.height; y++)
          for (let x = 0; x < out.width; x++) {
            const i = (y * out.width + x) * 4;
            if (data[i] + data[i + 1] + data[i + 2] > 60) {
              left = Math.min(left, x);
              top = Math.min(top, y);
              right = Math.max(right, x);
              bottom = Math.max(bottom, y);
            }
          }
        return {
          width: out.width,
          height: out.height,
          tl: pixel(5, 5),
          tr: pixel(out.width - 6, 5),
          bl: pixel(5, out.height - 6),
          br: pixel(out.width - 6, out.height - 6),
          detail: pixel(Math.min(40, out.width - 1), 10),
          transparent: pixel(0, 10),
          edge: pixel(4, 10),
          bounds: { left, top, right, bottom },
        };
      } finally {
        bitmap.close();
      }
    },
    { patch, pattern },
  );
}

test("crop follows the requested anchor and rotation and flips preserve orientation", async ({
  page,
}) => {
  const right = await editPixels(page, {
    tool: "crop",
    cropRatio: "1:1",
    cropX: 100,
  });
  expect([right.width, right.height]).toEqual([40, 40]);
  expect(right.tl).toEqual([0, 255, 0, 255]);
  expect(right.bl).toEqual([255, 255, 0, 255]);
  const clockwise = await editPixels(page, { tool: "crop", rotation: 90 });
  expect([clockwise.width, clockwise.height]).toEqual([40, 80]);
  expect(clockwise.tl).toEqual([0, 0, 255, 255]);
  expect(clockwise.tr).toEqual([255, 0, 0, 255]);
  const counter = await editPixels(page, { tool: "crop", rotation: 270 });
  expect(counter.tl).toEqual([0, 255, 0, 255]);
  const half = await editPixels(page, { tool: "crop", rotation: 180 });
  expect(half.tl).toEqual([255, 255, 0, 255]);
  const horizontal = await editPixels(page, {
    tool: "crop",
    flipHorizontal: true,
  });
  expect(horizontal.tl).toEqual([0, 255, 0, 255]);
  const vertical = await editPixels(page, { tool: "crop", flipVertical: true });
  expect(vertical.tl).toEqual([0, 0, 255, 255]);
});

test("adjustments change pixel colors and sharpening preserves alpha and transparent edges", async ({
  page,
}) => {
  const grayscale = await editPixels(page, { tool: "adjust", grayscale: true });
  expect(grayscale.tl[0]).toBe(grayscale.tl[1]);
  expect(grayscale.tl[1]).toBe(grayscale.tl[2]);
  const desaturated = await editPixels(page, {
    tool: "adjust",
    saturation: -100,
  });
  expect(desaturated.tl[0]).toBe(desaturated.tl[1]);
  const contrast = await editPixels(page, { tool: "adjust", contrast: -100 });
  expect(contrast.tl.slice(0, 3)).toEqual([128, 128, 128]);
  const before = await editPixels(page, { tool: "adjust" }, "detail");
  const sharpened = await editPixels(
    page,
    { tool: "adjust", sharpen: 100 },
    "detail",
  );
  expect(sharpened.detail[0]).toBeGreaterThan(before.detail[0]);
  expect(sharpened.detail[3]).toBe(255);
  expect(sharpened.transparent[3]).toBe(0);
  expect(sharpened.edge).toEqual(before.edge);
});

test("watermarks render at the chosen position, respect opacity and fit long text inside the image", async ({
  page,
}) => {
  const center = await editPixels(
    page,
    {
      tool: "watermark",
      watermarkText: "MingRay",
      watermarkPosition: "center",
      watermarkSize: 15,
      watermarkOpacity: 1,
    },
    "black",
  );
  expect(center.bounds.left).toBeGreaterThan(30);
  expect(center.bounds.right).toBeLessThan(290);
  expect(center.bounds.top).toBeGreaterThan(50);
  expect(center.bounds.bottom).toBeLessThan(130);
  const corner = await editPixels(
    page,
    {
      tool: "watermark",
      watermarkText: "MingRay",
      watermarkSize: 10,
      watermarkPosition: "bottom-right",
    },
    "black",
  );
  expect(corner.bounds.left).toBeGreaterThan(200);
  expect(corner.bounds.top).toBeGreaterThan(140);
  const long = await editPixels(
    page,
    {
      tool: "watermark",
      watermarkText: "W".repeat(80),
      watermarkPosition: "center",
      watermarkOpacity: 1,
    },
    "black",
  );
  expect(long.bounds.left).toBeGreaterThan(0);
  expect(long.bounds.right).toBeGreaterThan(long.bounds.left);
  expect(long.bounds.right).toBeLessThan(320);
});

test("invalid watermark and numeric settings are rejected before processing", async ({
  page,
}) => {
  const errors = await page.evaluate(async () => {
    const { runPipeline }: typeof import("../src/core/pipeline") = await import(
      String("/src/core/pipeline.ts")
    );
    const { DEFAULT_SETTINGS }: typeof import("../src/core/types") =
      await import(String("/src/core/types.ts"));
    const bitmap = await createImageBitmap(new OffscreenCanvas(80, 40));
    const provider: AnalysisProvider = {
      async portrait() {
        throw new Error("unexpected");
      },
      async faces() {
        throw new Error("unexpected");
      },
    };
    const messages: string[] = [];
    try {
      for (const patch of [
        { tool: "watermark" as const, watermarkText: " " },
        { tool: "adjust" as const, contrast: NaN },
        { tool: "crop" as const, cropX: Infinity },
      ]) {
        try {
          await runPipeline(
            bitmap,
            { ...DEFAULT_SETTINGS, ...patch },
            provider,
          );
        } catch (error) {
          messages.push(error instanceof Error ? error.message : String(error));
        }
      }
    } finally {
      bitmap.close();
    }
    return messages;
  });
  expect(errors).toHaveLength(3);
  expect(errors[0]).toContain("浮水印文字");
  expect(errors[1]).toContain("有效數值");
});
