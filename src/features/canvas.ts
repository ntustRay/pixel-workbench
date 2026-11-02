import type { PortraitMask } from "../core/types";

export function surface(width: number, height: number): OffscreenCanvas {
  return new OffscreenCanvas(
    Math.max(1, Math.round(width)),
    Math.max(1, Math.round(height)),
  );
}

export function context(
  canvas: OffscreenCanvas,
): OffscreenCanvasRenderingContext2D {
  const ctx = canvas.getContext("2d");
  if (!ctx)
    throw new Error(
      "瀏覽器無法建立圖片畫布，請使用新版 Chrome、Edge 或 Firefox。",
    );
  return ctx;
}

export function copyImage(image: ImageBitmap): OffscreenCanvas {
  const canvas = surface(image.width, image.height);
  context(canvas).drawImage(image, 0, 0);
  return canvas;
}

export function portraitCutout(
  image: ImageBitmap,
  mask: PortraitMask,
): OffscreenCanvas {
  if (
    !(mask.width > 0 && mask.height > 0) ||
    mask.alpha.length !== mask.width * mask.height
  ) {
    throw new Error("人像遮罩資料不完整，請重新處理圖片。");
  }
  const maskCanvas = surface(mask.width, mask.height);
  const maskContext = context(maskCanvas);
  const pixels = maskContext.createImageData(mask.width, mask.height);
  for (let i = 0; i < mask.alpha.length; i++) {
    const offset = i * 4;
    pixels.data[offset] = 255;
    pixels.data[offset + 1] = 255;
    pixels.data[offset + 2] = 255;
    pixels.data[offset + 3] = mask.alpha[i];
  }
  maskContext.putImageData(pixels, 0, 0);
  const canvas = copyImage(image);
  const ctx = context(canvas);
  ctx.globalCompositeOperation = "destination-in";
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(maskCanvas, 0, 0, image.width, image.height);
  ctx.globalCompositeOperation = "source-over";
  return canvas;
}
