import type { EditSettings } from "../core/types";
import { watermarkLayout } from "../core/watermark-layout";
import { context } from "./canvas";

// 在輸出尺寸與曝光確定後加上文字，讓批次的文字比例保持一致。
export function applyWatermark(
  canvas: OffscreenCanvas,
  settings: EditSettings,
): void {
  const ctx = context(canvas);
  const font = (size: number) =>
    `600 ${size}px "Noto Sans TC", "Microsoft JhengHei", sans-serif`;
  ctx.save();
  ctx.font = font(100);
  const layout = watermarkLayout(
    canvas.width,
    canvas.height,
    settings.watermarkSize,
    settings.watermarkPosition,
    ctx.measureText(settings.watermarkText).width / 100,
  );
  ctx.font = font(layout.fontSize);
  ctx.globalAlpha = settings.watermarkOpacity;
  ctx.textBaseline = layout.baseline;
  ctx.textAlign = layout.align;
  ctx.lineJoin = "round";
  ctx.lineWidth = Math.max(0.5, layout.fontSize * 0.08);
  ctx.strokeStyle = "#182944";
  ctx.fillStyle = settings.watermarkColor;
  ctx.strokeText(settings.watermarkText, layout.x, layout.y);
  ctx.fillText(settings.watermarkText, layout.x, layout.y);
  ctx.restore();
}
