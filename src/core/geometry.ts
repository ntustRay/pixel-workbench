import type { FaceBox } from "./types";

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}
export interface Size {
  width: number;
  height: number;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function fitWithin(
  width: number,
  height: number,
  maxEdge: number,
): Size {
  if (![width, height, maxEdge].every((n) => Number.isFinite(n) && n > 0)) {
    throw new Error("圖片尺寸必須大於零。");
  }
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

export function validFaces(
  faces: readonly FaceBox[],
  width: number,
  height: number,
): FaceBox[] {
  return faces.filter(
    (face) =>
      [face.x, face.y, face.width, face.height, face.score].every(
        Number.isFinite,
      ) &&
      face.width > 0 &&
      face.height > 0 &&
      face.x < width &&
      face.y < height &&
      face.x + face.width > 0 &&
      face.y + face.height > 0,
  );
}

// 加大遮蔽區，涵蓋邊緣與部分髮際；仍需要使用者檢查漏偵測的人臉。
export function privacyRect(
  face: FaceBox,
  width: number,
  height: number,
): Rect {
  const x = clamp(Math.floor(face.x - face.width * 0.22), 0, width - 1);
  const y = clamp(Math.floor(face.y - face.height * 0.28), 0, height - 1);
  const right = clamp(Math.ceil(face.x + face.width * 1.22), x + 1, width);
  const bottom = clamp(Math.ceil(face.y + face.height * 1.22), y + 1, height);
  return { x, y, width: right - x, height: bottom - y };
}

export function avatarRect(
  face: FaceBox,
  width: number,
  height: number,
  ratio: number,
): Rect {
  if (!(width > 0 && height > 0 && ratio > 0 && Number.isFinite(ratio)))
    throw new Error("裁切比例不正確。");
  let cropWidth = Math.max(face.width * 2.8, face.height * 3.2 * ratio);
  cropWidth = Math.min(cropWidth, width, height * ratio);
  const cropHeight = cropWidth / ratio;
  const centerX = face.x + face.width / 2;
  const centerY = face.y + face.height * 0.85;
  return {
    x: clamp(centerX - cropWidth / 2, 0, width - cropWidth),
    y: clamp(centerY - cropHeight / 2, 0, height - cropHeight),
    width: cropWidth,
    height: cropHeight,
  };
}

export function stickerPadding(outline: number, shadow: number): number {
  return Math.ceil(outline + shadow * 2 + shadow * 0.5);
}
