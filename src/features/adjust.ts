import type { EditSettings } from "../core/types";
import { context, surface } from "./canvas";

export async function runAdjust(
  image: ImageBitmap,
  settings: EditSettings,
): Promise<OffscreenCanvas> {
  const canvas = surface(image.width, image.height);
  const ctx = context(canvas);
  ctx.filter = `contrast(${1 + settings.contrast / 100}) saturate(${1 + settings.saturation / 100}) grayscale(${settings.grayscale ? 1 : 0})`;
  ctx.drawImage(image, 0, 0);
  ctx.filter = "none";
  if (settings.sharpen === 0) return canvas;

  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const input = new Uint8ClampedArray(pixels.data);
  const { width, height } = canvas;
  const amount = settings.sharpen / 100;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const offset = (y * width + x) * 4;
      if (input[offset + 3] === 0) continue;
      const neighbors = [
        (y * width + Math.max(0, x - 1)) * 4,
        (y * width + Math.min(width - 1, x + 1)) * 4,
        (Math.max(0, y - 1) * width + x) * 4,
        (Math.min(height - 1, y + 1) * width + x) * 4,
      ];
      for (let channel = 0; channel < 3; channel++) {
        const center = input[offset + channel];
        // 透明鄰點不參與，避免透明邊緣出現黑色描邊。
        let detail = 0;
        for (const neighbor of neighbors) {
          const weight = Math.min(input[offset + 3], input[neighbor + 3]) / 255;
          detail += (center - input[neighbor + channel]) * weight;
        }
        pixels.data[offset + channel] = center + amount * detail;
      }
    }
  }
  ctx.putImageData(pixels, 0, 0);
  return canvas;
}
