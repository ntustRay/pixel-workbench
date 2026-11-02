import type { ToolDefinition } from "../core/types";
import { context, portraitCutout, surface } from "./canvas";

export const runBackground: ToolDefinition["run"] = async (
  image,
  settings,
  analysis,
) => {
  const foreground = portraitCutout(image, await analysis.portrait(image));
  if (settings.backgroundMode === "transparent") return foreground;
  const canvas = surface(image.width, image.height);
  const ctx = context(canvas);
  if (settings.backgroundMode === "color") {
    ctx.fillStyle = settings.backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  } else {
    // 略微放大底圖，避免模糊後四周留下透明邊緣。
    const margin = settings.blur * 2;
    ctx.filter = `blur(${settings.blur}px)`;
    ctx.drawImage(
      image,
      -margin,
      -margin,
      image.width + margin * 2,
      image.height + margin * 2,
    );
    ctx.filter = "none";
  }
  ctx.drawImage(foreground, 0, 0);
  return canvas;
};
