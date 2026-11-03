// 四鄰點銳化。讀取原始像素、寫入副本，讓結果與掃描方向無關。
export function sharpenPixels(
  input: Uint8ClampedArray,
  width: number,
  height: number,
  strength: number,
): Uint8ClampedArray {
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < 1 ||
    height < 1 ||
    input.length !== width * height * 4
  )
    throw new Error("像素資料與尺寸不一致。");
  if (!Number.isFinite(strength) || strength < 0 || strength > 100)
    throw new Error("銳化程度必須介於 0 至 100。");
  const output = new Uint8ClampedArray(input);
  if (strength === 0) return output;
  const amount = strength / 100;
  const neighbors = [0, 0, 0, 0];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const offset = (y * width + x) * 4;
      if (input[offset + 3] === 0) continue;
      neighbors[0] = (y * width + Math.max(0, x - 1)) * 4;
      neighbors[1] = (y * width + Math.min(width - 1, x + 1)) * 4;
      neighbors[2] = (Math.max(0, y - 1) * width + x) * 4;
      neighbors[3] = (Math.min(height - 1, y + 1) * width + x) * 4;
      for (let channel = 0; channel < 3; channel++) {
        const center = input[offset + channel];
        // 透明鄰點依 alpha 降低權重，避免透明邊緣出現黑邊。
        let detail = 0;
        for (const neighbor of neighbors) {
          const weight = Math.min(input[offset + 3], input[neighbor + 3]) / 255;
          detail += (center - input[neighbor + channel]) * weight;
        }
        output[offset + channel] = center + amount * detail;
      }
    }
  }
  return output;
}
