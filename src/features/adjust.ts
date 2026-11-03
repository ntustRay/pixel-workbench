import { sharpenPixels } from "../core/pixels";
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
  pixels.data.set(
    sharpenPixels(pixels.data, canvas.width, canvas.height, settings.sharpen),
  );
  ctx.putImageData(pixels, 0, 0);
  return canvas;
}
