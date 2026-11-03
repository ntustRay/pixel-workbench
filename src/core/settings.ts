import { TOOLS } from "./catalog";
import { clamp } from "./geometry";
import {
  CROP_RATIOS,
  ROTATIONS,
  WATERMARK_POSITIONS,
  type EditSettings,
} from "./types";

function finite(value: number, min: number, max: number): number {
  if (!Number.isFinite(value))
    throw new Error("處理參數不是有效數值，請重設設定。");
  return clamp(value, min, max);
}

export function normalizeSettings(settings: EditSettings): EditSettings {
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
