import { runAvatar } from "../features/avatar";
import { runBackground } from "../features/background";
import { runCrop } from "../features/crop";
import { runAdjust } from "../features/adjust";
import { applyWatermark } from "../features/watermark";
import { context, copyImage, surface } from "../features/canvas";
import { runPrivacy } from "../features/privacy";
import { runSticker } from "../features/sticker";
import { TOOLS } from "./catalog";
import { clamp, fitWithin, validFaces } from "./geometry";
import { CROP_RATIOS, ROTATIONS, WATERMARK_POSITIONS } from "./types";
import type {
  AnalysisProvider,
  EditSettings,
  FaceBox,
  PipelineResult,
  PortraitMask,
  ToolDefinition,
  ToolId,
} from "./types";

const processors: Record<ToolId, ToolDefinition["run"]> = {
  background: runBackground,
  sticker: runSticker,
  privacy: runPrivacy,
  avatar: runAvatar,
  crop: runCrop,
  adjust: runAdjust,
  watermark: async (image) => copyImage(image),
  export: async (image) => copyImage(image),
};

function finite(value: number, min: number, max: number): number {
  if (!Number.isFinite(value))
    throw new Error("處理參數不是有效數值，請重設設定。");
  return clamp(value, min, max);
}

function normalize(settings: EditSettings): EditSettings {
  if (!TOOLS.some(({ id }) => id === settings.tool))
    throw new Error("找不到這個圖片工具。");
  if (!["image/png", "image/jpeg", "image/webp"].includes(settings.format))
    throw new Error("不支援這個輸出格式。");
  if (!["transparent", "color", "blur"].includes(settings.backgroundMode))
    throw new Error("不支援這個背景設定。");
  if (!["1:1", "4:5", "3:4"].includes(settings.avatarRatio))
    throw new Error("不支援這個頭像比例。");
  if (
    !CROP_RATIOS.includes(settings.cropRatio) ||
    !ROTATIONS.includes(settings.rotation)
  )
    throw new Error("不支援這個裁切比例或旋轉角度。");
  if (!WATERMARK_POSITIONS.includes(settings.watermarkPosition))
    throw new Error("不支援這個浮水印位置。");
  const watermarkText = settings.watermarkText.replace(/[\r\n\t]/g, " ").trim();
  if (
    settings.tool === "watermark" &&
    (!watermarkText || Array.from(watermarkText).length > 80)
  )
    throw new Error("請輸入 1 至 80 個字的浮水印文字。");
  if (
    ![
      settings.backgroundColor,
      settings.outlineColor,
      settings.watermarkColor,
    ].every((color) => /^#[\da-f]{6}$/i.test(color))
  )
    throw new Error("顏色格式不正確。");
  return {
    ...settings,
    blur: finite(settings.blur, 0, 60),
    outline: finite(settings.outline, 0, 40),
    shadow: finite(settings.shadow, 0, 50),
    pixelSize: finite(settings.pixelSize, 6, 80),
    exposure: finite(settings.exposure, -2, 2),
    cropX: finite(settings.cropX, 0, 100),
    cropY: finite(settings.cropY, 0, 100),
    contrast: finite(settings.contrast, -100, 100),
    saturation: finite(settings.saturation, -100, 100),
    sharpen: finite(settings.sharpen, 0, 100),
    watermarkText,
    watermarkOpacity: finite(settings.watermarkOpacity, 0.1, 1),
    watermarkSize: finite(settings.watermarkSize, 2, 15),
    quality: finite(settings.quality, 0.1, 1),
    maxEdge: Math.round(finite(settings.maxEdge, 128, 4096)),
  };
}

// UI 與批次輸出使用同一個入口；模型與效果只在 Worker 內載入。
export async function runPipeline(
  image: ImageBitmap,
  input: EditSettings,
  provider: AnalysisProvider,
): Promise<PipelineResult> {
  const settings = normalize(input);
  if (!(image.width > 0 && image.height > 0))
    throw new Error("圖片沒有有效的尺寸。");
  let portrait: Promise<PortraitMask> | undefined;
  let faces: Promise<FaceBox[]> | undefined;
  const analysis: AnalysisProvider = {
    portrait: (bitmap) => (portrait ??= provider.portrait(bitmap)),
    faces: (bitmap) =>
      (faces ??= provider
        .faces(bitmap)
        .then((result) => validFaces(result, bitmap.width, bitmap.height))),
  };
  const processed = await processors[settings.tool](image, settings, analysis);
  const size = fitWithin(processed.width, processed.height, settings.maxEdge);
  const canvas = surface(size.width, size.height);
  const ctx = context(canvas);
  const warnings: string[] = [];
  if (settings.format === "image/jpeg") {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (
      settings.tool === "sticker" ||
      (settings.tool === "background" &&
        settings.backgroundMode === "transparent")
    ) {
      warnings.push(
        "JPEG 不支援透明度；透明區域已填入白色。請選 PNG 或 WebP 保留透明背景。",
      );
    }
  }
  ctx.imageSmoothingQuality = "high";
  ctx.filter = `brightness(${2 ** settings.exposure})`;
  ctx.drawImage(processed, 0, 0, canvas.width, canvas.height);
  ctx.filter = "none";
  if (settings.tool === "watermark") applyWatermark(canvas, settings);
  const count = faces ? (await faces).length : 0;
  if (settings.tool === "privacy") {
    warnings.push(
      count > 0
        ? "自動偵測可能漏掉側臉、小臉或遠距人臉；分享前請逐一檢查。"
        : "未偵測到人臉，這張圖片沒有套用馬賽克。請檢查人臉是否太小或角度過大。",
    );
  }
  if (settings.tool === "avatar" && count === 0)
    warnings.push("未偵測到人臉，保留原圖比例。請換用正面且清晰的人像。");
  const blob = await canvas.convertToBlob({
    type: settings.format,
    quality: settings.quality,
  });
  if (blob.type !== settings.format)
    throw new Error("瀏覽器不支援所選輸出格式，請改用 PNG。");
  return {
    blob,
    width: canvas.width,
    height: canvas.height,
    faces: count,
    warnings,
  };
}
