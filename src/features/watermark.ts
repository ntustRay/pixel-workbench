import type { EditSettings } from "../core/types";
import { context } from "./canvas";

// 在輸出尺寸與曝光確定後加上文字，讓批次的文字比例保持一致。
export function applyWatermark(
  canvas: OffscreenCanvas,
  settings: EditSettings,
): void {
  const ctx = context(canvas);
  const margin = Math.max(1, Math.min(canvas.width, canvas.height) * 0.04);
  let size = Math.max(
    1,
    (Math.min(canvas.width, canvas.height) * settings.watermarkSize) / 100,
  );
  const font = () =>
    `600 ${size}px "Noto Sans TC", "Microsoft JhengHei", sans-serif`;
  ctx.font = font();
  const width = ctx.measureText(settings.watermarkText).width;
  if (width > canvas.width - margin * 2) {
    size *= (canvas.width - margin * 2) / width;
    ctx.font = font();
  }
  const position = settings.watermarkPosition;
  ctx.save();
  ctx.globalAlpha = settings.watermarkOpacity;
  ctx.textBaseline =
    position === "center"
      ? "middle"
      : position.startsWith("top")
        ? "top"
        : "bottom";
  ctx.textAlign =
    position === "center"
      ? "center"
      : position.endsWith("right")
        ? "right"
        : "left";
  const x =
    position === "center"
      ? canvas.width / 2
      : position.endsWith("right")
        ? canvas.width - margin
        : margin;
  const y =
    position === "center"
      ? canvas.height / 2
      : position.startsWith("top")
        ? margin
        : canvas.height - margin;
  ctx.lineJoin = "round";
  ctx.lineWidth = Math.max(0.5, size * 0.08);
  ctx.strokeStyle = "#182944";
  ctx.fillStyle = settings.watermarkColor;
  ctx.strokeText(settings.watermarkText, x, y);
  ctx.fillText(settings.watermarkText, x, y);
  ctx.restore();
}
