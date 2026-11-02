import { stickerPadding } from "../core/geometry";
import type { ToolDefinition } from "../core/types";
import { context, copyImage, portraitCutout, surface } from "./canvas";

export const runSticker: ToolDefinition["run"] = async (
  image,
  settings,
  analysis,
) => {
  const foreground = settings.usePortraitMask
    ? portraitCutout(image, await analysis.portrait(image))
    : copyImage(image);
  const padding = stickerPadding(settings.outline, settings.shadow);
  const outlined = surface(
    image.width + padding * 2,
    image.height + padding * 2,
  );
  const outlineCtx = context(outlined);

  if (settings.outline > 0) {
    const silhouette = surface(image.width, image.height);
    const silhouetteCtx = context(silhouette);
    silhouetteCtx.drawImage(foreground, 0, 0);
    silhouetteCtx.globalCompositeOperation = "source-in";
    silhouetteCtx.fillStyle = settings.outlineColor;
    silhouetteCtx.fillRect(0, 0, image.width, image.height);
    // 用有限次位移膨脹透明度遮罩，不需要第二個神經網路模型。
    const steps = Math.min(
      64,
      Math.max(16, Math.ceil(settings.outline * Math.PI)),
    );
    outlineCtx.drawImage(silhouette, padding, padding);
    for (let i = 0; i < steps; i++) {
      const angle = (i / steps) * Math.PI * 2;
      outlineCtx.drawImage(
        silhouette,
        padding + Math.cos(angle) * settings.outline,
        padding + Math.sin(angle) * settings.outline,
      );
    }
  }
  outlineCtx.drawImage(foreground, padding, padding);
  if (settings.shadow <= 0) return outlined;
  const canvas = surface(outlined.width, outlined.height);
  const ctx = context(canvas);
  ctx.shadowColor = "rgba(21, 36, 66, 0.3)";
  ctx.shadowBlur = settings.shadow;
  ctx.shadowOffsetY = settings.shadow * 0.5;
  ctx.drawImage(outlined, 0, 0);
  return canvas;
};
