import type { EditSettings } from "./types";

export interface WatermarkLayout {
  fontSize: number;
  x: number;
  y: number;
  margin: number;
  align: "left" | "center" | "right";
  baseline: "top" | "middle" | "bottom";
}

// unitTextWidth 是使用實際字體量測的文字寬度除以字級。
export function watermarkLayout(
  width: number,
  height: number,
  sizePercent: number,
  position: EditSettings["watermarkPosition"],
  unitTextWidth: number,
): WatermarkLayout {
  if (
    ![width, height, sizePercent].every((n) => Number.isFinite(n) && n > 0) ||
    !Number.isFinite(unitTextWidth) ||
    unitTextWidth < 0
  )
    throw new Error("浮水印尺寸不正確。");
  const margin = Math.min(width, height) * 0.04;
  const desiredSize = Math.max(
    1,
    (Math.min(width, height) * sizePercent) / 100,
  );
  const fontSize =
    unitTextWidth === 0
      ? desiredSize
      : Math.min(desiredSize, (width - margin * 2) / unitTextWidth);
  return {
    fontSize,
    margin,
    x:
      position === "center"
        ? width / 2
        : position.endsWith("right")
          ? width - margin
          : margin,
    y:
      position === "center"
        ? height / 2
        : position.startsWith("top")
          ? margin
          : height - margin,
    align:
      position === "center"
        ? "center"
        : position.endsWith("right")
          ? "right"
          : "left",
    baseline:
      position === "center"
        ? "middle"
        : position.startsWith("top")
          ? "top"
          : "bottom",
  };
}
