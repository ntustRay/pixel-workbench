import { privacyRect, validFaces } from "../core/geometry";
import type { ToolDefinition } from "../core/types";
import { context, copyImage, surface } from "./canvas";

export const runPrivacy: ToolDefinition["run"] = async (
  image,
  settings,
  analysis,
) => {
  const faces = validFaces(
    await analysis.faces(image),
    image.width,
    image.height,
  );
  const canvas = copyImage(image);
  const ctx = context(canvas);
  for (const face of faces) {
    const rect = privacyRect(face, image.width, image.height);
    const small = surface(
      Math.max(1, Math.floor(rect.width / settings.pixelSize)),
      Math.max(1, Math.floor(rect.height / settings.pixelSize)),
    );
    context(small).drawImage(
      image,
      rect.x,
      rect.y,
      rect.width,
      rect.height,
      0,
      0,
      small.width,
      small.height,
    );
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(
      small,
      0,
      0,
      small.width,
      small.height,
      rect.x,
      rect.y,
      rect.width,
      rect.height,
    );
  }
  return canvas;
};
