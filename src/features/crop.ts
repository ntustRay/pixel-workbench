import { cropRect } from "../core/geometry";
import type { EditSettings } from "../core/types";
import { context, surface } from "./canvas";

export async function runCrop(
  image: ImageBitmap,
  settings: EditSettings,
): Promise<OffscreenCanvas> {
  const sideways = settings.rotation === 90 || settings.rotation === 270;
  const rotated = surface(
    sideways ? image.height : image.width,
    sideways ? image.width : image.height,
  );
  const ctx = context(rotated);
  ctx.translate(rotated.width / 2, rotated.height / 2);
  ctx.scale(settings.flipHorizontal ? -1 : 1, settings.flipVertical ? -1 : 1);
  ctx.rotate((settings.rotation * Math.PI) / 180);
  ctx.drawImage(image, -image.width / 2, -image.height / 2);
  const ratio =
    settings.cropRatio === "original"
      ? null
      : (() => {
          const [width, height] = settings.cropRatio.split(":").map(Number);
          return width / height;
        })();
  const crop = cropRect(
    rotated.width,
    rotated.height,
    ratio,
    settings.cropX,
    settings.cropY,
  );
  const canvas = surface(crop.width, crop.height);
  context(canvas).drawImage(
    rotated,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    crop.width,
    crop.height,
  );
  return canvas;
}
