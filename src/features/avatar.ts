import { avatarRect, validFaces } from "../core/geometry";
import type { ToolDefinition } from "../core/types";
import { context, copyImage, surface } from "./canvas";

const ratios = { "1:1": 1, "4:5": 4 / 5, "3:4": 3 / 4 };

export const runAvatar: ToolDefinition["run"] = async (
  image,
  settings,
  analysis,
) => {
  const faces = validFaces(
    await analysis.faces(image),
    image.width,
    image.height,
  );
  const largest = faces.reduce<(typeof faces)[number] | undefined>(
    (current, face) =>
      !current || face.width * face.height > current.width * current.height
        ? face
        : current,
    undefined,
  );
  if (!largest) return copyImage(image);
  const rect = avatarRect(
    largest,
    image.width,
    image.height,
    ratios[settings.avatarRatio],
  );
  const canvas = surface(rect.width, rect.height);
  const ctx = context(canvas);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(
    image,
    rect.x,
    rect.y,
    rect.width,
    rect.height,
    0,
    0,
    canvas.width,
    canvas.height,
  );
  return canvas;
};
